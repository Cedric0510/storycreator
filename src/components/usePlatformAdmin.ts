"use client";

import { useCallback, useEffect, useState } from "react";

import { Backend, CreateUserInput } from "@/lib/backend/ports";
import {
  BackendResult,
  PlatformProfile,
  PlatformRole,
  fail,
  ok,
} from "@/lib/backend/types";

interface UsePlatformAdminParams {
  backend: Backend | null;
  /** Active le chargement automatique (utilisateur connecte et admin). */
  enabled: boolean;
}

/**
 * Gestion des comptes plateforme (liste, roles, creation, suppression),
 * adossee a AdminPort. Utilisee par la page /admin et la modale admin du studio.
 */
export function usePlatformAdmin({ backend, enabled }: UsePlatformAdminParams) {
  const [profiles, setProfiles] = useState<PlatformProfile[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);

  const refreshProfiles = useCallback(async (): Promise<BackendResult<PlatformProfile[]>> => {
    if (!backend || !enabled) {
      setProfiles([]);
      return ok([]);
    }
    const result = await backend.admin.listProfiles();
    if (result.ok) {
      setProfiles(result.value);
    }
    return result;
  }, [backend, enabled]);

  useEffect(() => {
    if (!enabled) {
      setProfiles([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshProfiles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, refreshProfiles]);

  const setProfileRole = useCallback(
    async (targetUserId: string, nextRole: PlatformRole): Promise<BackendResult> => {
      if (!backend || !enabled) return fail("forbidden", "Action reservee aux admins connectes.");
      setAdminBusy(true);
      try {
        const result = await backend.admin.setProfileRole(targetUserId, nextRole);
        if (result.ok) await refreshProfiles();
        return result;
      } finally {
        setAdminBusy(false);
      }
    },
    [backend, enabled, refreshProfiles],
  );

  const createUser = useCallback(
    async (input: CreateUserInput): Promise<BackendResult<{ userId: string }>> => {
      if (!backend || !enabled) return fail("forbidden", "Action reservee aux admins connectes.");
      setAdminBusy(true);
      try {
        const result = await backend.admin.createUser(input);
        if (result.ok) await refreshProfiles();
        return result;
      } finally {
        setAdminBusy(false);
      }
    },
    [backend, enabled, refreshProfiles],
  );

  const deleteUser = useCallback(
    async (targetUserId: string): Promise<BackendResult> => {
      if (!backend || !enabled) return fail("forbidden", "Action reservee aux admins connectes.");
      setAdminBusy(true);
      try {
        const result = await backend.admin.deleteUser(targetUserId);
        if (result.ok) await refreshProfiles();
        return result;
      } finally {
        setAdminBusy(false);
      }
    },
    [backend, enabled, refreshProfiles],
  );

  return {
    profiles,
    adminBusy,
    refreshProfiles,
    setProfileRole,
    createUser,
    deleteUser,
  };
}
