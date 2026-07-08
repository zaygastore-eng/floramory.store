import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "dist", "public");

async function loadEnvFile() {
  const envPath = path.join(rootDir, ".env");
  if (!existsSync(envPath)) return;

  const text = await readFile(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

await loadEnvFile();

const PORT = Number(process.env.PORT || 3001);
const SHEETS_CSV_URL =
  process.env.SHEETS_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjLp_qo1CZVcWWq7CMkstImftaN5DeI6wZpZ3TDlge8_DtDTtF3qjj4DkJn7era5lJQYqggbBzIT8G/pub?output=csv";
const SHEETS_WRITE_URL = process.env.SHEETS_WRITE_URL || "";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "";

const CACHE_TTL = Number(process.env.PRODUCT_CACHE_TTL_MS || 30_000);
let productCache = null;
let productCacheTime = 0;

const productHeaders = [
  "id",
  "nama_produk",
  "tier",
  "harga",
  "bunga",
  "deskripsi",
  "bahan",
  "ukuran",
  "nama_pembeli",
  "dari",
  "pesan_personal",
  "foto_produk",
  "foto_QR",
  "foto_url",
];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuote && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === "," && !inQuote) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !inQuote) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((x) => x !== "")) rows.push(row);
  }

  return rows;
}

function normalizeProduct(obj) {
  return {
    id: String(obj.id || "").trim(),
    nama_produk: String(obj.nama_produk || obj.nama || "").trim(),
    tier: String(obj.tier || "lite").trim().toLowerCase(),
    harga: String(obj.harga || "").trim(),
    bunga: String(obj.bunga || "").trim(),
    deskripsi: String(obj.deskripsi || "").trim(),
    bahan: String(obj.bahan || "").trim(),
    ukuran: String(obj.ukuran || "").trim(),
    nama_pembeli: String(obj.nama_pembeli || obj.namaPembeli || "").trim(),
    dari: String(obj.dari || "").trim(),
    pesan_personal: String(obj.pesan_personal || obj.pesan || "").trim(),
    foto_produk: String(obj.foto_produk || obj.foto_url || obj.foto || "").trim(),
    foto_qr: String(obj.foto_qr || obj.foto_QR || obj.foto_url || "").trim(),
    foto_QR: String(obj.foto_QR || obj.foto_qr || obj.foto_url || "").trim(),
    foto_url: String(obj.foto_url || obj.foto_produk || obj.foto || "").trim(),
  };
}

function productsFromCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows
    .slice(1)
    .map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = (row[i] || "").trim();
      });
      return normalizeProduct(obj);
    })
    .filter((product) => product.id);
}

async function fetchProducts({ force = false } = {}) {
  if (!force && productCache && Date.now() - productCacheTime < CACHE_TTL) {
    return productCache;
  }

  const res = await fetch(SHEETS_CSV_URL);
  if (!res.ok) {
    throw new Error(`Gagal mengambil data Google Sheets (${res.status})`);
  }

  productCache = productsFromCSV(await res.text());
  productCacheTime = Date.now();
  return productCache;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Payload terlalu besar");
    }
  }
  return body ? JSON.parse(body) : {};
}

function validateProduct(product) {
  const missing = ["id", "nama_produk", "tier", "harga"].filter((key) => !product[key]);
  if (missing.length) {
    return `Kolom wajib belum lengkap: ${missing.join(", ")}`;
  }
  if (!["lite", "signature", "home"].includes(product.tier)) {
    return "Tier harus salah satu dari: lite, signature, home";
  }
  return null;
}

function isAuthorized(req) {
  if (!ADMIN_API_TOKEN) return true;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  return token === ADMIN_API_TOKEN;
}

async function createProduct(req, res) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Token admin tidak valid" });
    return;
  }

  if (!SHEETS_WRITE_URL) {
    sendJson(res, 501, {
      error:
        "Backend sudah aktif, tetapi SHEETS_WRITE_URL belum dikonfigurasi. Buat Google Apps Script Web App lalu simpan URL-nya di environment.",
    });
    return;
  }

  const product = normalizeProduct(await readJson(req));
  const validationError = validateProduct(product);
  if (validationError) {
    sendJson(res, 400, { error: validationError });
    return;
  }

  const existing = await fetchProducts({ force: true });
  if (existing.some((item) => item.id.toLowerCase() === product.id.toLowerCase())) {
    sendJson(res, 409, { error: `Produk dengan ID ${product.id} sudah ada` });
    return;
  }

  const writeRes = await fetch(SHEETS_WRITE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createProduct",
      product,
      headers: productHeaders,
    }),
  });

  const text = await writeRes.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!writeRes.ok || payload.ok === false) {
    sendJson(res, writeRes.status || 502, {
      error: payload.error || "Google Sheets menolak penyimpanan produk",
    });
    return;
  }

  productCache = null;
  sendJson(res, 201, { ok: true, product });
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const requested = path.normalize(cleanPath || "index.html");
  const filePath = path.join(publicDir, requested);
  const safePath = filePath.startsWith(publicDir) ? filePath : path.join(publicDir, "index.html");
  const finalPath = existsSync(safePath) ? safePath : path.join(publicDir, "index.html");
  const ext = path.extname(finalPath);

  try {
    const file = await readFile(finalPath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(file);
  } catch {
    sendJson(res, 404, { error: "Build frontend belum tersedia. Jalankan npm run build terlebih dahulu." });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        sheetsRead: Boolean(SHEETS_CSV_URL),
        sheetsWrite: Boolean(SHEETS_WRITE_URL),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/products") {
      sendJson(res, 200, { products: await fetchProducts({ force: url.searchParams.get("fresh") === "1" }) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/products/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/products/".length));
      const products = await fetchProducts({ force: url.searchParams.get("fresh") === "1" });
      const product = products.find((item) => item.id.toLowerCase() === id.toLowerCase()) || null;
      sendJson(res, product ? 200 : 404, product ? { product } : { error: "Produk tidak ditemukan" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/products") {
      await createProduct(req, res);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Endpoint API tidak ditemukan" });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Terjadi kesalahan server" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Floramory backend running on http://localhost:${PORT}`);
});
