import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PlatformRole = "admin" | "author" | "reader";

interface CreateUserPayload {
  email?: string;
  password?: string;
  role?: PlatformRole;
  displayName?: string;
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
    return badRequest("Acces refuse: seul un admin peut creer un compte.", 403);
  }

  let payload: CreateUserPayload;
  try {
    payload = (await request.json()) as CreateUserPayload;
  } catch {
    return badRequest("Payload JSON invalide.");
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  const role = (payload.role ?? "reader").trim().toLowerCase();
  const displayName = pickDisplayName(email, payload.displayName);

  if (!email || !isEmailValid(email)) {
    return badRequest("Email invalide.");
  }
  if (password.length < 8) {
    return badRequest("Le mot de passe provisoire doit contenir au moins 8 caracteres.");
  }
  if (!isRoleValid(role)) {
    return badRequest("Role invalide.");
  }

  const { data: existingProfile, error: existingProfileError } = await serviceClient
    .from("author_profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return badRequest(`Erreur verification utilisateur existant: ${existingProfileError.message}`, 500);
  }

  if (existingProfile?.user_id) {
    return badRequest("Un compte existe deja pour cet email.", 409);
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
    return badRequest(`Erreur creation utilisateur: ${createUserError?.message ?? "unknown"}`, 500);
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
    return badRequest(`Utilisateur cree mais profil invalide: ${profileUpsertError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    userId: createdUserData.user.id,
    email,
    role,
  });
}
