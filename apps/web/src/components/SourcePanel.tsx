import { useState } from 'react';
import type { AffixSide, ExplicitModifier, ItemBaseId, ItemState, Rarity } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import {
  removeSourceModifier,
  replaceSourceModifier,
  setItemLevel,
  setQuality,
  setRarity,
  setSlotCount,
  setSourceModifierFractured,
  setupRarities,
  slotCount,
} from '@poe2-craft/craft-session';
import type { ExplorerMode, SourceSetupView } from '@/lib/analyze';
import { useI18n } from '@/i18n/I18nProvider';
import { exclusionsText, itemCategoryLabel, rarityLabel, slotLabel, sourceTitle } from '@/lib/texts';
import { Stepper } from './Controls';
import { ModMoreButton } from './ModMoreButton';
import { Icon } from './Icon';
import { ArtFrame } from './ItemBits';
import { Panel } from './Panel';

interface SourcePanelProps {
  readonly source: ItemState | null;
  readonly view: CraftDbView;
  readonly setup: SourceSetupView | null;
  readonly explorerMode: ExplorerMode;
  /** Crafting already started: a source edit will need Reset to reach the current item. */
  readonly craftStarted: boolean;
  /** Initial item setup of the source. Never crafting, never counted as spending. */
  readonly onEdit: (source: ItemState) => void;
  readonly onExplore: (mode: ExplorerMode) => void;
  readonly onChooseBase: (baseId: ItemBaseId) => void;
  readonly onOpenCatalog: () => void;
  readonly onClear: () => void;
  /** Opens the modifier context menu of the source modifier at `index`. */
  readonly onModMenu: (index: number, x: number, y: number) => void;
  readonly menuIndex: number | null;
}

/**
 * - base:   class, base and item settings with compact modifier chips (default);
 * - manual: the same plus the detailed editor of every starting modifier.
 * Importing from the game is the shared entry flow (Ctrl+V / Import), not a mode of this panel.
 */
type SourceMode = 'base' | 'manual';

const MODES: readonly SourceMode[] = ['base', 'manual'];

/** Source builder: base, rarity, item level, quality, slots, starting modifiers and their fractured state. */
export function SourcePanel(props: SourcePanelProps) {
  const { source, view, setup } = props;
  const { t } = useI18n();
  const [mode, setMode] = useState<SourceMode>('base');

  return (
    <Panel
      title={t('source.title')}
      className="panel-source"
      aside={
        <button type="button" className="btn btn-small" onClick={props.onClear} disabled={!source || source.explicits.length === 0}>
          <Icon name="reset" size={14} />
          {t('source.clearMods')}
        </button>
      }
    >
      <div className="mode-row">
        <div className="segmented segmented-wide" role="tablist" aria-label={t('source.modes')}>
          {MODES.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {t(m === 'base' ? 'source.mode.base' : 'source.mode.manual')}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn icon-btn-gold" aria-label={t('source.catalog')} title={t('source.catalog')} onClick={props.onOpenCatalog}>
          <Icon name="book" size={16} />
        </button>
      </div>

      {!source ? (
        <div className="source-empty">
          <p>{t('source.emptyText')}</p>
          <button type="button" className="btn btn-primary" onClick={props.onOpenCatalog}>
            {t('source.emptyAction')}
          </button>
        </div>
      ) : (
        <>
          <SourceSetup {...props} source={source} />
          <div className="source-affixes">
            {(['prefix', 'suffix'] as const).map((side) => (
              <AffixColumn key={side} side={side} {...props} source={source} detailed={mode === 'manual'} />
            ))}
          </div>
          {unresolvedOf(source, view).length > 0 && (
            <p className="state-box state-warn">
              {t('source.unresolvedLines', { lines: unresolvedOf(source, view).map((m) => m.sourceText).join('; ') })}
            </p>
          )}
        </>
      )}
      <p className="hint">
        {t('source.hint')}
        {props.craftStarted && ` ${t('source.hintStarted')}`}
        {setup && setup.fields && (setup.fields.quality || setup.fields.slots.length > 0) && ` ${t('source.hintQuality')}`}
      </p>
    </Panel>
  );
}

function unresolvedOf(source: ItemState, view: CraftDbView): ExplicitModifier[] {
  return source.explicits.filter((m) => m.kind === 'unresolved' || !view.getModifier(m.modifierId));
}

function SourceSetup(props: SourcePanelProps & { source: ItemState }) {
  const { source, view } = props;
  const { t } = useI18n();
  const fields = props.setup?.fields ?? null;
  const base = fields?.base;
  const itemClass = base ? view.getItemClass(base.itemClassId) : undefined;
  const classes = view.listItemClasses();
  const categories = [...new Set(classes.map((c) => c.category ?? 'other'))];
  const category = itemClass?.category ?? categories[0] ?? 'other';
  const basesOfClass = view.listBases().filter((b) => b.itemClassId === itemClass?.id);
  const requirements = base?.details?.requirements;
  const firstBaseOf = (classId: string) => view.listBases().find((b) => b.itemClassId === classId);

  return (
    <div className="source-setup">
      <ArtFrame base={base} label={source.baseName ?? t('source.artLabel')} glow="ember" maxHeight={188} className="source-art" />
      <div className="setup-fields">
        <div className="field-pair">
          <label className="field">
            <span className="field-label">{t('source.itemType')}</span>
            <select
              name="source-category"
              value={category}
              onChange={(e) => {
                const cls = classes.find((c) => (c.category ?? 'other') === e.target.value);
                const next = cls && firstBaseOf(cls.id);
                if (next) props.onChooseBase(next.id);
              }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {itemCategoryLabel(t, c)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('source.class')}</span>
            <select
              name="source-class"
              value={itemClass?.id ?? ''}
              onChange={(e) => {
                const next = firstBaseOf(e.target.value);
                if (next) props.onChooseBase(next.id);
              }}
            >
              {!itemClass && <option value="">—</option>}
              {classes
                .filter((c) => (c.category ?? 'other') === category)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clipboardName}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="field-base">
          <label className="field">
            <span className="field-label">{t('source.base')}</span>
            <select name="source-base" value={base?.id ?? ''} onChange={(e) => props.onChooseBase(e.target.value)}>
              {!base && <option value="">{source.baseName ?? t('source.baseUnknown')}</option>}
              {basesOfClass.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="icon-btn icon-btn-gold" aria-label={t('source.pickInCatalog')} title={t('source.pickInCatalog')} onClick={props.onOpenCatalog}>
            <Icon name="pencil" size={15} />
          </button>
        </div>

        {fields ? (
          <>
            <div className="field-pair">
              <label className="field">
                <span className="field-label">{t('source.rarity')}</span>
                <select
                  name="source-rarity"
                  className={`rarity-select rarity-${source.rarity ?? 'unknown'}`}
                  value={source.rarity ?? ''}
                  onChange={(e) => props.onEdit(setRarity(view, source, e.target.value as Rarity))}
                >
                  {source.rarity === null && <option value="">—</option>}
                  {setupRarities(view).map((r) => (
                    <option key={r} value={r}>
                      {rarityLabel(t, r)}
                    </option>
                  ))}
                </select>
              </label>
              <Stepper
                name="source-ilvl"
                label={t('source.itemLevel')}
                value={source.itemLevel}
                min={fields.itemLevel.min}
                max={fields.itemLevel.max}
                onChange={(n) => props.onEdit(setItemLevel(source, n))}
              />
            </div>
            <div className="field-pair">
              {fields.quality ? (
                <Stepper
                  name="source-quality"
                  label={t('source.quality')}
                  suffix="%"
                  value={source.quality}
                  min={fields.quality.min}
                  max={fields.quality.max}
                  onChange={(n) => props.onEdit(setQuality(view, source, n))}
                />
              ) : (
                <span />
              )}
              <div className="field">
                <span className="field-label">{t('source.baseRequirements')}</span>
                <div className="req-chips num">
                  <span>Str {requirements?.strength ?? '—'}</span>
                  <span>Dex {requirements?.dexterity ?? '—'}</span>
                  <span>Int {requirements?.intelligence ?? '—'}</span>
                </div>
              </div>
            </div>
            {fields.slots.length > 0 && (
              <div className="setup-extra">
                <span className="field-label">{t('source.extra')}</span>
                {fields.slots.map((rule) => (
                  <label key={rule.kind} className="inline-field" title={sourceTitle(t, view, rule.provenance)}>
                    {slotLabel(t, rule.kind, rule.label)}
                    <select
                      name={`source-slot-${rule.kind}`}
                      value={slotCount(source, rule.kind) ?? ''}
                      onChange={(e) => props.onEdit(setSlotCount(view, source, rule.kind, Number(e.target.value)))}
                    >
                      {slotCount(source, rule.kind) === null && <option value="">—</option>}
                      {rule.options.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="state-box state-warn">{t('source.baseNotInDb')}</p>
        )}
      </div>
    </div>
  );
}

function AffixColumn(props: SourcePanelProps & { source: ItemState; side: AffixSide; detailed: boolean }) {
  const { source, view, side } = props;
  const { t } = useI18n();
  const limits = source.rarity ? view.getAffixLimits(source.rarity) : undefined;
  const max = side === 'prefix' ? limits?.maxPrefixes : limits?.maxSuffixes;
  const mods = source.explicits
    .map((mod, index) => ({ mod, index }))
    .filter(({ mod }) => mod.kind === 'resolved' && view.getModifier(mod.modifierId)?.side === side);
  const active =
    props.explorerMode.kind === 'edit-source' && props.explorerMode.side === side && props.explorerMode.replaceIndex === undefined;

  return (
    <section className="affix-col" aria-label={t(side === 'prefix' ? 'source.affixes.prefix' : 'source.affixes.suffix')}>
      <h3 className="affix-col-title">
        {t(side === 'prefix' ? 'side.prefixes' : 'side.suffixes')} <span className="num">{mods.length} / {max ?? '?'}</span>
      </h3>
      <ul className="chip-list">
        {mods.map(({ mod, index }) => (
          <SourceModChip key={`${index}-${mod.kind === 'resolved' ? mod.modifierId : ''}`} {...props} mod={mod} index={index} />
        ))}
      </ul>
      <button
        type="button"
        className={`add-btn${active ? ' add-btn-active' : ''}`}
        disabled={max !== undefined && mods.length >= max}
        onClick={() => props.onExplore({ kind: 'edit-source', side })}
      >
        <Icon name="plus" size={14} />
        {t(side === 'prefix' ? 'source.addPrefix' : 'source.addSuffix')}
      </button>
    </section>
  );
}

function SourceModChip(props: SourcePanelProps & { source: ItemState; mod: ExplicitModifier; index: number; detailed: boolean }) {
  const { source, view, mod, index } = props;
  const { t } = useI18n();
  if (mod.kind !== 'resolved') return null;
  const def = view.getModifier(mod.modifierId);
  if (!def) return null;
  const tiers = props.setup?.tierOptions.get(index) ?? [];
  const issue = props.setup?.issues.get(index);
  return (
    <li
      className={`mod-chip${mod.fractured ? ' mod-chip-fractured' : ''}${props.menuIndex === index ? ' is-menu-open' : ''}`}
      onContextMenu={(e) => {
        if (e.target instanceof HTMLSelectElement) return;
        e.preventDefault();
        props.onModMenu(index, e.clientX, e.clientY);
      }}
    >
      <div className="mod-chip-main">
        <span className="mod-text">{mod.sourceText.replace(/\s*\(fractured\)$/i, '')}</span>
        <ModMoreButton label={t('source.modActions')} open={props.menuIndex === index} onMenu={(x, y) => props.onModMenu(index, x, y)} />
        <button
          type="button"
          className="icon-btn icon-btn-quiet"
          aria-label={t('source.removeMod')}
          onClick={() => props.onEdit(removeSourceModifier(source, index))}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="mod-chip-tags">
        <select
          name={`source-tier-${index}`}
          className="tier-select"
          aria-label={t('source.tier')}
          value={def.id}
          onChange={(e) => {
            const next = view.getModifier(e.target.value);
            if (next) props.onEdit(replaceSourceModifier(source, index, next));
          }}
        >
          {tiers.map((tier) => (
            <option
              key={tier.definition.id}
              value={tier.definition.id}
              disabled={!tier.allowed && tier.definition.id !== def.id}
              title={exclusionsText(t, tier.reasons, view)}
            >
              T{tier.definition.tier}
              {tier.allowed ? '' : ` — ${exclusionsText(t, tier.reasons, view)}`}
            </option>
          ))}
        </select>
        <span className="chip-name">{def.name.replace(/^of /, '')}</span>
        <button
          type="button"
          className="frac-toggle"
          aria-pressed={mod.fractured}
          title={t('source.fracturedTitle')}
          onClick={() => props.onEdit(setSourceModifierFractured(source, index, !mod.fractured))}
        >
          <Icon name="crack" size={12} />
          {t('tag.fractured')}
        </button>
      </div>
      {issue && <p className="mod-issue">{t('source.cannotBeOnItem', { reasons: exclusionsText(t, issue, view) })}</p>}
      {props.detailed && (
        <div className="mod-chip-detail">
          <span className="muted small">
            {def.name} · ilvl {def.requiredItemLevel} · {def.tags.join(', ') || t('source.noTags')}
          </span>
          <button type="button" className="link-btn" onClick={() => props.onExplore({ kind: 'edit-source', side: def.side, replaceIndex: index })}>
            {t('source.replaceFromPool')}
          </button>
        </div>
      )}
    </li>
  );
}
