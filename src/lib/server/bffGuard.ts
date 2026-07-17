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
  return NextResponse.json({ error: message }, { status });
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
