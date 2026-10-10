import type { ReactNode } from "react";

/** Every tab's outer layout: a title row (with optional right-aligned
 *  meta, e.g. "3/7 completed") above the tab's sections. */
export function Page({ title, meta, children }: { title: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="page">
      <header className="page-header">
        <h2 className="page-title">{title}</h2>
        {meta && <span className="text-muted">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

/** A titled group within a page. */
export function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="section">
      {title && <h3 className="section-title">{title}</h3>}
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
