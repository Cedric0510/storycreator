import { ReactNode } from "react";

interface EditorGroupProps {
  title: string;
  icon: string;
  children: ReactNode;
  kind?: "scene" | "content" | "logic" | "navigation" | "appearance";
}

export function EditorGroup({ title, icon, children, kind = "content" }: EditorGroupProps) {
  return (
    <section className={`editor-group editor-group-${kind}`}>
      <h4 className="editor-group-title"><span aria-hidden="true">{icon}</span>{title}</h4>
      <div className="editor-group-content">{children}</div>
    </section>
  );
}
