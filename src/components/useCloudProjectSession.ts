"use client";

import { useCallback, useEffect } from "react";
import { SupabaseClient, User } from "@supabase/supabase-js";

import {
  PlatformProfileRow,
  PlatformRole,
} from "@/components/author-studio-types";

interface UseCloudProjectSessionParams {
  supabase: SupabaseClient | null;
  authUser: User | null;
  platformRole: PlatformRole;
  setStatusMessage: (message: string) => void;
  setCloudBusy: (busy: boolean) => void;
  setPlatformRole: (role: PlatformRole) => void;
  setPlatformProfiles: (rows: PlatformProfileRow[]) => void;
}

export function useCloudProjectSession({
  supabase,
  authUser,
  platformRole,
  setStatusMessage,
  setCloudBusy,
  setPlatformRole,
  setPlatformProfiles,
}: UseCloudProjectSessionParams) {
  const refreshPlatformProfiles = useCallback(async () => {
    if (!supabase || !authUser || platformRole !== "admin") {
      setPlatformProfiles([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("platform_list_profiles");
      if (error) {
        setStatusMessage(`Erreur chargement profils plateforme: ${error.message}`);
        return;
      }

      const rows: PlatformProfileRow[] = ((data ?? []) as PlatformProfileRow[]).map((row) => ({
        ...row,
        platform_role:
          row.platform_role === "admin"
            ? "admin"
            : row.platform_role === "author"
              ? "author"
              : "reader",
      }));
      setPlatformProfiles(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur profils plateforme: ${msg}`);
    }
  }, [authUser, platformRole, setPlatformProfiles, setStatusMessage, supabase]);

  useEffect(() => {
    if (!authUser || platformRole !== "admin") {
      setPlatformProfiles([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshPlatformProfiles();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authUser, platformRole, refreshPlatformProfiles, setPlatformProfiles]);

  const setPlatformProfileRole = useCallback(
    async (targetUserId: string, nextRole: PlatformRole) => {
      if (!supabase || !authUser || platformRole !== "admin") return false;

      setCloudBusy(true);
      try {
        const { data, error } = await supabase.rpc("platform_set_profile_role", {
          target_user: targetUserId,
          next_role: nextRole,
        });

        if (error) {
          setStatusMessage(`Erreur mise a jour role plateforme: ${error.message}`);
          return false;
        }

        if (!data) {
          setStatusMessage("Mise a jour role refusee.");
          return false;
        }

        if (targetUserId === authUser.id) {
          setPlatformRole(nextRole);
        }

        await refreshPlatformProfiles();
        setStatusMessage(`Role plateforme mis a jour: ${nextRole}.`);
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`Erreur role plateforme: ${msg}`);
        return false;
      } finally {
        setCloudBusy(false);
      }
    },
    [
      authUser,
      platformRole,
      refreshPlatformProfiles,
      setCloudBusy,
      setPlatformRole,
      setStatusMessage,
      supabase,
    ],
  );

  const signOutSupabase = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // Best-effort — continue with local state cleanup regardless.
    }
    setPlatformRole("reader");
    setPlatformProfiles([]);
  }, [setPlatformProfiles, setPlatformRole, supabase]);

  return {
    refreshPlatformProfiles,
    setPlatformProfileRole,
    signOutSupabase,
  };
}
