"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";

import { PlatformRole } from "@/components/author-studio-types";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function normalizePlatformRole(value: unknown): PlatformRole {
  if (value === "admin") return "admin";
  if (value === "author") return "author";
  return "reader";
}

export function usePortalAuth() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [busy, setBusy] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformRole>("reader");
  const roleRef = useRef<PlatformRole>("reader");

  const refreshPlatformRole = useCallback(async (user: User | null) => {
    if (!supabase || !user) {
      setPlatformRole("reader");
      roleRef.current = "reader";
      return "reader" as const;
    }

    try {
      const { data, error } = await supabase
        .from("author_profiles")
        .select("platform_role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) {
        return roleRef.current;
      }

      const role = normalizePlatformRole(data.platform_role);
      setPlatformRole(role);
      roleRef.current = role;
      return role;
    } catch {
      return roleRef.current;
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;
    let currentUserId: string | null = null;
    const loadingSafety = window.setTimeout(() => {
      if (!cancelled) setAuthLoading(false);
    }, 7000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const user = data.session?.user ?? null;
        currentUserId = user?.id ?? null;
        setAuthUser(user);
        void refreshPlatformRole(user);
      })
      .catch(() => {
        if (!cancelled) {
          setAuthUser(null);
          setPlatformRole("reader");
          roleRef.current = "reader";
        }
      })
      .finally(() => {
        window.clearTimeout(loadingSafety);
        if (!cancelled) setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      const nextUserId = user?.id ?? null;
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        setAuthUser(user);
      }

      if (!user) {
        setPlatformRole("reader");
        roleRef.current = "reader";
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        void refreshPlatformRole(user);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingSafety);
      subscription.unsubscribe();
    };
  }, [refreshPlatformRole, supabase]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { ok: false, error: "Supabase non configure." };
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true as const };
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { ok: false, error: "Supabase non configure." };
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) return { ok: false, error: error.message };
      const identitiesCount = data.user?.identities?.length ?? 0;
      if (data.user && identitiesCount === 0) {
        return {
          ok: false,
          error: "Ce compte existe deja ou a deja ete cree. Utilise la connexion.",
        };
      }
      return { ok: true as const, needsEmailConfirmation: !data.session };
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setAuthUser(null);
      setPlatformRole("reader");
      roleRef.current = "reader";
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  return {
    supabase,
    authLoading,
    authUser,
    platformRole,
    busy,
    refreshPlatformRole,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  };
}
