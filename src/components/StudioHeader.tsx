"use client";

import Image from "next/image";
import { ReactNode, useEffect, useRef, useState } from "react";

import { HelpHint } from "@/components/HelpHint";

type MenuIconName = "account" | "admin" | "new" | "preview" | "export" | "import";

interface StudioHeaderProps {
  hasUnsavedChanges: boolean;
  validationControl: ReactNode;
  lockHolderName: string | null;
  authInitial: string;
  authEmail: string | null;
  showAccount: boolean;
  showAdmin: boolean;
  canCreateProject: boolean;
  canPreview: boolean;
  canExport: boolean;
  canImport: boolean;
  isImporting: boolean;
  onOpenAccount: () => void;
  onOpenAdmin: () => void;
  onNewProject: () => void;
  onPreview: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function StudioHeader({
  hasUnsavedChanges,
  validationControl,
  lockHolderName,
  authInitial,
  authEmail,
  showAccount,
  showAdmin,
  canCreateProject,
  canPreview,
  canExport,
  canImport,
  isImporting,
  onOpenAccount,
  onOpenAdmin,
  onNewProject,
  onPreview,
  onExport,
  onImport,
}: StudioHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <header className="studio-header">
      <div className="studio-header-title">
        <Image src="/ui-assets/logo/crlogo.png" alt="CadaRium" className="studio-brand-icon" width={88} height={88} priority />
        <h1 className="studio-brand-name">CadaRium <em>Studio</em></h1>
        <HelpHint title="Studio auteur">
          Espace de creation de light novel: construis les blocs, relie-les dans le graphe,
          valide puis exporte JSON + assets.
        </HelpHint>
      </div>

      <div className="studio-header-actions">
        <div className="nav-indicators">
          <span className="nav-indicator" title={hasUnsavedChanges ? "Modifications non sauvegardees" : "Projet a jour"}>
            <span className={`nav-indicator-dot ${hasUnsavedChanges ? "nav-indicator-dot-unsaved" : "nav-indicator-dot-saved"}`} />
            {hasUnsavedChanges ? "Non sauvegarde" : "A jour"}
          </span>
          {validationControl}
          {lockHolderName && <span className="nav-indicator nav-indicator-lock">Verrou : {lockHolderName}</span>}
        </div>

        <span className={`nav-user-avatar${authEmail ? " nav-user-avatar-active" : ""}`} title={authEmail ?? "Aucun compte connecte"}>
          {authInitial}
        </span>

        <div className="studio-main-menu" ref={menuRef}>
          <button
            type="button"
            className="studio-menu-trigger"
            aria-label={open ? "Fermer le menu principal" : "Ouvrir le menu principal"}
            aria-expanded={open}
            aria-controls="studio-main-menu-panel"
            onClick={() => setOpen((current) => !current)}
          >
            <span aria-hidden="true" className="studio-menu-trigger-lines"><i /><i /><i /></span>
          </button>

          {open && (
            <nav id="studio-main-menu-panel" className="studio-menu-panel" aria-label="Actions du studio">
              <MenuGroup label="Projet">
                <MenuItem icon="new" label="Nouveau projet" disabled={!canCreateProject} onClick={() => runAction(onNewProject)} />
                <MenuItem icon="import" label={isImporting ? "Import en cours..." : "Import ZIP"} disabled={!canImport} onClick={() => runAction(onImport)} />
                <MenuItem icon="export" label="Export ZIP" accent disabled={!canExport} onClick={() => runAction(onExport)} />
              </MenuGroup>
              <MenuGroup label="Tester">
                <MenuItem icon="preview" label="Preview" disabled={!canPreview} onClick={() => runAction(onPreview)} />
              </MenuGroup>
              {(showAccount || showAdmin) && (
                <MenuGroup label="Utilisateur">
                  {showAccount && <MenuItem icon="account" label="Compte" onClick={() => runAction(onOpenAccount)} />}
                  {showAdmin && <MenuItem icon="admin" label="Administration" onClick={() => runAction(onOpenAdmin)} />}
                </MenuGroup>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return <section className="studio-menu-group"><h2>{label}</h2>{children}</section>;
}

function MenuItem({ icon, label, accent = false, disabled = false, onClick }: { icon: MenuIconName; label: string; accent?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`studio-menu-item${accent ? " studio-menu-item-export" : ""}`} disabled={disabled} onClick={onClick}>
      <MenuIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function MenuIcon({ name }: { name: MenuIconName }) {
  const paths: Record<MenuIconName, ReactNode> = {
    account: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></>,
    admin: <><path d="M12 3l7 3v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
    new: <><path d="M4 5h7l2 2h7v12H4z" /><path d="M12 10v6M9 13h6" /></>,
    preview: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" /></>,
    export: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
    import: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  };
  return <svg className="studio-menu-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
