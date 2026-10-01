# Доменная модель

Все типы — в `packages/craft-domain/src`. Поля `readonly`, записи данных несут `versions` и `provenance`.

## Версии и происхождение данных

| Понятие | Где | Суть |
|---|---|---|
| `GameVersion` | version.ts | строка `"major.minor.patch"`, сравнение — `compareGameVersions` (численно) |
| `VersionRange` | version.ts | `introducedIn` (вкл.), `removedIn` (искл.), `changedIn` (справочно) |
| `Provenance` | provenance.ts | `sourceId`, `confidence`, `lastVerified?`, `notes?` |
| `DataSource` | provenance.ts | `id`, `kind` (official / game-data / poe2db / community-testing / observation / inferred / fixture), `title`, `url?` |
| `Confidence` | provenance.ts | official > verified > community > experimental; `weakestConfidence` берёт слабейшее |

## Игровые данные (живут в CraftDB)

| Понятие | Суть |
|---|---|
| `ItemClass` | класс предмета; `clipboardName` — значение строки `Item Class:` |
| `ItemBase` | база (Akoyan Spear); `tags` — теги для spawn-весов |
| `ModifierGroup` | группа коллизий: два мода с общей группой не уживаются на предмете |
| `ModifierDefinition` | **один тир** мода: `id` (стабильный), `side`, `tier`, `groupIds[]`, `requiredItemLevel`, `modifierLevel`, `lines[]` (шаблон с `#` + диапазоны), `spawnWeights[]`, `tags`, `versions`, `provenance` |
| `SpawnWeight` | `(tag, weight)`; `weight: null` = вес неизвестен |
| `AffixLimitRule` | лимит префиксов/суффиксов для редкости (данные, а не код) |
| `Consumable` | расходник: валюта, Omen; `art` — игровой id иконки |
| `CraftAction` | действие: `requirements`, `effect` (union, пока только `add-random-modifier`), `defaultCost` |
| `CraftTarget` | цель: набор допустимых `modifierIds` («+3 и выше» = два тира в списке) |

`ModifierTier` отдельным типом не выделен: в данных игры каждый тир — отдельная запись мода со
своим весом и уровнем, так и моделируем. Тиры одного стата объединяет общая `ModifierGroup`.

`requiredItemLevel` и `modifierLevel` разделены, хотя в известных данных совпадают: эффекты
крафта фильтруют по уровню мода (`AddRandomModifierEffect.minModifierLevel`), а не по ilvl.

## Состояние предмета

```ts
ItemState {
  baseId | null, baseName, itemClassName, rarity, itemLevel,
  explicits: (ResolvedModifier | UnresolvedModifier)[],
  otherLines: { source: implicit|rune|enchant|other, text }[],
  corrupted
}
ResolvedModifier   { modifierId, values[], fractured, sourceText }
UnresolvedModifier { sourceText, fractured, reason, sideHint?, groupIdsHint? }
```

- Только stable id и выпавшие значения. Полное определение берётся из CraftDB той версии, в
  которой идёт расчёт.
- `createItemState` глубоко замораживает объект. Изменение предмета = новый `ItemState`.
- `fractured` — свойство конкретного мода на предмете, а не определения.
- Нераспознанная строка не выбрасывается: она занимает слот, а если известна её сторона или
  группа, то блокирует их (осторожная оценка).

## Расчёт

| Понятие | Пакет | Суть |
|---|---|---|
| `CraftContext` | domain | `{ gameVersion }` — окружение расчёта |
| `CraftDbView` | craft-db | срез данных одной версии; все запросы идут через него |
| `EligiblePool` | probability-engine | `ready` (entries с причинами, eligible, totalKnownWeight, caveats) или `blocked` (issues) |
| `ExclusionReason` | probability-engine | почему мод не может выпасть (union с данными для объяснения) |
| `ProbabilityResult` | probability-engine | `ok` / `blocked` / `already-satisfied` / `target-unavailable` / `indeterminate` |
| `ExplanationStep` | probability-engine | шаги «почему» как данные; текст пишет UI |
| `PriceSnapshot` | economy | цены в одной единице, `source: manual|mock` |
| `AttemptCost`, `StageCost` | economy | цена попытки; ожидаемая стоимость + квантили |

`CraftStep` (шаг гайда) в v0.1 не введён: без солвера он был бы пустой обёрткой над
`(action, target, ProbabilityOk, StageCost)`. Появится вместе с `guide-generator`. Записанный шаг
сессии — это другое понятие, `CraftStepRecord` (ниже).

## Рабочий стол и сессия (v0.2)

Три разных предмета, которые нельзя путать:

| Предмет | Откуда | Роль |
|---|---|---|
| **source** — исходный | вставлен из игры | база, с которой начали; не меняется действиями |
| **current** — текущий | `source` + применённые шаги | то, что сейчас крафтится; меняется только через `applyStep` |
| **target** — целевой | вставлен из игры | пример желаемого результата; используется для сравнения и как источник целей шага |

| Понятие | Пакет | Суть |
|---|---|---|
| `withExplicitModifier` | domain | новый `ItemState` с ещё одним модом; исходный не меняется |
| `renderModifierText` | domain | текст мода с конкретными значениями (точность берётся из диапазона) |
| `CraftSession` | craft-session | `{ gameVersion, seed, rollCount, source, current, target, steps }`, неизменяемая |
| `CraftStepRecord` | craft-session | номер, действие, `AttemptCost` на момент шага, `before`, `after`, выпавший мод и его шанс |
| `ApplyOutcome` | craft-session | `applied` (новый предмет, мод, его доля) или `rejected` (`pool-blocked`, `no-eligible-modifiers`, `unknown-weights`) |
| `SessionSpent` | craft-session | факт: сумма стоимостей шагов, флаги «не всё оценено» и «разные единицы» |
| `Rng` | craft-session | `() => [0, 1)`; `rollRng(seed, n)` — поток для n-го броска |
| `ItemComparison` | craft-session | строки целевого предмета со статусом matched / better-tier / worse-tier / missing / unknown, плюс лишние моды и `matched/total` |
| `targetFromModifier` | craft-session | цель шага «этот тир или лучше» по моду целевого предмета |
| `PoolExplorer` | probability-engine | вкладки (prefix / suffix; позже особые пулы) → группы → тиры; статус, вес, доля |
| `ExplorerStatus` | probability-engine | eligible / already-present / blocked (мешает состояние или действие) / excluded (не выпадет на этом ilvl) |

Что честно, а что демо:

- **Честно (по данным набора):** пул, веса, причины исключения, вероятность, ожидаемая стоимость,
  сравнение по группам и тирам, учёт потраченного.
- **Демо-симуляция:** что именно выпало при «Применить». Модель: один мод пропорционально весу и
  значения равномерно в диапазоне. Реальное поведение валют и Omen PoE 2 не проверено, а все числа
  в наборе — fixture.
