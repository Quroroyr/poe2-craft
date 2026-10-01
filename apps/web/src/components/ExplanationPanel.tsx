import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ExplanationStep } from '@poe2-craft/probability-engine';
import { formatAttempts, formatInt, formatPercent } from '@/lib/format';
import {
  CONFIDENCE_LABEL,
  EXCLUSION_TITLE,
  RARITY_LABEL,
  caveatText,
  exclusionText,
  issueText,
} from '@/lib/texts';
import { Panel } from './Panel';

interface ExplanationPanelProps {
  readonly steps: readonly ExplanationStep[];
  readonly view: CraftDbView;
}

export function ExplanationPanel({ steps, view }: ExplanationPanelProps) {
  return (
    <Panel title="Почему так" step="10">
      {steps.length === 0 ? (
        <p className="empty">Нет расчёта для объяснения.</p>
      ) : (
        <ol className="why">
          {steps.map((step, i) => (
            <li key={i} className={step.code === 'caveat' ? 'why-caveat' : undefined}>
              <Step step={step} view={view} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Step({ step, view }: { step: ExplanationStep; view: CraftDbView }) {
  switch (step.code) {
    case 'dataset':
      return (
        <>
          <b>Данные.</b> Набор «{step.title}» ({step.kind === 'fixture' ? 'демо, fixture' : 'production'}), правила
          версии игры <b>{step.gameVersion}</b>. Моды других версий в пул не попадают.
        </>
      );
    case 'blocked':
      return (
        <>
          <b>Пул не построен:</b> {step.issues.map(issueText).join(' ')}
        </>
      );
    case 'item':
      return (
        <>
          <b>Предмет.</b> {step.baseName}, {RARITY_LABEL[step.rarity]}, ilvl {step.itemLevel}. Теги базы для весов
          появления: {step.baseTags.map((t) => <code key={t}>{t}</code>)}. Моды с требованием ilvl выше{' '}
          {step.itemLevel} исключены.
        </>
      );
    case 'affix-slots':
      return (
        <>
          <b>Слоты.</b> Префиксы {step.slots.prefix.used}/{step.slots.prefix.max} (свободно {step.slots.prefix.free}),
          суффиксы {step.slots.suffix.used}/{step.slots.suffix.max} (свободно {step.slots.suffix.free}).
          {step.slots.unknownSide > 0 && ` Строк с неизвестной стороной: ${step.slots.unknownSide}.`} Fractured-мод
          занимает слот как обычный.
        </>
      );
    case 'occupied-groups':
      return step.occupants.length === 0 ? (
        <>
          <b>Группы.</b> На предмете нет модов — коллизий нет.
        </>
      ) : (
        <>
          <b>Занятые группы</b> (мод из такой группы второй раз не выпадет):{' '}
          {step.occupants.map((o, i) => (
            <span key={i} className="inline-item">
              «{view.getGroup(o.groupId)?.name ?? o.groupId}» ← {o.sourceText}
              {o.fractured && ' (fractured)'}
              {o.inferred && ' (по нераспознанной строке)'}
            </span>
          ))}
        </>
      );
    case 'action':
      return (
        <>
          <b>Действие.</b> «{step.name}»: добавляет{' '}
          {step.allowedSides.map((s) => (s === 'prefix' ? 'префикс' : 'суффикс')).join(' или ')}
          {step.minModifierLevel !== null && `, только моды уровня ≥ ${step.minModifierLevel}`}. Мод выбирается
          случайно пропорционально весу среди доступных.
        </>
      );
    case 'target':
      return (
        <>
          <b>Цель «{step.label}».</b>{' '}
          {step.entries.map((e) => (
            <span key={e.definition.id} className="inline-item">
              {e.definition.name} T{e.definition.tier}:{' '}
              {e.eligible
                ? `в пуле, вес ${e.weight === null ? 'неизвестен' : formatInt(e.weight)}`
                : `исключён — ${e.reasons.map((r) => exclusionText(r, view)).join('; ')}`}
            </span>
          ))}
          {step.missingModifierIds.length > 0 && ` Нет в этой версии: ${step.missingModifierIds.join(', ')}.`}
        </>
      );
    case 'pool-summary':
      return (
        <>
          <b>Пул.</b> Рассмотрено {step.consideredCount} модов версии, доступно {step.eligibleCount}. Исключения:{' '}
          {Object.entries(step.excludedByReason).map(([code, count]) => (
            <span key={code} className="inline-item">
              {EXCLUSION_TITLE[code as keyof typeof EXCLUSION_TITLE]} — {count}
            </span>
          ))}
          . Мод может быть исключён сразу по нескольким причинам.
        </>
      );
    case 'formula':
      return (
        <>
          <b>Формула.</b> P = вес цели / сумма весов пула = {formatInt(step.targetWeight)} /{' '}
          {formatInt(step.totalWeight)} = <b>{formatPercent(step.probability)}</b>. Ожидаемое число попыток = 1 / P ={' '}
          {formatAttempts(step.expectedAttempts)}. Шанс за N попыток = 1 − (1 − P)ᴺ. Достоверность данных:{' '}
          {CONFIDENCE_LABEL[step.confidence]}.
        </>
      );
    case 'already-satisfied':
      return (
        <>
          <b>Цель уже на предмете:</b> {step.modifierIds.join(', ')}.
        </>
      );
    case 'target-weight-unknown':
      return (
        <>
          <b>Вес цели неизвестен</b> ({step.modifierIds.join(', ')}) — вероятность не считается.
        </>
      );
    case 'caveat':
      return (
        <>
          <b>Оговорка.</b> {caveatText(step.caveat)}
        </>
      );
  }
}
