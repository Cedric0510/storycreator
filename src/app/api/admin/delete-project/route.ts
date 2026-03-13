import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface DeleteProjectPayload {
  projectId?: string;
}

const SUPABASE_ASSET_BUCKET = "author-assets";
const SUPABASE_ASSET_PREFIX = "projects";

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
    return badRequest("Acces refuse: seul un admin peut supprimer un projet.", 403);
  }

  let payload: DeleteProjectPayload;
  try {
    payload = (await request.json()) as DeleteProjectPayload;
  } catch {
    return badRequest("Payload JSON invalide.");
  }

  const projectId = (payload.projectId ?? "").trim();
  if (!projectId) {
    return badRequest("Identifiant projet manquant.");
  }

  const folderPath = `${SUPABASE_ASSET_PREFIX}/${projectId}`;
  const allPaths: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await serviceClient.storage
      .from(SUPABASE_ASSET_BUCKET)
      .list(folderPath, { limit, offset, sortBy: { column: "name", order: "asc" } });

    if (error) {
      return badRequest(`Erreur listage assets: ${error.message}`, 500);
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      if (!item.name || item.name.endsWith("/")) continue;
      allPaths.push(`${folderPath}/${item.name}`);
    }
    if (data.length < limit) break;
    offset += data.length;
  }

  if (allPaths.length > 0) {
    for (let cursor = 0; cursor < allPaths.length; cursor += 100) {
      const chunk = allPaths.slice(cursor, cursor + 100);
      const { error } = await serviceClient.storage.from(SUPABASE_ASSET_BUCKET).remove(chunk);
      if (error) {
        return badRequest(`Erreur suppression assets: ${error.message}`, 500);
      }
    }
  }

  const { error: logsError } = await serviceClient
    .from("author_project_logs")
    .delete()
    .eq("project_id", projectId);
  if (logsError) {
    return badRequest(`Erreur suppression logs: ${logsError.message}`, 500);
  }

  const { error: accessError } = await serviceClient
    .from("author_project_access")
    .delete()
    .eq("project_id", projectId);
  if (accessError) {
    return badRequest(`Erreur suppression acces: ${accessError.message}`, 500);
  }

  const { error: projectError } = await serviceClient
    .from("author_projects")
    .delete()
    .eq("id", projectId);
  if (projectError) {
    return badRequest(`Erreur suppression projet: ${projectError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    projectId,
    removedAssetCount: allPaths.length,
  });
}

