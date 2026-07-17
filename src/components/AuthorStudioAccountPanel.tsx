import Link from "next/link";

import { PlatformRole } from "@/lib/backend/types";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { HelpHint } from "@/components/HelpHint";

interface AuthorStudioAccountPanelProps {
  supabaseEnabled: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  authEmail: string | null;
  platformRole: PlatformRole;
}

export function AuthorStudioAccountPanel({
  supabaseEnabled,
  authLoading,
  isAuthenticated,
  authEmail,
  platformRole,
}: AuthorStudioAccountPanelProps) {
  return (
    <aside className="panel panel-cloud">
      <CollapsibleSection
        storageKey="cloud-connection"
        title="Compte"
        headerExtra={
          <HelpHint title="Compte">
            Etat de la connexion au compte. Les projets se sauvegardent en local
            avec Export ZIP et se reprennent avec Import ZIP.
          </HelpHint>
        }
      >
        {!supabaseEnabled && (
          <p className="empty-placeholder">
            Configure `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou
            `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
          </p>
        )}

        {supabaseEnabled && authLoading && <p>Chargement session...</p>}

        {supabaseEnabled && !authLoading && !isAuthenticated && (
          <div className="subsection">
            <p className="empty-placeholder">
              Connecte-toi depuis la page d&apos;accueil pour acceder au studio.
            </p>
            <Link className="button-secondary" href="/">
              Aller a la connexion
            </Link>
          </div>
        )}

        {supabaseEnabled && !authLoading && isAuthenticated && (
          <div className="subsection">
            <p>
              Connecte: <strong>{authEmail ?? "compte sans email"}</strong>{" "}
              <span className="chip chip-start">{platformRole}</span>
            </p>
            <p className="empty-placeholder">
              Sauvegarde en ligne desactivee. Les projets se sauvegardent avec
              Export ZIP et se reprennent avec Import ZIP.
            </p>
          </div>
        )}
      </CollapsibleSection>
    </aside>
  );
}
