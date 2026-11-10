// ============================================================
// A Chapter — Health check endpoint
// ============================================================
// GET /api/health
//   -> 200 { ok: true, checks: { database: "up" } }
//   -> 503 jika database tidak dapat dijangkau.
//
// Dipakai untuk uptime monitor (Better Stack, UptimeRobot, dsb.)
// dan untuk memastikan deploy baru benar-benar bisa membaca data.
// Sengaja tidak mengembalikan data bisnis apa pun.
// ============================================================

const SUPABASE_URL = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON_KEY = String(process.env.VITE_SUPABASE_ANON_KEY || "");

type Res = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
  if (!SUPABASE_URL || !ANON_KEY) {
    return { ok: false, latencyMs: 0, detail: "Supabase env vars are not configured." };
  }

  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id&limit=1`,
      {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    return {
      ok: response.ok,
      latencyMs: Date.now() - startedAt,
      ...(response.ok ? {} : { detail: `PostgREST responded ${response.status}.` }),
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : "Unknown database error.",
    };
  }
}

export default async function handler(_req: unknown, res: Res): Promise<void> {
  const database = await checkDatabase();
  const ok = database.ok;

  res.statusCode = ok ? 200 : 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(
    JSON.stringify({
      ok,
      service: "achapter-web",
      timestamp: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      checks: {
        database: database.ok ? "up" : "down",
      },
      latencyMs: database.latencyMs,
      ...(database.detail ? { detail: database.detail } : {}),
    })
  );
}
