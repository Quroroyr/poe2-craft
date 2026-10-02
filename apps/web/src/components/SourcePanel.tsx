import { useState } from 'react';
import type { AffixSide, ExplicitModifier, ItemBaseId, ItemState, Rarity } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { SAMPLE_ITEMS } from '@poe2-craft/item-parser';
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
import { ITEM_CATEGORY_LABEL, RARITY_LABEL, SIDE_LABEL, SLOT_LABEL, exclusionText, sourceTitle } from '@/lib/texts';
import { Stepper } from './Controls';
import { Icon } from './Icon';
import { ImportBox } from './ImportBox';
import { ArtFrame } from './ItemBits';
import { Panel } from './Panel';

interface SourcePanelProps {
  readonly source: ItemState | null;
  readonly view: CraftDbView;
  readonly setup: SourceSetupView | null;
  readonly explorerMode: ExplorerMode;
  /** Crafting already started: a source edit will need Reset to reach the current item. */
  readonly craftStarted: boolean;
  readonly onImport: (text: string) => void;
  /** Initial item setup of the source. Never crafting, never counted as spending. */
  readonly onEdit: (source: ItemState) => void;
  readonly onExplore: (mode: ExplorerMode) => void;
  readonly onChooseBase: (baseId: ItemBaseId) => void;
  readonly onOpenCatalog: () => void;
  readonly onClear: () => void;
}

/**
 * - base:   pick the class and base from the catalog, then configure the item (default);
 * - import: paste the game's Ctrl+C text;
 * - manual: the same settings plus the detailed editor of every starting modifier.
 */
type SourceMode = 'base' | 'import' | 'manual';

const MODES: readonly { id: SourceMode; label: string }[] = [
  { id: 'base', label: 'База из игры' },
  { id: 'import', label: 'Импорт предмета' },
  { id: 'manual', label: 'Ручная настройка' },
];

/** Source builder: base, rarity, item level, quality, slots, starting modifiers and their fractured state. */
export function SourcePanel(props: SourcePanelProps) {
  const { source, view, setup } = props;
  const [mode, setMode] = useState<SourceMode>('base');

  return (
    <Panel
      index={1}
      title="Исходный предмет"
      className="panel-source"
      aside={
        <button type="button" className="btn btn-small" onClick={props.onClear} disabled={!source || source.explicits.length === 0}>
          <Icon name="reset" size={14} />
          Сбросить
        </button>
      }
    >
      <div className="mode-row">
        <div className="segmented segmented-wide" role="tablist" aria-label="Способ создания исходного">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn icon-btn-gold" aria-label="Каталог баз" title="Каталог баз" onClick={props.onOpenCatalog}>
          <Icon name="book" size={16} />
        </button>
      </div>

      {mode === 'import' && (
        <ImportBox
          id="source-text"
          label="Текст предмета (Ctrl+C в игре)"
          samples={SAMPLE_ITEMS}
          onImport={props.onImport}
          collapsible={false}
        />
      )}

      {!source ? (
        <div className="source-empty">
          <p>Исходного предмета нет. Выберите базу и соберите его — или вставьте текст из игры.</p>
          <button type="button" className="btn btn-primary" onClick={props.onOpenCatalog}>
            Создать предмет
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
              Нераспознанные строки импорта: {unresolvedOf(source, view).map((m) => m.sourceText).join('; ')}
            </p>
          )}
        </>
      )}
      <p className="hint">
        Настройка стартового предмета — не крафт: валюта не тратится, шаги не пишутся.
        {props.craftStarted && ' Крафт уже начат: текущий догонит исходный только после Reset.'}
        {setup && setup.fields && (setup.fields.quality || setup.fields.slots.length > 0) && ' Качество и сокеты в расчётах пока не участвуют.'}
      </p>
    </Panel>
  );
}

function unresolvedOf(source: ItemState, view: CraftDbView): ExplicitModifier[] {
  return source.explicits.filter((m) => m.kind === 'unresolved' || !view.getModifier(m.modifierId));
}

function SourceSetup(props: SourcePanelProps & { source: ItemState }) {
  const { source, view } = props;
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
      <ArtFrame base={base} label={source.baseName ?? 'база'} glow="ember" maxHeight={188} className="source-art" />
      <div className="setup-fields">
        <div className="field-pair">
          <label className="field">
            <span className="field-label">Тип предмета</span>
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
                  {ITEM_CATEGORY_LABEL[c] ?? c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Класс</span>
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
            <span className="field-label">База</span>
            <select name="source-base" value={base?.id ?? ''} onChange={(e) => props.onChooseBase(e.target.value)}>
              {!base && <option value="">{source.baseName ?? 'не распознана'}</option>}
              {basesOfClass.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="icon-btn icon-btn-gold" aria-label="Выбрать в каталоге" title="Выбрать в каталоге" onClick={props.onOpenCatalog}>
            <Icon name="pencil" size={15} />
          </button>
        </div>

        {fields ? (
          <>
            <div className="field-pair">
              <label className="field">
                <span className="field-label">Редкость</span>
                <select
                  name="source-rarity"
                  className={`rarity-select rarity-${source.rarity ?? 'unknown'}`}
                  value={source.rarity ?? ''}
                  onChange={(e) => props.onEdit(setRarity(view, source, e.target.value as Rarity))}
                >
                  {source.rarity === null && <option value="">—</option>}
                  {setupRarities(view).map((r) => (
                    <option key={r} value={r}>
                      {RARITY_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <Stepper
                name="source-ilvl"
                label="Уровень предмета"
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
                  label="Качество"
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
                <span className="field-label">Требования базы</span>
                <div className="req-chips num">
                  <span>Str {requirements?.strength ?? '—'}</span>
                  <span>Dex {requirements?.dexterity ?? '—'}</span>
                  <span>Int {requirements?.intelligence ?? '—'}</span>
                </div>
              </div>
            </div>
            {fields.slots.length > 0 && (
              <div className="setup-extra">
                <span className="field-label">Дополнительно</span>
                {fields.slots.map((rule) => (
                  <label key={rule.kind} className="inline-field" title={sourceTitle(view, rule.provenance)}>
                    {SLOT_LABEL[rule.kind] ?? rule.label}
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
          <p className="state-box state-warn">База не найдена в CraftDB — свойства предмета не настраиваются.</p>
        )}
      </div>
    </div>
  );
}

function AffixColumn(props: SourcePanelProps & { source: ItemState; side: AffixSide; detailed: boolean }) {
  const { source, view, side } = props;
  const limits = source.rarity ? view.getAffixLimits(source.rarity) : undefined;
  const max = side === 'prefix' ? limits?.maxPrefixes : limits?.maxSuffixes;
  const mods = source.explicits
    .map((mod, index) => ({ mod, index }))
    .filter(({ mod }) => mod.kind === 'resolved' && view.getModifier(mod.modifierId)?.side === side);
  const active =
    props.explorerMode.kind === 'edit-source' && props.explorerMode.side === side && props.explorerMode.replaceIndex === undefined;

  return (
    <section className="affix-col" aria-label={`${SIDE_LABEL[side]}ы исходного`}>
      <h3 className="affix-col-title">
        {SIDE_LABEL[side]}ы <span className="num">{mods.length} / {max ?? '?'}</span>
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
        {side === 'prefix' ? 'Добавить префикс' : 'Добавить суффикс'}
      </button>
    </section>
  );
}

function SourceModChip(props: SourcePanelProps & { source: ItemState; mod: ExplicitModifier; index: number; detailed: boolean }) {
  const { source, view, mod, index } = props;
  if (mod.kind !== 'resolved') return null;
  const def = view.getModifier(mod.modifierId);
  if (!def) return null;
  const tiers = props.setup?.tierOptions.get(index) ?? [];
  const issue = props.setup?.issues.get(index);
  return (
    <li className={`mod-chip${mod.fractured ? ' mod-chip-fractured' : ''}`}>
      <div className="mod-chip-main">
        <span className="mod-text">{mod.sourceText.replace(/\s*\(fractured\)$/i, '')}</span>
        <button
          type="button"
          className="icon-btn icon-btn-quiet"
          aria-label="Удалить мод"
          onClick={() => props.onEdit(removeSourceModifier(source, index))}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="mod-chip-tags">
        <select
          name={`source-tier-${index}`}
          className="tier-select"
          aria-label="Тир"
          value={def.id}
          onChange={(e) => {
            const next = view.getModifier(e.target.value);
            if (next) props.onEdit(replaceSourceModifier(source, index, next));
          }}
        >
          {tiers.map((t) => (
            <option
              key={t.definition.id}
              value={t.definition.id}
              disabled={!t.allowed && t.definition.id !== def.id}
              title={t.reasons.map((r) => exclusionText(r, view)).join('; ')}
            >
              T{t.definition.tier}
              {t.allowed ? '' : ` — ${t.reasons.map((r) => exclusionText(r, view)).join('; ')}`}
            </option>
          ))}
        </select>
        <span className="chip-name">{def.name.replace(/^of /, '')}</span>
        <button
          type="button"
          className="frac-toggle"
          aria-pressed={mod.fractured}
          title="Настройка исходного: мод уже fractured на вашей базе. Это не Fracturing Orb и ничего не стоит."
          onClick={() => props.onEdit(setSourceModifierFractured(source, index, !mod.fractured))}
        >
          <Icon name="crack" size={12} />
          fractured
        </button>
      </div>
      {issue && <p className="mod-issue">Не может стоять на предмете: {issue.map((r) => exclusionText(r, view)).join('; ')}</p>}
      {props.detailed && (
        <div className="mod-chip-detail">
          <span className="muted small">
            {def.name} · ilvl {def.requiredItemLevel} · {def.tags.join(', ') || 'без тегов'}
          </span>
          <button type="button" className="link-btn" onClick={() => props.onExplore({ kind: 'edit-source', side: def.side, replaceIndex: index })}>
            Заменить из пула
          </button>
        </div>
      )}
    </li>
  );
}
