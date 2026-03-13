"use client";

import { useCallback, useEffect } from "react";
import { SupabaseClient, User } from "@supabase/supabase-js";

import {
  CloudAccessLevel,
  CloudAccessRow,
  CloudLogRow,
  CloudProfileRow,
  PlatformProfileRow,
  PlatformRole,
  CloudProjectRow,
  CloudProjectStateRow,
} from "@/components/author-studio-types";

interface UseCloudProjectSessionParams {
  supabase: SupabaseClient | null;
  allowSelfSignup: boolean;
  authUser: User | null;
  authEmailInput: string;
  authPasswordInput: string;
  platformRole: PlatformRole;
  cloudProjectId: string | null;
  cloudOwnerId: string | null;
  cloudCanWrite: boolean;
  cloudEditingLockUserId: string | null;
  cloudProjects: CloudProjectRow[];
  setStatusMessage: (message: string) => void;
  setCloudBusy: (busy: boolean) => void;
  setCloudAccessLevel: (level: CloudAccessLevel | null) => void;
  setCloudProjectId: (projectId: string | null) => void;
  setCloudOwnerId: (ownerId: string | null) => void;
  setCloudEditingLockUserId: (userId: string | null) => void;
  setCloudProjectUpdatedAt: (value: string | null) => void;
  setCloudLatestUpdatedAt: (value: string | null) => void;
  setCloudAccessRows: (rows: CloudAccessRow[]) => void;
  setCloudLogs: (rows: CloudLogRow[]) => void;
  setCloudProjects: (rows: CloudProjectRow[]) => void;
  setCloudProfiles: (rows: Record<string, CloudProfileRow>) => void;
  setPlatformRole: (role: PlatformRole) => void;
  setPlatformProfiles: (rows: PlatformProfileRow[]) => void;
  setShareEmailInput: (value: string) => void;
}

export function useCloudProjectSession({
  supabase,
  allowSelfSignup,
  authUser,
  authEmailInput,
  authPasswordInput,
  platformRole,
  cloudProjectId,
  cloudOwnerId,
  cloudCanWrite,
  cloudEditingLockUserId,
  cloudProjects,
  setStatusMessage,
  setCloudBusy,
  setCloudAccessLevel,
  setCloudProjectId,
  setCloudOwnerId,
  setCloudEditingLockUserId,
  setCloudProjectUpdatedAt,
  setCloudLatestUpdatedAt,
  setCloudAccessRows,
  setCloudLogs,
  setCloudProjects,
  setCloudProfiles,
  setPlatformRole,
  setPlatformProfiles,
  setShareEmailInput,
}: UseCloudProjectSessionParams) {
  const fetchCloudProfiles = useCallback(
    async (projectId: string) => {
      if (!supabase) return;

      try {
        const { data, error } = await supabase.rpc("project_member_profiles", {
          project_uuid: projectId,
        });

        if (error) {
          setStatusMessage(`Erreur chargement profils: ${error.message}`);
          return;
        }

        const index: Record<string, CloudProfileRow> = {};
        for (const profile of (data ?? []) as CloudProfileRow[]) {
          index[profile.user_id] = profile;
        }
        setCloudProfiles(index);
      } catch {
        // Swallow — profile fetch failure is non-critical.
      }
    },
    [setCloudProfiles, setStatusMessage, supabase],
  );

  const refreshCloudSideData = useCallback(
    async (projectId: string, ownerId: string | null) => {
      if (!supabase) return;

      try {
        const [
          { data: projectData, error: projectError },
          { data: accessData, error: accessError },
          { data: logsData, error: logsError },
        ] = await Promise.all([
          supabase
            .from("author_projects")
            .select("owner_id,editing_lock_user_id,updated_at")
            .eq("id", projectId)
            .single(),
          supabase
            .from("author_project_access")
            .select("user_id,access_level,granted_by,created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: true }),
          supabase
            .from("author_project_logs")
            .select("id,actor_id,action,details,created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        if (projectError) {
          setStatusMessage(`Erreur chargement etat projet cloud: ${projectError.message}`);
        }

        if (accessError) {
          setStatusMessage(`Erreur chargement droits: ${accessError.message}`);
        }

        if (logsError) {
          setStatusMessage(`Erreur chargement logs cloud: ${logsError.message}`);
        }

        const rows = (accessData ?? []) as CloudAccessRow[];
        setCloudAccessRows(rows);
        setCloudLogs((logsData ?? []) as CloudLogRow[]);

        const projectRow = (projectData ?? null) as CloudProjectStateRow | null;
        const resolvedOwnerId = projectRow?.owner_id ?? ownerId ?? null;
        setCloudOwnerId(resolvedOwnerId);
        setCloudEditingLockUserId(projectRow?.editing_lock_user_id ?? null);
        if (projectRow?.updated_at) {
          setCloudLatestUpdatedAt(projectRow.updated_at);
        }

        if (authUser) {
          if (platformRole === "admin" || (resolvedOwnerId && authUser.id === resolvedOwnerId)) {
            setCloudAccessLevel("owner");
          } else {
            const ownRow = rows.find((row) => row.user_id === authUser.id);
            setCloudAccessLevel(ownRow?.access_level ?? null);
          }
        } else {
          setCloudAccessLevel(null);
        }

        await fetchCloudProfiles(projectId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`Erreur rafraichissement cloud: ${msg}`);
      }
    },
    [
      authUser,
      fetchCloudProfiles,
      setCloudAccessLevel,
      setCloudAccessRows,
      setCloudEditingLockUserId,
      setCloudLatestUpdatedAt,
      setCloudLogs,
      setCloudOwnerId,
      setStatusMessage,
      platformRole,
      supabase,
    ],
  );

  const appendCloudLog = useCallback(
    async (projectId: string, action: string, details: string) => {
      if (!supabase || !authUser) return;

      try {
        const { error } = await supabase.from("author_project_logs").insert({
          project_id: projectId,
          actor_id: authUser.id,
          action,
          details,
        });

        if (error) {
          setStatusMessage(`Erreur log cloud: ${error.message}`);
        }
      } catch {
        // Swallow — log failure should not block the main operation.
      }
    },
    [authUser, setStatusMessage, supabase],
  );

  const acquireCloudLock = useCallback(
    async (options?: { forceTakeover?: boolean; silent?: boolean }) => {
      if (!supabase || !authUser || !cloudProjectId) return false;
      if (!cloudCanWrite) return false;

      const { forceTakeover = false, silent = false } = options ?? {};
      try {
        const { data, error } = await supabase.rpc("acquire_project_lock", {
          project_uuid: cloudProjectId,
          force_takeover: forceTakeover,
        });

        if (error) {
          if (!silent) {
            setStatusMessage(`Erreur verrou cloud: ${error.message}`);
          }
          return false;
        }

        const locked = Boolean(data);
        if (!locked) {
          if (!silent) {
            setStatusMessage("Verrou cloud indisponible: un autre auteur edite ce projet.");
          }
          void refreshCloudSideData(cloudProjectId, cloudOwnerId);
          return false;
        }

        setCloudEditingLockUserId(authUser.id);
        void refreshCloudSideData(cloudProjectId, cloudOwnerId);
        if (!silent) {
          void appendCloudLog(cloudProjectId, "lock_acquire_cloud", "Verrou cloud pris");
        }
        return true;
      } catch (err: unknown) {
        if (!silent) {
          const msg = err instanceof Error ? err.message : String(err);
          setStatusMessage(`Erreur verrou cloud: ${msg}`);
        }
        return false;
      }
    },
    [
      appendCloudLog,
      authUser,
      cloudCanWrite,
      cloudOwnerId,
      cloudProjectId,
      refreshCloudSideData,
      setCloudEditingLockUserId,
      setStatusMessage,
      supabase,
    ],
  );

  const releaseCloudLock = useCallback(
    async (options?: { forceRelease?: boolean; silent?: boolean }) => {
      if (!supabase || !authUser || !cloudProjectId) return false;

      const { forceRelease = false, silent = false } = options ?? {};
      try {
        const { data, error } = await supabase.rpc("release_project_lock", {
          project_uuid: cloudProjectId,
          force_release: forceRelease,
        });

        if (error) {
          if (!silent) {
            setStatusMessage(`Erreur liberation verrou cloud: ${error.message}`);
          }
          return false;
        }

        const released = Boolean(data);
        if (!released) {
          if (!silent) {
            setStatusMessage("Liberation verrou cloud refusee.");
          }
          void refreshCloudSideData(cloudProjectId, cloudOwnerId);
          return false;
        }

        setCloudEditingLockUserId(null);
        void refreshCloudSideData(cloudProjectId, cloudOwnerId);
        if (!silent) {
          void appendCloudLog(cloudProjectId, "lock_release_cloud", "Verrou cloud libere");
        }
        return true;
      } catch (err: unknown) {
        if (!silent) {
          const msg = err instanceof Error ? err.message : String(err);
          setStatusMessage(`Erreur liberation verrou: ${msg}`);
        }
        return false;
      }
    },
    [
      appendCloudLog,
      authUser,
      cloudOwnerId,
      cloudProjectId,
      refreshCloudSideData,
      setCloudEditingLockUserId,
      setStatusMessage,
      supabase,
    ],
  );

  const refreshCloudProjects = useCallback(async () => {
    if (!supabase || !authUser) {
      setCloudProjects([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("author_projects")
        .select("id,title,updated_at,owner_id")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        setStatusMessage(`Erreur chargement projets cloud: ${error.message}`);
        return;
      }

      const projects = (data ?? []) as Array<{
        id: string;
        title: string;
        updated_at: string;
        owner_id: string;
      }>;
      const projectIds = projects.map((row) => row.id);
      const accessByProject = new Map<string, CloudAccessLevel>();

      if (projectIds.length > 0) {
        const { data: accessRows, error: accessError } = await supabase
          .from("author_project_access")
          .select("project_id,access_level")
          .eq("user_id", authUser.id)
          .in("project_id", projectIds);

        if (accessError) {
          setStatusMessage(`Erreur chargement acces projets cloud: ${accessError.message}`);
        } else {
          for (const row of (accessRows ?? []) as Array<{
            project_id: string;
            access_level: CloudAccessLevel;
          }>) {
            accessByProject.set(row.project_id, row.access_level);
          }
        }
      }

      const resolvedProjects: CloudProjectRow[] = projects.map((row) => ({
        id: row.id,
        title: row.title,
        updated_at: row.updated_at,
        owner_id: row.owner_id,
        access_level:
          platformRole === "admin"
            ? "owner"
            : row.owner_id === authUser.id
              ? "owner"
              : accessByProject.get(row.id) ?? "read",
      }));

      setCloudProjects(resolvedProjects);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur projets cloud: ${msg}`);
    }
  }, [authUser, platformRole, setCloudProjects, setStatusMessage, supabase]);

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
    const timer = window.setTimeout(() => {
      void refreshCloudProjects();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshCloudProjects]);

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

  useEffect(() => {
    if (!cloudProjectId) {
      setCloudLatestUpdatedAt(null);
      return;
    }

    const currentProject = cloudProjects.find((item) => item.id === cloudProjectId);
    if (!currentProject?.updated_at) return;
    setCloudLatestUpdatedAt(currentProject.updated_at);
  }, [cloudProjectId, cloudProjects, setCloudLatestUpdatedAt]);

  const authUserId = authUser?.id ?? null;
  useEffect(() => {
    if (!cloudProjectId || !authUserId) return;
    const timer = window.setTimeout(() => {
      void refreshCloudSideData(cloudProjectId, cloudOwnerId);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authUserId, cloudOwnerId, cloudProjectId, refreshCloudSideData]);

  const signInWithPassword = useCallback(async () => {
    if (!supabase) {
      setStatusMessage("Supabase non configure.");
      return;
    }

    const email = authEmailInput.trim();
    const password = authPasswordInput;
    if (!email || !password) {
      setStatusMessage("Email et mot de passe requis.");
      return;
    }

    setCloudBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatusMessage(`Erreur connexion Supabase: ${error.message}`);
        return;
      }

      setStatusMessage(`Connecte en tant que ${email}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur connexion: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [authEmailInput, authPasswordInput, setCloudBusy, setStatusMessage, supabase]);

  const signUpWithPassword = useCallback(async () => {
    if (!supabase) {
      setStatusMessage("Supabase non configure.");
      return;
    }
    if (!allowSelfSignup) {
      setStatusMessage(
        "Inscription desactivee sur cette instance. Demande a un admin de creer ou activer ton compte.",
      );
      return;
    }

    const email = authEmailInput.trim();
    const password = authPasswordInput;
    if (!email || !password) {
      setStatusMessage("Email et mot de passe requis pour l'inscription.");
      return;
    }

    setCloudBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setStatusMessage(`Erreur inscription Supabase: ${error.message}`);
        return;
      }

      const identitiesCount = data.user?.identities?.length ?? 0;
      if (data.user && identitiesCount === 0) {
        setStatusMessage(
          "Ce compte existe deja ou a deja ete cree. Utilise le bouton Se connecter.",
        );
        return;
      }

      if (data.session) {
        setStatusMessage(
          "Compte cree et connecte. Ton role par defaut est lecteur; un admin doit t'activer en auteur pour editer.",
        );
        return;
      }

      setStatusMessage(
        "Compte cree. Verifie ton email de confirmation puis utilise Se connecter. Ton role par defaut est lecteur.",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur inscription: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [
    allowSelfSignup,
    authEmailInput,
    authPasswordInput,
    setCloudBusy,
    setStatusMessage,
    supabase,
  ]);

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
        await refreshCloudProjects();
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
      refreshCloudProjects,
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
      if (cloudProjectId && authUser && cloudEditingLockUserId === authUser.id) {
        await releaseCloudLock({ silent: true });
      }
      await supabase.auth.signOut();
    } catch {
      // Best-effort — continue with local state cleanup regardless.
    }
    setCloudAccessLevel(null);
    setCloudProjectId(null);
    setCloudOwnerId(null);
    setCloudEditingLockUserId(null);
    setCloudProjectUpdatedAt(null);
    setCloudLatestUpdatedAt(null);
    setCloudAccessRows([]);
    setCloudLogs([]);
    setCloudProjects([]);
    setCloudProfiles({});
    setPlatformRole("reader");
    setPlatformProfiles([]);
    setShareEmailInput("");
  }, [
    authUser,
    cloudEditingLockUserId,
    cloudProjectId,
    releaseCloudLock,
    setCloudAccessLevel,
    setCloudAccessRows,
    setCloudEditingLockUserId,
    setCloudLatestUpdatedAt,
    setCloudLogs,
    setCloudOwnerId,
    setCloudProfiles,
    setCloudProjectId,
    setCloudProjectUpdatedAt,
    setCloudProjects,
    setPlatformProfiles,
    setPlatformRole,
    setShareEmailInput,
    supabase,
  ]);

  return {
    refreshCloudSideData,
    appendCloudLog,
    acquireCloudLock,
    releaseCloudLock,
    refreshCloudProjects,
    refreshPlatformProfiles,
    setPlatformProfileRole,
    signInWithPassword,
    signUpWithPassword,
    signOutSupabase,
  };
}
