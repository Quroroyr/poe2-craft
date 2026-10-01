'use client';

import { useMemo, useState } from 'react';
import type { ConsumableAmount } from '@poe2-craft/craft-domain';
import { calculateAttemptCost, calculateStageCost } from '@poe2-craft/economy';
import { SAMPLE_ITEMS } from '@poe2-craft/item-parser';
import { DEFAULT_GAME_VERSION, analyzeStage, craftDb } from '@/lib/analyze';
import { INITIAL_PRICE_INPUTS, snapshotFromInputs, type PriceInputs } from '@/lib/prices';
import { DataPanel } from './DataPanel';
import { EconomyPanel } from './EconomyPanel';
import { ExplanationPanel } from './ExplanationPanel';
import { ItemInput } from './ItemInput';
import { ParsedItem } from './ParsedItem';
import { PoolTable } from './PoolTable';
import { ProbabilityPanel } from './ProbabilityPanel';
import { StageControls } from './StageControls';

const DEFAULT_ACTION = 'action.add-random-modifier';
const DEFAULT_TARGET = 'target.projectile-levels-4';

export function Planner() {
  const [itemText, setItemText] = useState(SAMPLE_ITEMS[0]?.text ?? '');
  const [gameVersion, setGameVersion] = useState(DEFAULT_GAME_VERSION);
  const [actionId, setActionId] = useState(DEFAULT_ACTION);
  const [targetId, setTargetId] = useState(DEFAULT_TARGET);
  const [costLines, setCostLines] = useState<readonly ConsumableAmount[]>(
    () => craftDb.forVersion(DEFAULT_GAME_VERSION).getAction(DEFAULT_ACTION)?.defaultCost ?? [],
  );
  const [priceInputs, setPriceInputs] = useState<PriceInputs>(INITIAL_PRICE_INPUTS);
  const [pricesEdited, setPricesEdited] = useState(false);

  const analysis = useMemo(
    () => analyzeStage({ itemText, gameVersion, actionId, targetId }),
    [itemText, gameVersion, actionId, targetId],
  );
  const snapshot = useMemo(() => snapshotFromInputs(priceInputs, pricesEdited), [priceInputs, pricesEdited]);
  const attemptCost = useMemo(() => calculateAttemptCost(costLines, snapshot), [costLines, snapshot]);
  const probability = analysis.probability;
  const stageCost = useMemo(
    () => (probability?.status === 'ok' ? calculateStageCost(probability.probability, attemptCost.total) : null),
    [probability, attemptCost.total],
  );

  const changeAction = (id: string) => {
    setActionId(id);
    setCostLines(analysis.view.getAction(id)?.defaultCost ?? []);
  };
  const changePrice = (id: string, text: string) => {
    setPriceInputs((prev) => ({ ...prev, [id]: text }));
    setPricesEdited(true);
  };

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>PoE 2 Craft Planner</h1>
          <p className="masthead-sub">Предмет → пул модов → шанс → стоимость этапа. Только Path of Exile 2.</p>
        </div>
        {analysis.view.info.kind === 'fixture' && (
          <p className="fixture-banner" role="note">
            <strong>Демо-данные.</strong> Тиры, уровни и веса модов придуманы для проверки движка — это не
            реальные числа PoE 2.
          </p>
        )}
      </header>

      <main className="layout">
        <div className="col">
          <ItemInput text={itemText} onChange={setItemText} />
          <ParsedItem parse={analysis.parse} view={analysis.view} />
        </div>
        <div className="col">
          <StageControls
            db={craftDb}
            view={analysis.view}
            gameVersion={gameVersion}
            actionId={actionId}
            targetId={targetId}
            onGameVersion={setGameVersion}
            onAction={changeAction}
            onTarget={setTargetId}
          />
          <ProbabilityPanel result={probability} view={analysis.view} />
          <EconomyPanel
            view={analysis.view}
            lines={costLines}
            onLines={setCostLines}
            priceInputs={priceInputs}
            onPrice={changePrice}
            attemptCost={attemptCost}
            stageCost={stageCost}
            priceSource={snapshot.source}
          />
        </div>
        <div className="wide">
          <PoolTable pool={analysis.pool} target={analysis.target} probability={probability} view={analysis.view} />
          <ExplanationPanel steps={analysis.explanation} view={analysis.view} />
          <DataPanel view={analysis.view} probability={probability} />
        </div>
      </main>
    </div>
  );
}
