export type CloudAccessLevel = "owner" | "write" | "read";
export type PlatformRole = "admin" | "author" | "reader";

export interface CloudAccessRow {
  user_id: string;
  access_level: CloudAccessLevel;
  granted_by: string;
  created_at: string;
}

export interface CloudProjectRow {
  id: string;
  title: string;
  updated_at: string;
  owner_id: string;
  access_level: CloudAccessLevel;
}

export interface CloudProjectStateRow {
  owner_id: string;
  editing_lock_user_id: string | null;
  updated_at: string;
}

export interface CloudProfileRow {
  user_id: string;
  email: string | null;
  display_name: string;
}

export interface PlatformProfileRow {
  user_id: string;
  email: string | null;
  display_name: string;
  platform_role: PlatformRole;
  created_at: string;
}

export interface CloudLogRow {
  id: number;
  actor_id: string;
  action: string;
  details: string;
  created_at: string;
}

export interface GameplayPlacementTarget {
  objectId: string;
}
