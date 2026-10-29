// Singleton Supabase client - hanya dibuat sekali, lazy.
// Import dari sini agar semua fitur (Realtime, dll) berbagi
// satu koneksi WebSocket yang sama.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Sesi admin dikelola via cookie HttpOnly (edge function).
        // Client ini hanya untuk Realtime & read-only public queries.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
    });
  }
  return _client;
}