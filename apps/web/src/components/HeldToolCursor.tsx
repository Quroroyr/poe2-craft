import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import type { HeldTool } from '@/lib/held-tool';
import { Icon } from './Icon';

interface HeldToolCursorProps {
  readonly tool: HeldTool;
  /** Changes on every click; restarts the short "spent" pulse of the held icon. */
  readonly pulseKey: number;
}

/**
 * The currency the pointer holds, drawn next to the pointer inside the craft zone. Purely visual:
 * `pointer-events: none`, hidden from assistive tech, no handlers — clicks go through it to the
 * item underneath. The parent moves it by writing `transform` on the forwarded element.
 */
export const HeldToolCursor = forwardRef<HTMLDivElement, HeldToolCursorProps>(function HeldToolCursor(props, ref) {
  if (typeof document === 'undefined') return null;
  return createPortal(<HeldToolGlyph ref={ref} {...props} />, document.body);
});

/** The overlay's markup, without the portal (rendered on its own in tests). */
export const HeldToolGlyph = forwardRef<HTMLDivElement, HeldToolCursorProps>(function HeldToolGlyph(
  { tool, pulseKey },
  ref,
) {
  const [main, ...extras] = tool.icons;
  return (
    <div ref={ref} className={`held-cursor held-${tool.state}`} aria-hidden="true" data-held-cursor>
      <div className="held-stack" key={pulseKey}>
        {main?.src && <img className="held-main" src={main.src} alt="" width={44} height={44} draggable={false} />}
        {extras.map((icon) =>
          icon.src ? (
            <img key={icon.name} className="held-extra" src={icon.src} alt="" width={26} height={26} draggable={false} />
          ) : null,
        )}
        {tool.state === 'blocked' && (
          <span className="held-ban">
            <Icon name="ban" size={18} />
          </span>
        )}
      </div>
      {tool.state === 'blocked' && tool.reason && <span className="held-reason">{tool.reason}</span>}
    </div>
  );
});
