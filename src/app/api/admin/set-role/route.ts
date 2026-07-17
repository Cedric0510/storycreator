import { NextRequest, NextResponse } from "next/server";

import { jsonError, requireAdmin } from "@/lib/server/bffGuard";

interface SetRolePayload {
  userId?: string;
  role?: string;
}

function isRoleValid(role: string): role is "admin" | "author" | "reader" {
  return role === "admin" || role === "author" || role === "reader";
}

export async function POST(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  let payload: SetRolePayload;
  try {
    payload = (await request.json()) as SetRolePayload;
  } catch {
    return jsonError("Payload JSON invalide.");
  }

  const targetUserId = (payload.userId ?? "").trim();
  const nextRole = (payload.role ?? "").trim().toLowerCase();

  if (!targetUserId) {
    return jsonError("Identifiant utilisateur manquant.");
  }
  if (!isRoleValid(nextRole)) {
    return jsonError("Role invalide.");
  }

  const { data: targetProfile, error: targetProfileError } = await context.serviceClient
    .from("author_profiles")
    .select("platform_role")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetProfileError) {
    return jsonError(`Erreur verification utilisateur cible: ${targetProfileError.message}`, 500);
  }
  if (!targetProfile) {
    return jsonError("Utilisateur cible introuvable.", 404);
  }

  // Regle metier: ne jamais retrograder le dernier admin (contrat, regle 5).
  if (targetProfile.platform_role === "admin" && nextRole !== "admin") {
    const { count: adminCount, error: countError } = await context.serviceClient
      .from("author_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("platform_role", "admin");

    if (countError) {
      return jsonError(`Erreur verification admins: ${countError.message}`, 500);
    }
    if ((adminCount ?? 0) <= 1) {
      return jsonError("Impossible de retrograder le dernier compte admin.", 409);
    }
  }

  const { error: updateError } = await context.serviceClient
    .from("author_profiles")
    .update({ platform_role: nextRole, updated_at: new Date().toISOString() })
    .eq("user_id", targetUserId);

  if (updateError) {
    return jsonError(`Erreur mise a jour role: ${updateError.message}`, 500);
  }

  return NextResponse.json({ ok: true });
}
