"use client";

import { ReactNode, useState } from "react";

interface InspectorSectionProps {
  title: string;
  icon: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function InspectorSection({ title, icon, children, defaultOpen = true }: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="inspector-section">
      <button type="button" className="inspector-section-trigger" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="inspector-section-icon" aria-hidden="true">{icon}</span>
        <span>{title}</span>
        <span className={`inspector-section-chevron${open ? " inspector-section-chevron-open" : ""}`} aria-hidden="true">›</span>
      </button>
      {open && <div className="inspector-section-content">{children}</div>}
    </section>
  );
}
