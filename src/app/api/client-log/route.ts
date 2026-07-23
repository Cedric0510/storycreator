import { NextRequest, NextResponse } from "next/server";

import { isRateLimited, jsonError } from "@/lib/server/httpGuards";

/**
 * Reception des erreurs survenues dans le navigateur des utilisateurs.
 *
 * Sans cette route, une erreur cote client est invisible: elle se produit sur
 * la machine de l'utilisateur et n'atteint jamais les logs serveur. Ici on la
 * reecrit dans stdout, donc dans les logs Vercel (attention: retention courte
 * selon le plan). Le backend maison pourra brancher un stockage durable.
 *
 * Route anonyme (une erreur peut survenir avant connexion): pas de token,
 * mais rate limit par IP et payload strictement borne.
 */

const MAX_FIELD_LENGTH = 4_000;
const MAX_BODY_LENGTH = 20_000;

interface ClientLogPayload {
  kind?: string;
  message?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  digest?: string;
}

function clip(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.length > MAX_FIELD_LENGTH ? `${value.slice(0, MAX_FIELD_LENGTH)}…` : value;
}

export async function POST(request: NextRequest) {
  if (isRateLimited(request)) {
    return jsonError("Trop de requetes. Reessaie dans une minute.", 429);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonError("Payload illisible.");
  }
  if (raw.length > MAX_BODY_LENGTH) {
    return jsonError("Payload trop volumineux.", 413);
  }

  let payload: ClientLogPayload;
  try {
    payload = JSON.parse(raw) as ClientLogPayload;
  } catch {
    return jsonError("Payload JSON invalide.");
  }

  const entry = {
    kind: clip(payload.kind) ?? "unknown",
    message: clip(payload.message) ?? "(sans message)",
    stack: clip(payload.stack),
    url: clip(payload.url),
    userAgent: clip(payload.userAgent),
    digest: clip(payload.digest),
    receivedAt: new Date().toISOString(),
  };

  console.error("[client-error]", JSON.stringify(entry));

  return NextResponse.json({ ok: true });
}
