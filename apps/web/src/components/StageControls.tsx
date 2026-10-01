import type { CraftDb, CraftDbView } from '@poe2-craft/craft-db';
import { consumableIconUrl } from '@/lib/icons';
import { GameIcon } from './GameIcon';
import { Panel } from './Panel';

interface StageControlsProps {
  readonly db: CraftDb;
  readonly view: CraftDbView;
  readonly gameVersion: string;
  readonly actionId: string;
  readonly targetId: string;
  readonly onGameVersion: (v: string) => void;
  readonly onAction: (id: string) => void;
  readonly onTarget: (id: string) => void;
}

export function StageControls(props: StageControlsProps) {
  const { db, view } = props;
  const action = view.getAction(props.actionId);
  return (
    <Panel title="Этап крафта" step="3">
      <div className="controls">
        <label className="control">
          <span className="field-label">Цель</span>
          <select name="target" value={props.targetId} onChange={(e) => props.onTarget(e.target.value)}>
            {view.listTargets().map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="control">
          <span className="field-label">Действие одной попытки</span>
          <select name="action" value={props.actionId} onChange={(e) => props.onAction(e.target.value)}>
            {view.listActions().map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="control control-narrow">
          <span className="field-label">Версия игры</span>
          <select name="game-version" value={props.gameVersion} onChange={(e) => props.onGameVersion(e.target.value)}>
            {db.supportedVersions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {action && (
        <div className="action-cost" aria-label="Расходники одной попытки по умолчанию">
          {action.defaultCost.map(({ consumableId, quantity }) => {
            const consumable = view.getConsumable(consumableId);
            return (
              <span key={consumableId}>
                <GameIcon src={consumableIconUrl(consumable)} label={consumable?.name ?? consumableId} size={32} />
                {quantity} × {consumable?.name ?? consumableId}
              </span>
            );
          })}
        </div>
      )}
      {action && (
        <p className="hint">
          {action.description}
          {action.provenance.notes && <span className="muted"> {action.provenance.notes}</span>}
        </p>
      )}
    </Panel>
  );
}
