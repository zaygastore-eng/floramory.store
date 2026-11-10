// ============================================================
// A Chapter — Shared rate limiter (database-backed)
// ============================================================
// Rate limit in-memory hanya berlaku per instance Edge Function.
// Helper ini memakai RPC `check_rate_limit` (fixed window) agar
// batas tetap berlaku lintas instance.
//
// Fail-open: jika RPC gagal (mis. migrasi belum jalan), permintaan
// tidak diblokir agar pemesanan tidak ikut mati. Kegagalan dicatat
// ke log untuk investigasi.
// ============================================================

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export async function checkDbRateLimit(
  admin: SupabaseClient,
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  if (!key || key === "unknown" || limit <= 0) return true;

  try {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("[RATE_LIMIT_ERROR]", error.message || "RPC failed.");
      return true;
    }
    return data === true;
  } catch (error) {
    console.error(
      "[RATE_LIMIT_ERROR]",
      error instanceof Error ? error.message : "Unexpected error."
    );
    return true;
  }
}
