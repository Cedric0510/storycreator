import { NextRequest, NextResponse } from "next/server";

import { jsonError, requireAdmin } from "@/lib/server/bffGuard";

type PlatformRole = "admin" | "author" | "reader";

interface CreateUserPayload {
  email?: string;
  password?: string;
  role?: PlatformRole;
  displayName?: string;
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isRoleValid(role: string): role is PlatformRole {
  return role === "admin" || role === "author" || role === "reader";
}

function pickDisplayName(email: string, displayName?: string) {
  const trimmed = (displayName ?? "").trim();
  if (trimmed) return trimmed;
  const [localPart] = email.split("@");
  return localPart || "Auteur";
}

export async function POST(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;
  const { serviceClient } = context;

  let payload: CreateUserPayload;
  try {
    payload = (await request.json()) as CreateUserPayload;
  } catch {
    return jsonError("Payload JSON invalide.");
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  const role = (payload.role ?? "reader").trim().toLowerCase();
  const displayName = pickDisplayName(email, payload.displayName);

  if (!email || !isEmailValid(email)) {
    return jsonError("Email invalide.");
  }
  if (password.length < 8) {
    return jsonError("Le mot de passe provisoire doit contenir au moins 8 caracteres.");
  }
  if (!isRoleValid(role)) {
    return jsonError("Role invalide.");
  }

  const { data: existingProfile, error: existingProfileError } = await serviceClient
    .from("author_profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return jsonError(`Erreur verification utilisateur existant: ${existingProfileError.message}`, 500);
  }

  if (existingProfile?.user_id) {
    return jsonError("Un compte existe deja pour cet email.", 409);
  }

  const { data: createdUserData, error: createUserError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      must_change_password: true,
    },
  });

  if (createUserError || !createdUserData.user) {
    return jsonError(`Erreur creation utilisateur: ${createUserError?.message ?? "unknown"}`, 500);
  }

  const { error: profileUpsertError } = await serviceClient
    .from("author_profiles")
    .upsert(
      {
        user_id: createdUserData.user.id,
        email,
        display_name: displayName,
        platform_role: role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (profileUpsertError) {
    return jsonError(`Utilisateur cree mais profil invalide: ${profileUpsertError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    userId: createdUserData.user.id,
    email,
    role,
  });
}
