import { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function forward(request: NextRequest, context: RouteContext): Promise<Response> {
  const baseUrl = process.env.CADARIUM_API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) {
    return Response.json({ code: "backend_not_configured" }, { status: 503 });
  }

  const { path } = await context.params;
  const target = `${baseUrl}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");
  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);

  try {
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const response = await fetch(target, { method: request.method, headers, body, cache: "no-store" });
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ code: "backend_unreachable", message: "Backend Cadarium inaccessible." }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
