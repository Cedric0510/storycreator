import { SupabaseClient, createClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Default timeout (ms) for every Supabase HTTP request.
 * Prevents the UI from hanging forever when the network drops.
 */
const SUPABASE_FETCH_TIMEOUT_MS = 30_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const existingSignal = init?.signal;

  // If the caller already attached a signal, respect it too.
  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort(existingSignal.reason);
    } else {
      existingSignal.addEventListener("abort", () =>
        controller.abort(existingSignal.reason),
      );
    }
  }

  const timeout = setTimeout(
    () => controller.abort(new Error("Requete Supabase timeout (30 s)")),
    SUPABASE_FETCH_TIMEOUT_MS,
  );

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeout),
  );
}

export function getSupabaseBrowserClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    return null;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  });

  return cachedClient;
}
