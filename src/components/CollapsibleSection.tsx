"use client";

import { ReactNode, useCallback, useState } from "react";

interface CollapsibleSectionProps {
  storageKey: string;
  title: string;
  children: ReactNode;
  /** Extra elements rendered next to the title (e.g. HelpHint). */
  headerExtra?: ReactNode;
  /** Start collapsed when no localStorage value exists. */
  defaultCollapsed?: boolean;
}

export function CollapsibleSection({
  storageKey,
  title,
  children,
  headerExtra,
  defaultCollapsed = false,
}: CollapsibleSectionProps) {
  const fullKey = `section-collapsed-${storageKey}`;

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return defaultCollapsed;
    try {
      const stored = localStorage.getItem(fullKey);
      return stored !== null ? stored === "true" : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(fullKey, String(next));
      } catch {
        /* quota exceeded — ignore */
      }
      return next;
    });
  }, [fullKey]);

  return (
    <section className="panel-section">
      <div
        className="collapsible-header"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span className={`collapsible-chevron${collapsed ? "" : " collapsible-chevron-open"}`}>
          ▸
        </span>
        <div className="title-with-help">
          <h2>{title}</h2>
          {headerExtra}
        </div>
      </div>
      {!collapsed && children}
    </section>
  );
}
