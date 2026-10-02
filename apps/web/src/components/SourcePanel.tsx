import { useState } from 'react';
import type { AffixSide, ExplicitModifier, ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { SAMPLE_ITEMS } from '@poe2-craft/item-parser';
import {
  removeSourceModifier,
  replaceSourceModifier,
  setItemLevel,
  setQuality,
  setSlotCount,
  setSourceModifierFractured,
  slotCount,
} from '@poe2-craft/craft-session';
import type { ExplorerMode, SourceSetupView } from '@/lib/analyze';
import { baseArt } from '@/lib/icons';
import { SLOT_LABEL, exclusionText, sourceTitle } from '@/lib/texts';
import { Segmented, Stepper } from './Controls';
import { Icon } from './Icon';
import { ImportBox } from './ImportBox';
import { ItemArt } from './ItemArt';
import { ItemCard } from './ItemCard';
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
  readonly onChooseBase: () => void;
}

type SourceMode = 'build' | 'import';

/** Source item: built from a base by hand, or imported from the game's Ctrl+C text. */
export function SourcePanel(props: SourcePanelProps) {
  const { source, view, setup } = props;
  const [mode, setMode] = useState<SourceMode>('build');

  return (
    <Panel
      title="Исходный предмет"
      aside={
        <button type="button" className="btn btn-small" onClick={props.onChooseBase}>
          <Icon name="plus" size={14} />
          Новый предмет
        </button>
      }
    >
      <div className="segmented segmented-wide" role="tablist" aria-label="Способ создания исходного">
        <button type="button" role="tab" aria-selected={mode === 'build'} aria-pressed={mode === 'build'} onClick={() => setMode('build')}>
          <Icon name="hammer" size={14} />
          Собрать вручную
        </button>
        <button type="button" role="tab" aria-selected={mode === 'import'} aria-pressed={mode === 'import'} onClick={() => setMode('import')}>
          <Icon name="import" size={14} />
          Импорт из игры
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
          <button type="button" className="btn btn-primary" onClick={props.onChooseBase}>
            Создать предмет
          </button>
        </div>
      ) : (
        <>
          <SourceBase source={source} view={view} setup={setup} onChooseBase={props.onChooseBase} onEdit={props.onEdit} />
          <ItemCard
            item={source}
            view={view}
            variant="setup"
            issues={issueTexts(setup, view)}
            renderModActions={(index, mod) => (
              <ModEditor
                key={`${index}-${mod.kind === 'resolved' ? mod.modifierId : mod.sourceText}`}
                index={index}
                mod={mod}
                source={source}
                view={view}
                setup={setup}
                onEdit={props.onEdit}
                onExplore={props.onExplore}
              />
            )}
            renderSideFooter={(side: AffixSide, used, max) => {
              const active =
                props.explorerMode.kind === 'edit-source' &&
                props.explorerMode.side === side &&
                props.explorerMode.replaceIndex === undefined;
              return (
                <button
                  type="button"
                  className={`add-btn${active ? ' add-btn-active' : ''}`}
                  disabled={max !== undefined && used >= max}
                  onClick={() => props.onExplore({ kind: 'edit-source', side })}
                >
                  <Icon name="plus" size={14} />
                  {side === 'prefix' ? 'Добавить префикс' : 'Добавить суффикс'}
                </button>
              );
            }}
          />
        </>
      )}
      <p className="hint">
        Всё здесь — настройка стартового предмета, а не крафт: валюта не тратится, шаги не пишутся.
        {props.craftStarted && ' Крафт уже начат: текущий предмет догонит исходный только после Reset.'}
      </p>
    </Panel>
  );
}

function SourceBase(props: {
  source: ItemState;
  view: CraftDbView;
  setup: SourceSetupView | null;
  onChooseBase: () => void;
  onEdit: (source: ItemState) => void;
}) {
  const { source, view } = props;
  const fields = props.setup?.fields ?? null;
  const base = fields?.base;
  const itemClass = base ? view.getItemClass(base.itemClassId) : undefined;
  return (
    <div className="source-base">
      <div className="source-base-head">
        <ItemArt art={baseArt(base)} label={source.baseName ?? 'база'} maxHeight={96} className="source-base-art" />
        <div className="source-base-title">
          <span className="source-base-name">{source.baseName ?? 'База не распознана'}</span>
          <span className="muted small">{itemClass?.clipboardName ?? source.itemClassName ?? 'класс неизвестен'}</span>
          <button type="button" className="link-btn" onClick={props.onChooseBase}>
            <Icon name="swap" size={14} />
            Сменить базу
          </button>
        </div>
      </div>

      {fields ? (
        <div className="setup-grid">
          <Stepper
            name="source-ilvl"
            label="Item level"
            value={source.itemLevel}
            min={fields.itemLevel.min}
            max={fields.itemLevel.max}
            onChange={(n) => props.onEdit(setItemLevel(source, n))}
          />
          {fields.quality && (
            <Stepper
              name="source-quality"
              label="Качество"
              suffix="%"
              value={source.quality}
              min={fields.quality.min}
              max={fields.quality.max}
              onChange={(n) => props.onEdit(setQuality(view, source, n))}
            />
          )}
          {fields.slots.map((rule) => (
            <Segmented
              key={rule.kind}
              label={SLOT_LABEL[rule.kind] ?? rule.label}
              value={slotCount(source, rule.kind)}
              options={rule.options.map((n) => ({ value: n, label: String(n) }))}
              onChange={(n) => props.onEdit(setSlotCount(view, source, rule.kind, n))}
            />
          ))}
        </div>
      ) : (
        <p className="state-box state-warn">База не найдена в CraftDB — свойства предмета не настраиваются.</p>
      )}
      {fields && (fields.quality || fields.slots.length > 0) && (
        <p className="hint" title={[fields.quality, ...fields.slots].map((r) => r && sourceTitle(view, r.provenance)).filter(Boolean).join('\n')}>
          Качество и сокеты записываются в предмет, но в расчётах пока не участвуют. Допустимые значения общеизвестны и
          не сверены с данными игры.
        </p>
      )}
    </div>
  );
}

function ModEditor(props: {
  index: number;
  mod: ExplicitModifier;
  source: ItemState;
  view: CraftDbView;
  setup: SourceSetupView | null;
  onEdit: (source: ItemState) => void;
  onExplore: (mode: ExplorerMode) => void;
}) {
  const { index, mod, source, view } = props;
  const [open, setOpen] = useState(false);
  const def = mod.kind === 'resolved' ? view.getModifier(mod.modifierId) : undefined;
  const tiers = props.setup?.tierOptions.get(index) ?? [];
  const fracture = (fractured: boolean) => props.onEdit(setSourceModifierFractured(source, index, fractured));

  return (
    <div className="mod-editor">
      <div className="mod-editor-bar">
        <button
          type="button"
          className="frac-toggle"
          aria-pressed={mod.fractured}
          title="Настройка исходного: мод уже fractured на вашей базе. Это не Fracturing Orb и ничего не стоит."
          onClick={() => fracture(!mod.fractured)}
        >
          <Icon name="crack" size={14} />
          {mod.fractured ? 'Снять fracture' : 'Сделать fractured'}
        </button>
        <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Свернуть' : 'Изменить'}
          <Icon name="chevron" size={12} className={open ? 'rot-90' : undefined} />
        </button>
      </div>
      {open && (
        <div className="mod-editor-panel">
          {def && tiers.length > 0 && (
            <label className="inline-field">
              Тир
              <select
                name={`source-tier-${index}`}
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
                    T{t.definition.tier} · {t.definition.name}
                    {t.allowed ? '' : ` — ${t.reasons.map((r) => exclusionText(r, view)).join('; ')}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Segmented
            label="Состояние"
            value={mod.fractured ? 'fractured' : 'normal'}
            options={[
              { value: 'normal', label: 'Обычный' },
              { value: 'fractured', label: 'Fractured' },
            ]}
            onChange={(v) => fracture(v === 'fractured')}
          />
          <div className="mod-editor-actions">
            {def && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => props.onExplore({ kind: 'edit-source', side: def.side, replaceIndex: index })}
              >
                Заменить из пула
              </button>
            )}
            <button type="button" className="btn btn-small btn-danger" onClick={() => props.onEdit(removeSourceModifier(source, index))}>
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function issueTexts(setup: SourceSetupView | null, view: CraftDbView): ReadonlyMap<number, string> {
  const texts = new Map<number, string>();
  for (const [index, reasons] of setup?.issues ?? []) {
    texts.set(index, `Не может стоять на этом предмете: ${reasons.map((r) => exclusionText(r, view)).join('; ')}`);
  }
  return texts;
}
