"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Backend, SignUpOutcome } from "@/lib/backend/ports";
import { getBrowserBackend } from "@/lib/backend/browserBackend";
import { AuthorUser, BackendResult, PlatformRole, fail } from "@/lib/backend/types";

interface UseAuthOptions {
  /** Notifications non bloquantes (ex: profil introuvable). */
  onNotice?: (message: string) => void;
}

export interface UseAuthResult {
  backend: Backend | null;
  /** false quand le backend n'est pas configure (mode degrade). */
  backendReady: boolean;
  authLoading: boolean;
  user: AuthorUser | null;
  role: PlatformRole;
  isAdmin: boolean;
  canUseAuthorTools: boolean;
  busy: boolean;
  signIn: (email: string, password: string) => Promise<BackendResult>;
  signUp: (email: string, password: string) => Promise<BackendResult<SignUpOutcome>>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<BackendResult>;
  requestPasswordReset: (email: string) => Promise<BackendResult>;
}

/**
 * Session d'authentification unifiee (portail + studio), adossee a AuthPort.
 *
 * Robustesse role: en cas d'erreur transitoire (reseau, timeout) apres le
 * chargement initial, on conserve le dernier role connu au lieu de retrograder
 * l'utilisateur en `reader` (ce qui desactiverait ses outils).
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthResult {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [backendResolved, setBackendResolved] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthorUser | null>(null);
  const [role, setRole] = useState<PlatformRole>("reader");
  const [busy, setBusy] = useState(false);

  const roleRef = useRef<PlatformRole>("reader");
  const noticeRef = useRef(options.onNotice);
  useEffect(() => {
    noticeRef.current = options.onNotice;
  }, [options.onNotice]);

  useEffect(() => {
    setBackend(getBrowserBackend());
    setBackendResolved(true);
  }, []);

  useEffect(() => {
    if (!backendResolved) return;
    if (!backend) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;
    // Cle d'identite incluant les metadonnees affichees: un changement de
    // mustChangePassword (apres updateUser) doit rafraichir l'etat React
    // meme si l'utilisateur reste le meme.
    let currentUserKey: string | null = null;
    const userKey = (candidate: AuthorUser | null) =>
      candidate ? `${candidate.id}:${candidate.email ?? ""}:${candidate.mustChangePassword}` : null;

    const applyRole = (next: PlatformRole) => {
      setRole(next);
      roleRef.current = next;
    };

    const refreshRole = async (nextUser: AuthorUser | null, isInitial: boolean) => {
      if (!nextUser) {
        applyRole("reader");
        return;
      }

      const outcome = await backend.auth.fetchMyRole(nextUser.id);
      if (cancelled) return;

      if (outcome.status === "ok") {
        applyRole(outcome.role);
        return;
      }
      if (outcome.status === "missing") {
        noticeRef.current?.(
          "Profil utilisateur introuvable. Contacte un administrateur pour finaliser ton acces.",
        );
        applyRole("reader");
        return;
      }
      // Erreur transitoire: au chargement initial il n'y a pas de "dernier role
      // connu", on retombe sur reader; ensuite on garde le role courant.
      if (isInitial) {
        applyRole("reader");
      }
    };

    const loadingSafety = window.setTimeout(() => {
      if (!cancelled) setAuthLoading(false);
    }, 7000);

    backend.auth
      .getCurrentUser()
      .then(async (initialUser) => {
        if (cancelled) return;
        currentUserKey = userKey(initialUser);
        setUser(initialUser);
        await refreshRole(initialUser, true);
      })
      .finally(() => {
        window.clearTimeout(loadingSafety);
        if (!cancelled) setAuthLoading(false);
      });

    const unsubscribe = backend.auth.onAuthStateChange((nextUser, event) => {
      const nextUserKey = userKey(nextUser);

      // Ne mettre a jour l'etat React que si l'utilisateur change reellement:
      // un refresh de token renvoie le meme utilisateur avec une nouvelle
      // reference objet, inutile de propager un re-render en cascade.
      if (nextUserKey !== currentUserKey) {
        currentUserKey = nextUserKey;
        setUser(nextUser);
      }

      if (!nextUser) {
        applyRole("reader");
        return;
      }

      if (event === "signed_in" || event === "initial" || event === "password_recovery") {
        void refreshRole(nextUser, event === "initial");
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingSafety);
      unsubscribe();
    };
  }, [backend, backendResolved]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<BackendResult> => {
      if (!backend) return fail("server", "Backend non configure.");
      setBusy(true);
      try {
        return await backend.auth.signIn(email, password);
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<BackendResult<SignUpOutcome>> => {
      if (!backend) return fail("server", "Backend non configure.");
      setBusy(true);
      try {
        return await backend.auth.signUp(email, password);
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  const signOut = useCallback(async () => {
    if (!backend) return;
    setBusy(true);
    try {
      await backend.auth.signOut();
      setUser(null);
      setRole("reader");
      roleRef.current = "reader";
    } finally {
      setBusy(false);
    }
  }, [backend]);

  const changePassword = useCallback(
    async (newPassword: string): Promise<BackendResult> => {
      if (!backend) return fail("server", "Backend non configure.");
      setBusy(true);
      try {
        return await backend.auth.changePassword(newPassword);
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<BackendResult> => {
      if (!backend) return fail("server", "Backend non configure.");
      setBusy(true);
      try {
        return await backend.auth.requestPasswordReset(email);
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  return {
    backend,
    backendReady: Boolean(backend),
    authLoading,
    user,
    role,
    isAdmin: role === "admin",
    canUseAuthorTools: role === "admin" || role === "author",
    busy,
    signIn,
    signUp,
    signOut,
    changePassword,
    requestPasswordReset,
  };
}
