import type { ReactNode } from 'react';

interface PanelProps {
  readonly title: string;
  /** Position in the workflow (1 source … 7 spending); drawn as a numbered seal. */
  readonly index?: number;
  /** Header controls on the right (buttons, selects, badges). */
  readonly aside?: ReactNode;
  /** ornate: the gilded frame of the current item. */
  readonly variant?: 'plain' | 'ornate';
  readonly className?: string;
  readonly children: ReactNode;
}

export function Panel({ title, index, aside, variant = 'plain', className, children }: PanelProps) {
  return (
    <section className={`panel panel-${variant}${className ? ` ${className}` : ''}`}>
      <header className="panel-head">
        <h2>
          {index !== undefined && (
            <span className="panel-seal" aria-hidden>
              {index}
            </span>
          )}
          {title}
        </h2>
        {aside && <div className="panel-aside">{aside}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
