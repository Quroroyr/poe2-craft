import type { ReactNode } from 'react';

interface PanelProps {
  readonly title: string;
  readonly step?: string;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}

export function Panel({ title, step, aside, children }: PanelProps) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>
          {step && <span className="panel-step">{step}</span>}
          {title}
        </h2>
        {aside}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
