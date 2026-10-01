import type { AffixSide, ExplicitModifier } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ItemParseResult } from '@poe2-craft/item-parser';
import { RARITY_LABEL, SIDE_LABEL, UNRESOLVED_LABEL, diagnosticText } from '@/lib/texts';
import { Panel } from './Panel';

interface ParsedItemProps {
  readonly parse: ItemParseResult;
  readonly view: CraftDbView;
}

export function ParsedItem({ parse, view }: ParsedItemProps) {
  const { state, parsed } = parse;
  const sideOf = (m: ExplicitModifier): AffixSide | null =>
    m.kind === 'resolved' ? (view.getModifier(m.modifierId)?.side ?? null) : (m.sideHint ?? null);
  const bySide = (side: AffixSide) => state.explicits.filter((m) => m.kind === 'resolved' && sideOf(m) === side);
  const unresolved = state.explicits.filter((m) => m.kind === 'unresolved');
  const limits = state.rarity ? view.getAffixLimits(state.rarity) : undefined;
  const name = parsed.nameLines.length > 1 ? parsed.nameLines[0] : null;
  const warnings = parse.diagnostics.filter((d) => d.code !== 'unresolved-modifier');

  return (
    <Panel title="Разбор предмета" step="2">
      <div className={`tooltip rarity-${state.rarity ?? 'unknown'}`}>
        <div className="tooltip-head">
          {name && <div className="tooltip-name">{name}</div>}
          <div className="tooltip-base">{state.baseName ?? 'База не распознана'}</div>
        </div>
        <dl className="tooltip-facts">
          <div>
            <dt>Класс</dt>
            <dd>{state.itemClassName ?? '—'}</dd>
          </div>
          <div>
            <dt>Редкость</dt>
            <dd>{state.rarity ? RARITY_LABEL[state.rarity] : '—'}</dd>
          </div>
          <div>
            <dt>Item Level</dt>
            <dd className="num">{state.itemLevel ?? '—'}</dd>
          </div>
          <div>
            <dt>В CraftDB</dt>
            <dd>{state.baseId ? <code>{state.baseId}</code> : <span className="bad">нет</span>}</dd>
          </div>
        </dl>

        {(['prefix', 'suffix'] as const).map((side) => {
          const mods = bySide(side);
          const max = side === 'prefix' ? limits?.maxPrefixes : limits?.maxSuffixes;
          return (
            <div className="affix-block" key={side}>
              <div className="affix-title">
                {SIDE_LABEL[side]}ы{' '}
                <span className="num muted">
                  {mods.length}
                  {max !== undefined && ` / ${max}`}
                </span>
              </div>
              {mods.length === 0 && <div className="affix-empty">пусто</div>}
              {mods.map((m, i) => (
                <ModLine key={i} mod={m} view={view} />
              ))}
            </div>
          );
        })}

        {unresolved.length > 0 && (
          <div className="affix-block">
            <div className="affix-title bad">Нераспознанные строки</div>
            {unresolved.map((m, i) => (
              <ModLine key={i} mod={m} view={view} />
            ))}
          </div>
        )}

        {state.otherLines.length > 0 && (
          <div className="affix-block">
            <div className="affix-title muted">Прочие строки (не участвуют в расчёте v0.1)</div>
            {state.otherLines.map((l, i) => (
              <div key={i} className="mod-line mod-other">
                <span className="mod-text">{l.text}</span>
                <span className="tag">{l.source}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="notes">
          {warnings.map((d, i) => (
            <li key={i}>{diagnosticText(d)}</li>
          ))}
        </ul>
      )}

      <details className="debug">
        <summary>Debug: ItemState</summary>
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </details>
    </Panel>
  );
}

function ModLine({ mod, view }: { mod: ExplicitModifier; view: CraftDbView }) {
  if (mod.kind === 'unresolved') {
    return (
      <div className="mod-line mod-unresolved">
        <span className="mod-text">{mod.sourceText}</span>
        <span className="mod-meta">
          {UNRESOLVED_LABEL[mod.reason]}
          {mod.sideHint && ` · похоже на ${mod.sideHint === 'prefix' ? 'префикс' : 'суффикс'}`}
        </span>
      </div>
    );
  }
  const def = view.getModifier(mod.modifierId);
  return (
    <div className={`mod-line${mod.fractured ? ' mod-fractured' : ''}`}>
      <span className="mod-text">{mod.sourceText}</span>
      <span className="mod-meta">
        {def ? `«${def.name}» · T${def.tier} · ilvl ${def.requiredItemLevel}` : mod.modifierId}
        {mod.fractured && <span className="tag tag-fractured">fractured</span>}
      </span>
    </div>
  );
}
