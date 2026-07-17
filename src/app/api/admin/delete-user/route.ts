import { NextRequest, NextResponse } from "next/server";

import { jsonError, requireAdmin } from "@/lib/server/bffGuard";

interface DeleteUserPayload {
  userId?: string;
}

export async function POST(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;
  const { serviceClient, requesterId } = context;

  let payload: DeleteUserPayload;
  try {
    payload = (await request.json()) as DeleteUserPayload;
  } catch {
    return jsonError("Payload JSON invalide.");
  }

  const targetUserId = (payload.userId ?? "").trim();
  if (!targetUserId) {
    return jsonError("Identifiant utilisateur manquant.");
  }
  if (targetUserId === requesterId) {
    return jsonError("Utilise la page Compte pour supprimer ton propre compte.", 409);
  }

  const { data: targetProfile, error: targetProfileError } = await serviceClient
    .from("author_profiles")
    .select("platform_role")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetProfileError) {
    return jsonError(`Erreur verification utilisateur cible: ${targetProfileError.message}`, 500);
  }

  if (targetProfile?.platform_role === "admin") {
    const { count: adminCount, error: countError } = await serviceClient
      .from("author_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("platform_role", "admin");
    if (countError) {
      return jsonError(`Erreur verification admins: ${countError.message}`, 500);
    }
    if ((adminCount ?? 0) <= 1) {
      return jsonError("Impossible de supprimer le dernier compte admin.", 409);
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUserId, true);
  if (deleteError) {
    return jsonError(`Erreur suppression utilisateur: ${deleteError.message}`, 500);
  }

  return NextResponse.json({ ok: true });
}
