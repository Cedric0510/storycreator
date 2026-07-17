export type PlatformRole = "admin" | "author" | "reader";

export interface PlatformProfileRow {
  user_id: string;
  email: string | null;
  display_name: string;
  platform_role: PlatformRole;
  created_at: string;
}

export interface GameplayPlacementTarget {
  objectId: string;
}
