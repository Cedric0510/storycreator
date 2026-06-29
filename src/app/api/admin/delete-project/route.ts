import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "La suppression de projets cloud est desactivee: cette instance utilise uniquement l'authentification Supabase et les exports ZIP locaux.",
    },
    { status: 410 },
  );
}
