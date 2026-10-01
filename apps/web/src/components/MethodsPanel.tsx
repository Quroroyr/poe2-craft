import type { CraftAction } from '@poe2-craft/craft-domain';
import type { CraftDb, CraftDbView } from '@poe2-craft/craft-db';
import type { StageTargetOption } from '@/lib/analyze';
import { consumableIconUrl } from '@/lib/icons';
import { GameIcon } from './GameIcon';
import { Panel } from './Panel';

/** Mechanics planned but not implemented. Shown so the layout is ready for them; nothing is simulated. */
const PLANNED_METHODS: readonly { name: string; note: string }[] = [
  { name: 'Essences', note: 'гарантированный мод' },
  { name: 'Chaos / Annulment', note: 'удаление и замена модов' },
  { name: 'Omen как отдельный слой', note: 'модификатор поверх валюты' },
  { name: 'Desecration', note: 'особый пул модов' },
  { name: 'Fracturing', note: 'закрепление мода' },
];

interface MethodsPanelProps {
  readonly db: CraftDb;
  readonly view: CraftDbView;
  readonly actionId: string;
  readonly onAction: (id: string) => void;
  readonly gameVersion: string;
  readonly onGameVersion: (version: string) => void;
  readonly stageTargets: readonly StageTargetOption[];
  readonly stageTargetKey: string | null;
  readonly onStageTarget: (key: string) => void;
}

export function MethodsPanel(props: MethodsPanelProps) {
  const { view } = props;
  const fromItem = props.stageTargets.filter((o) => o.origin === 'target-item');
  const catalog = props.stageTargets.filter((o) => o.origin === 'catalog');

  return (
    <Panel title="Способы крафта" step="4">
      <div className="controls">
        <label className="control">
          <span className="field-label">Цель текущего шага</span>
          <select
            name="stage-target"
            value={props.stageTargetKey ?? ''}
            onChange={(e) => props.onStageTarget(e.target.value)}
          >
            {fromItem.length > 0 && (
              <optgroup label="Не хватает до целевого предмета">
                {fromItem.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.target.label}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Из каталога (fixture)">
              {catalog.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.target.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="control control-narrow">
          <span className="field-label">Версия игры</span>
          <select name="game-version" value={props.gameVersion} onChange={(e) => props.onGameVersion(e.target.value)}>
            {props.db.supportedVersions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="sub-head">Валюта: добавить модификатор</h3>
      <div className="method-grid" role="radiogroup" aria-label="Действие">
        {view.listActions().map((action) => (
          <MethodCard
            key={action.id}
            action={action}
            view={view}
            selected={action.id === props.actionId}
            onSelect={() => props.onAction(action.id)}
          />
        ))}
      </div>

      <h3 className="sub-head">Скоро</h3>
      <div className="planned">
        {PLANNED_METHODS.map((m) => (
          <span key={m.name} className="planned-item" title="Не реализовано: правила ещё не подтверждены данными">
            {m.name} <span className="muted">· {m.note}</span>
          </span>
        ))}
      </div>
      <p className="hint">
        Окаменелостей (fossils) в списке нет: в официальных данных трейда PoE 2 такой категории валюты нет, а
        механики PoE 1 сюда не переносятся.
      </p>
    </Panel>
  );
}

function MethodCard(props: { action: CraftAction; view: CraftDbView; selected: boolean; onSelect: () => void }) {
  const { action, view } = props;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      className={`method-card${props.selected ? ' method-selected' : ''}`}
      onClick={props.onSelect}
    >
      <span className="method-icons">
        {action.defaultCost.map(({ consumableId }) => {
          const consumable = view.getConsumable(consumableId);
          return (
            <GameIcon
              key={consumableId}
              src={consumableIconUrl(consumable)}
              label={consumable?.name ?? consumableId}
              size={30}
            />
          );
        })}
      </span>
      <span className="method-name">{action.name}</span>
      <span className="method-desc">{action.description}</span>
      <span className="tag">демо-модель</span>
    </button>
  );
}
