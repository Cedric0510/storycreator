import { BackendErrorKind, errorKindFromHttpStatus } from "./types";

export class CadariumApiError extends Error {
  constructor(
    readonly kind: BackendErrorKind,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string | null;
  body?: unknown;
}

export class CadariumApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers({ accept: "application/json" });
    if (options.body !== undefined) headers.set("content-type", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      if (!response.ok) throw await this.toApiError(response);
      if (response.status === 204) return undefined as T;
      return await response.json() as T;
    } catch (error) {
      if (error instanceof CadariumApiError) throw error;
      throw new CadariumApiError("network", "Backend Cadarium inaccessible.", 0);
    }
  }

  private async toApiError(response: Response): Promise<CadariumApiError> {
    const payload = await response.json().catch(() => null) as { code?: string; message?: string } | null;
    return new CadariumApiError(
      errorKindFromHttpStatus(response.status),
      payload?.message ?? messageForCode(payload?.code),
      response.status,
    );
  }
}

function messageForCode(code: string | undefined): string {
  if (code === "invalid_credentials") return "Identifiants invalides.";
  if (code === "invalid_session") return "Session expirée. Reconnecte-toi.";
  if (code === "self_signup_disabled") return "Inscription désactivée sur cette instance.";
  if (code === "email_taken") return "Un compte existe déjà pour cet email.";
  if (code === "invalid_email") return "Email invalide.";
  if (code === "invalid_password") return "Le mot de passe doit contenir au moins 8 caractères.";
  return "La requête Cadarium a échoué.";
}
