import type { ReactNode } from 'react';

interface PanelProps {
  readonly title: string;
  readonly aside?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Panel({ title, aside, className, children }: PanelProps) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
