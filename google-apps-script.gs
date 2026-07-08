const SHEET_NAME = "Sheet1";

const HEADERS = [
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

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (payload.action !== "createProduct") {
      return jsonResponse({ ok: false, error: "Action tidak dikenal" });
    }

    const product = payload.product || {};
    const sheet = getSheet();
    ensureHeaders(sheet);

    const existingIds = sheet
      .getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1)
      .getValues()
      .flat()
      .map((id) => String(id).toLowerCase());

    if (existingIds.includes(String(product.id || "").toLowerCase())) {
      return jsonResponse({ ok: false, error: "ID produk sudah ada di Google Sheets" });
    }

    sheet.appendRow(HEADERS.map((header) => product[header] || ""));
    return jsonResponse({ ok: true, product });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || "Gagal menyimpan produk" });
  }
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => firstRow[index] === header);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
