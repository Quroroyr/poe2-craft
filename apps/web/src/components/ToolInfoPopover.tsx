import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ActionModifier, CraftActionRequirements } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ToolInfo } from '@poe2-craft/craft-session';
import type { Translator } from '@/i18n/core';
import { useI18n } from '@/i18n/I18nProvider';
import { consumableIconUrl } from '@/lib/icons';
import { rarityLabel, sourceTitle, toolCategoryLabel } from '@/lib/texts';
import { placeMenu, useDismiss } from './ContextMenu';
import { GameIcon } from './GameIcon';

interface ToolInfoPopoverProps {
  readonly info: ToolInfo;
  readonly view: CraftDbView;
  readonly x: number;
  readonly y: number;
  /** The tile that opened it: a right click there toggles the popover instead of reopening it. */
  readonly owner: Element | null;
  readonly onClose: () => void;
}

/**
 * What a palette tool does — opened by a right click (or Shift+F10 / the menu key) on its tile. It
 * never selects or applies the tool. Text comes from `toolInfo` (craft-session) over the stored
 * descriptions; nothing about mechanics is written here. Placement and closing are the modifier
 * menu's (`placeMenu`, `useDismiss`).
 */
export function ToolInfoPopover(props: ToolInfoPopoverProps) {
  const { info, view, onClose } = props;
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const c = info.consumable;
  const modelled = info.status === 'modelled' || info.status === 'verified';

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPlace(placeMenu(props.x, props.y, width, height, window.innerWidth, window.innerHeight));
  }, [props.x, props.y, info]);
  const placed = place !== null;
  useEffect(() => {
    if (placed) ref.current?.focus();
  }, [placed]);
  useDismiss(ref, onClose, props.owner);

  return createPortal(
    <div
      ref={ref}
      className="tool-info"
      role="dialog"
      aria-label={c.name}
      tabIndex={-1}
      style={place ? { left: place.left, top: place.top } : { left: props.x, top: props.y, visibility: 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="tool-info-head">
        <GameIcon src={consumableIconUrl(c)} label={c.name} size={40} />
        <div>
          <h3 className="tool-info-name">{c.name}</h3>
          <p className="tool-info-meta">
            {toolCategoryLabel(t, c.category)}
            <span className={`tag ${modelled ? 'tag-ok' : 'tag-bad'}`}>{t(`toolInfo.status.${info.status}`)}</span>
          </p>
        </div>
      </header>

      <dl className="tool-info-facts">
        <div>
          <dt>{t('toolInfo.effect')}</dt>
          <dd>{info.effect ?? <span className="muted">{t('toolInfo.noDescription')}</span>}</dd>
        </div>
        {info.actionModifiers.length > 0 && (
          <div>
            <dt>{t('toolInfo.changes')}</dt>
            <dd>{info.actionModifiers.map((m) => actionModifierText(t, m)).join(' ')}</dd>
          </div>
        )}
        {info.worksWith.length > 0 && (
          <div>
            <dt>{t('toolInfo.worksWith')}</dt>
            <dd>{info.worksWith.map((w) => w.name).join(', ')}</dd>
          </div>
        )}
        {info.requirements && (
          <div>
            <dt>{t('toolInfo.requirements')}</dt>
            <dd>{requirementsText(t, info.requirements)}</dd>
          </div>
        )}
        {info.block !== undefined && (
          <div>
            <dt>{t('toolInfo.currentItem')}</dt>
            <dd className={info.block === null ? 'ok' : 'bad'}>
              {info.block === null ? t('toolInfo.applicable') : t('toolInfo.notApplicable', { reason: t(`tools.block.${info.block}`) })}
            </dd>
          </div>
        )}
        {!modelled && (
          <div>
            <dt>{t('toolInfo.statusLabel')}</dt>
            <dd>{t('toolInfo.notModelledYet')}</dd>
          </div>
        )}
      </dl>

      <footer className="tool-info-source">
        {info.modelNote && <p>{info.modelNote}</p>}
        {info.descriptionSource && <p>{t('toolInfo.descriptionSource', { source: info.descriptionSource })}</p>}
        <p>{t('toolInfo.record', { source: sourceTitle(t, view, info.provenance) })}</p>
      </footer>
    </div>,
    document.body,
  );
}

function requirementsText(t: Translator, r: CraftActionRequirements): string {
  const parts = [r.rarities.map((rarity) => rarityLabel(t, rarity)).join(' / ')];
  if (r.uncorrupted) parts.push(t('toolInfo.req.uncorrupted'));
  if (r.unfractured) parts.push(t('toolInfo.req.unfractured'));
  if (r.minModifiers !== undefined) parts.push(t('toolInfo.req.minModifiers', { count: r.minModifiers }));
  if (r.maxModifiers !== undefined) parts.push(t('toolInfo.req.maxModifiers', { count: r.maxModifiers }));
  return parts.join(' · ');
}

function actionModifierText(t: Translator, m: ActionModifier): string {
  switch (m.kind) {
    case 'restrict-side':
      return t(`toolInfo.mod.${m.operation}.${m.side}`);
    case 'extra-mod':
      return t('toolInfo.mod.extra', { count: m.count });
    case 'remove-lowest-level':
      return t('toolInfo.mod.lowestLevel');
  }
}
