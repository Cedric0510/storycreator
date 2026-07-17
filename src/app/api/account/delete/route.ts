import { NextRequest, NextResponse } from "next/server";

import { jsonError, requireUser } from "@/lib/server/bffGuard";

export async function POST(request: NextRequest) {
  const context = await requireUser(request);
  if (context instanceof NextResponse) return context;
  const { serviceClient, requesterId } = context;

  const { data: requesterProfile, error: requesterProfileError } = await serviceClient
    .from("author_profiles")
    .select("platform_role")
    .eq("user_id", requesterId)
    .maybeSingle();

  if (requesterProfileError) {
    return jsonError(`Erreur verification profil: ${requesterProfileError.message}`, 500);
  }

  // Prevent deleting the last admin account.
  if (requesterProfile?.platform_role === "admin") {
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

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(requesterId, true);
  if (deleteError) {
    return jsonError(`Erreur suppression compte: ${deleteError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
  });
}
