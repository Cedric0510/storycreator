import { NextRequest, NextResponse } from "next/server";

import { jsonError, requireAdmin } from "@/lib/server/bffGuard";

interface ProfileRow {
  user_id: string;
  email: string | null;
  display_name: string;
  platform_role: string;
  created_at: string;
}

export async function POST(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  const { data, error } = await context.serviceClient
    .from("author_profiles")
    .select("user_id,email,display_name,platform_role,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError(`Erreur chargement profils: ${error.message}`, 500);
  }

  const profiles = ((data ?? []) as ProfileRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    platformRole: row.platform_role,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ profiles });
}
