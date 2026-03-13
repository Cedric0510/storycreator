import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface DeleteUserPayload {
  userId?: string;
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return badRequest(
      "Configuration serveur manquante: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) / SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY).",
      500,
    );
  }

  const token = request.headers.get("x-supabase-access-token")?.trim() ?? "";
  if (!token) {
    return badRequest("Token utilisateur manquant.", 401);
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return badRequest("Session invalide. Reconnecte-toi puis reessaie.", 401);
  }

  const requesterId = authData.user.id;
  const { data: requesterProfile, error: requesterProfileError } = await serviceClient
    .from("author_profiles")
    .select("platform_role")
    .eq("user_id", requesterId)
    .maybeSingle();

  if (requesterProfileError) {
    return badRequest(`Erreur verification admin: ${requesterProfileError.message}`, 500);
  }
  if (requesterProfile?.platform_role !== "admin") {
    return badRequest("Acces refuse: seul un admin peut supprimer un compte.", 403);
  }

  let payload: DeleteUserPayload;
  try {
    payload = (await request.json()) as DeleteUserPayload;
  } catch {
    return badRequest("Payload JSON invalide.");
  }

  const targetUserId = (payload.userId ?? "").trim();
  if (!targetUserId) {
    return badRequest("Identifiant utilisateur manquant.");
  }
  if (targetUserId === requesterId) {
    return badRequest("Utilise la page Compte pour supprimer ton propre compte.", 409);
  }

  const { data: targetProfile, error: targetProfileError } = await serviceClient
    .from("author_profiles")
    .select("platform_role")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetProfileError) {
    return badRequest(`Erreur verification utilisateur cible: ${targetProfileError.message}`, 500);
  }

  if (targetProfile?.platform_role === "admin") {
    const { count: adminCount, error: countError } = await serviceClient
      .from("author_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("platform_role", "admin");
    if (countError) {
      return badRequest(`Erreur verification admins: ${countError.message}`, 500);
    }
    if ((adminCount ?? 0) <= 1) {
      return badRequest("Impossible de supprimer le dernier compte admin.", 409);
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUserId, true);
  if (deleteError) {
    return badRequest(`Erreur suppression utilisateur: ${deleteError.message}`, 500);
  }

  return NextResponse.json({ ok: true });
}

