import type { CSSProperties, ReactNode } from "react";

export type StudioLeftSection =
  | "cloud"
  | "chapters"
  | "blocks"
  | "variables"
  | "items"
  | "logs";

interface StudioLeftNavigationProps {
  activeSection: StudioLeftSection;
  onSectionChange: (section: StudioLeftSection) => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: StudioLeftSection;
  label: string;
  color: string;
  icon: ReactNode;
}> = [
  {
    id: "cloud",
    label: "Compte",
    color: "#34c7a1",
    icon: <path d="M12 5a3.2 3.2 0 1 1 0 6.4A3.2 3.2 0 0 1 12 5Zm-6.5 14c.9-4 3.1-6 6.5-6s5.6 2 6.5 6" />,
  },
  {
    id: "chapters",
    label: "Chapitres valides",
    color: "#8b72e8",
    icon: <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5v-16Zm0 0V19a2 2 0 0 1 2-2h12M9 7h6M9 11h7" />,
  },
  {
    id: "blocks",
    label: "Bibliotheque de blocs",
    color: "#3f8ee8",
    icon: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  },
  {
    id: "variables",
    label: "Variables globales",
    color: "#e58a36",
    icon: <path d="M8 4H5v16h3M16 4h3v16h-3M10 9l4 6M14 9l-4 6" />,
  },
  {
    id: "items",
    label: "Objets histoire",
    color: "#d55d88",
    icon: <path d="M5 8.5 12 4l7 4.5v7L12 20l-7-4.5v-7ZM5 8.5l7 4.5 7-4.5M12 13v7" />,
  },
  {
    id: "logs",
    label: "Journal",
    color: "#e3b341",
    icon: <path d="M6 3h12v18H6V3Zm3 5h6M9 8h6M9 12h6M9 16h4" />,
  },
];

export function StudioLeftNavigation({
  activeSection,
  onSectionChange,
}: StudioLeftNavigationProps) {
  return (
    <nav className="studio-tool-rail" aria-label="Outils du projet">
      {NAV_ITEMS.map((item) => {
        const active = item.id === activeSection;
        return (
          <button
            key={item.id}
            type="button"
            className={`studio-tool-rail-button${active ? " studio-tool-rail-button-active" : ""}`}
            style={{ "--tool-color": item.color } as CSSProperties}
            onClick={() => onSectionChange(item.id)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {item.icon}
            </svg>
            <span className="studio-tool-rail-tooltip" role="tooltip">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
