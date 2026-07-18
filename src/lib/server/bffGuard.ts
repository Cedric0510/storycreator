/**
 * Garde commune des routes BFF (/api/*).
 *
 * Centralise: lecture de la configuration serveur, verification du token
 * utilisateur, verification du role admin. Chaque regle est decrite dans
 * docs/backend-contract.md (regle 11).
 */

import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient, createClient } from "@supabase/supabase-js";

export function jsonError(message: string, status = 400) {
  // Les erreurs serveur sont loggees (visibles dans les logs Vercel);
  // les 4xx sont des refus attendus, pas du bruit de log.
  if (status >= 500) {
    console.error(`[bff] ${status}: ${message}`);
  }
  return NextResponse.json({ error: message }, { status });
}

/**
 * Rate limiting best-effort par IP (fenetre glissante en memoire).
 *
 * Limite: la memoire est locale a chaque instance serverless — c'est une
 * protection contre les rafales, pas une garantie globale. Le backend maison
 * devra fournir un vrai rate limiting partage (contrat, section erreurs: 429).
 */
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_TRACKED_IPS = 5_000;
const requestTimestampsByIp = new Map<string, number[]>();

export function isRateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  const now = Date.now();
  const recent = (requestTimestampsByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);

  if (requestTimestampsByIp.size > RATE_LIMIT_MAX_TRACKED_IPS) {
    requestTimestampsByIp.clear();
  }
  requestTimestampsByIp.set(ip, recent);

  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

export interface BffUserContext {
  serviceClient: SupabaseClient;
  requesterId: string;
}

/**
 * Verifie la configuration serveur et le token utilisateur.
 * Retourne un contexte { serviceClient, requesterId } ou une NextResponse d'erreur.
 */
export async function requireUser(
  request: NextRequest,
): Promise<BffUserContext | NextResponse> {
  if (isRateLimited(request)) {
    return jsonError("Trop de requetes. Reessaie dans une minute.", 429);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return jsonError(
      "Configuration serveur manquante: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) / SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY).",
      500,
    );
  }

  const token = request.headers.get("x-supabase-access-token")?.trim() ?? "";
  if (!token) {
    return jsonError("Token utilisateur manquant.", 401);
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonError("Session invalide. Reconnecte-toi puis reessaie.", 401);
  }

  return { serviceClient, requesterId: authData.user.id };
}

/**
 * requireUser + verification que le demandeur est admin (role recharge en base
 * avec la cle service — jamais de confiance dans le client).
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<BffUserContext | NextResponse> {
  const context = await requireUser(request);
  if (context instanceof NextResponse) return context;

  const { data: requesterProfile, error: requesterProfileError } = await context.serviceClient
    .from("author_profiles")
    .select("platform_role")
    .eq("user_id", context.requesterId)
    .maybeSingle();

  if (requesterProfileError) {
    return jsonError(`Erreur verification admin: ${requesterProfileError.message}`, 500);
  }
  if (requesterProfile?.platform_role !== "admin") {
    return jsonError("Acces refuse: reserve aux admins.", 403);
  }

  return context;
}
