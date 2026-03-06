import { useEffect, useMemo, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";

import {
  CloudAccessLevel,
  CloudAccessRow,
  CloudLogRow,
  PlatformProfileRow,
  PlatformRole,
  CloudProfileRow,
  CloudProjectRow,
} from "@/components/author-studio-types";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export function useCloudProjectState(setStatusMessage: (message: string) => void) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const supabaseProjectRef = useMemo(() => {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!rawUrl) return "n/a";
    try {
      return new URL(rawUrl).hostname.split(".")[0];
    } catch {
      return rawUrl;
    }
  }, []);

  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authEmailInput, setAuthEmailInput] = useState("");
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [cloudOwnerId, setCloudOwnerId] = useState<string | null>(null);
  const [cloudEditingLockUserId, setCloudEditingLockUserId] = useState<string | null>(null);
  const [cloudProjectUpdatedAt, setCloudProjectUpdatedAt] = useState<string | null>(null);
  const [cloudLatestUpdatedAt, setCloudLatestUpdatedAt] = useState<string | null>(null);
  const [cloudAccessLevel, setCloudAccessLevel] = useState<CloudAccessLevel | null>(null);
  const [cloudAccessRows, setCloudAccessRows] = useState<CloudAccessRow[]>([]);
  const [cloudProfiles, setCloudProfiles] = useState<Record<string, CloudProfileRow>>({});
  const [cloudLogs, setCloudLogs] = useState<CloudLogRow[]>([]);
  const [cloudProjects, setCloudProjects] = useState<CloudProjectRow[]>([]);
  const [platformRole, setPlatformRole] = useState<PlatformRole>("reader");
  const [platformProfiles, setPlatformProfiles] = useState<PlatformProfileRow[]>([]);
  const [shareEmailInput, setShareEmailInput] = useState("");
  const [shareAccessLevel, setShareAccessLevel] = useState<"read" | "write">("write");

  // Ref used to keep the last known good role so that a transient network
  // failure (timeout, offline, ...) does NOT demote the user to "reader" and
  // disable the save button permanently.
  const platformRoleRef = useRef<PlatformRole>("reader");

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    /**
     * Fetch the platform role from the DB.
     *
     * `isInitial` = true means this is the first call right after page load.
     * On first load we MUST fall back to "reader" if the query fails because
     * there is no previous good value to keep.
     * On subsequent calls (TOKEN_REFRESHED, visibility change) we keep the
     * last known good value instead of demoting to "reader".
     */
    const refreshOwnPlatformRole = async (user: User | null, isInitial = false) => {
      if (!supabase || !user) {
        setPlatformRole("reader");
        platformRoleRef.current = "reader";
        return;
      }

      try {
        const { data, error } = await supabase
          .from("author_profiles")
          .select("platform_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          // DB returned an error — might be transient.
          // Keep latest known role unless this is the very first load.
          if (isInitial) {
            setPlatformRole("reader");
            platformRoleRef.current = "reader";
          }
          // else: keep existing platformRole untouched
          return;
        }

        if (!data) {
          // Profile truly doesn't exist in the DB — this is NOT transient.
          setStatusMessage(
            "Profil utilisateur introuvable. Contacte un administrateur pour finaliser ton acces.",
          );
          setPlatformRole("reader");
          platformRoleRef.current = "reader";
          return;
        }

        const role: PlatformRole =
          data.platform_role === "admin"
            ? "admin"
            : data.platform_role === "author"
              ? "author"
              : "reader";
        setPlatformRole(role);
        platformRoleRef.current = role;
      } catch {
        // Network / timeout / AbortError — keep the last known good role.
        if (isInitial) {
          setPlatformRole("reader");
          platformRoleRef.current = "reader";
        }
        // else: keep existing platformRole untouched — do NOT demote.
      }
    };

    // Track the current user ID so we only update state when the user
    // actually changes (avoid cascading re-renders on TOKEN_REFRESHED that
    // creates a new User object reference every time).
    let currentUserId: string | null = null;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStatusMessage(`Erreur session Supabase: ${error.message}`);
        }
        const user = data.session?.user ?? null;
        currentUserId = user?.id ?? null;
        setAuthUser(user);
        if (user) {
          await refreshOwnPlatformRole(user, /* isInitial */ true);
        } else {
          setPlatformRole("reader");
          platformRoleRef.current = "reader";
          setPlatformProfiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      const userId = user?.id ?? null;

      // Only update authUser state if the user actually changed (different
      // user ID or signed-out).  TOKEN_REFRESHED just gives us a new JWT for
      // the same user — no need to cascade React state updates.
      if (userId !== currentUserId) {
        currentUserId = userId;
        setAuthUser(user);
      }

      if (!user) {
        setPlatformRole("reader");
        platformRoleRef.current = "reader";
        setPlatformProfiles([]);
        return;
      }

      // Only re-query the DB role on real auth events, NOT on token refresh.
      // TOKEN_REFRESHED fires every ~30-55 min; the user's DB role hasn't
      // changed just because the JWT got a fresh signature.
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        await refreshOwnPlatformRole(user, event === "INITIAL_SESSION");
      }
    });

    // Proactively refresh the session when the tab becomes visible again.
    // This covers cases where the computer went to sleep or the tab was
    // in the background long enough for the JWT to expire without being
    // auto-refreshed by the internal timer.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.refreshSession().catch(() => {
          /* swallow — onAuthStateChange will handle SIGNED_OUT if needed */
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [setStatusMessage, supabase]);

  return {
    supabase,
    supabaseProjectRef,
    authLoading,
    authUser,
    authEmailInput,
    authPasswordInput,
    cloudBusy,
    cloudProjectId,
    cloudOwnerId,
    cloudEditingLockUserId,
    cloudProjectUpdatedAt,
    cloudLatestUpdatedAt,
    cloudAccessLevel,
    cloudAccessRows,
    cloudProfiles,
    cloudLogs,
    cloudProjects,
    platformRole,
    platformProfiles,
    shareEmailInput,
    shareAccessLevel,
    setAuthEmailInput,
    setAuthPasswordInput,
    setCloudBusy,
    setCloudProjectId,
    setCloudOwnerId,
    setCloudEditingLockUserId,
    setCloudProjectUpdatedAt,
    setCloudLatestUpdatedAt,
    setCloudAccessLevel,
    setCloudAccessRows,
    setCloudProfiles,
    setCloudLogs,
    setCloudProjects,
    setPlatformRole,
    setPlatformProfiles,
    setShareEmailInput,
    setShareAccessLevel,
  };
}
