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
| `ItemBase` | **определение** базы (Akoyan Spear): `tags` — теги для spawn-весов; `artAssetId` — id игрового арта; `details` — свойства, требования, implicit-строки (только показ, свой `provenance`); `setup` — `ItemSetupRules` |
| `ItemSetupRules` | что база позволяет настроить вручную: `quality` (`QualityRule` min/max) и `slots` (`SlotRule`: вид слота, подпись, допустимые количества); нет правила — свойство не предлагается |
| `ModifierGroup` | группа коллизий: два мода с общей группой не уживаются на предмете |
| `ModifierDefinition` | **один тир** мода: `id` (стабильный), `side`, `tier`, `groupIds[]`, `requiredItemLevel`, `modifierLevel`, `lines[]` (шаблон с `#` + диапазоны), `spawnWeights[]`, `tags`, `versions`, `provenance` |
| `SpawnWeight` | `(tag, weight)`; `weight: null` = вес неизвестен |
| `AffixLimitRule` | лимит префиксов/суффиксов для редкости (данные, а не код) |
| `Consumable` | расходник: `category` (currency / omen / essence — по группам трейда), `art` — игровой id иконки |
| `CraftAction` | действие: `requirements`, `effect` (union, пока только `add-random-modifier`), `defaultCost` |
| `CraftTarget` | цель шага для расчёта: набор допустимых `modifierIds` («+3 и выше» = два тира в списке) |
| `TargetRequirement` | требование к финальному предмету: id минимально приемлемого тира + fractured + origin (import / manual) |
| `TargetSpec` | цель целиком: база, ilvl, `requirements[]`, `unresolvedLines[]` (нераспознанное при импорте) |

`ModifierTier` отдельным типом не выделен: в данных игры каждый тир — отдельная запись мода со
своим весом и уровнем, так и моделируем. Тиры одного стата объединяет общая `ModifierGroup`.

`requiredItemLevel` и `modifierLevel` разделены, хотя в известных данных совпадают: эффекты
крафта фильтруют по уровню мода (`AddRandomModifierEffect.minModifierLevel`), а не по ilvl.

## Состояние предмета

Production расширяет определения без изменения fixture: `ItemBase` хранит `domain`, `dropLevel`,
`implicitModifierIds`, `dataStatus`, `aliases`, `ambiguousName`; `ModifierDefinition` — `family`,
`layer: explicit | desecrated`, `domain`, `statIds`. `tier` — справочный глобальный ранг;
`CraftDbView.tierOf(id, baseId)` — реальный ранг на базе. `SpawnWeight.spawns` отделяет разрешение
от неизвестного веса; числовые production-веса требуют `WeightEvidence` с источником и методом.
`SpecialModifierDefinition` содержит implicit/corruption вне аффиксных слотов, включая скрытые statIds.
`AffixLimitRule.itemClassIds` ограничивает правило классами; отсутствие правила означает неизвестные
лимиты. `Consumable.craftStatus` различает catalogued/researched/modelled/verified/unsupported;
modelled/verified требует действия, которое тратит расходник. Production-ссылки на fixture запрещены.

```ts
ItemState {
  baseId | null, baseName, itemClassName, rarity, itemLevel,
  quality: number | null,              // v0.4: записано и показано, в расчёт не идёт
  slots: { kind, count }[],            // v0.4: например { kind: 'rune-socket', count: 1 }
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
- `fractured` — свойство конкретного мода на предмете, а не определения. Его ставит импорт или
  ручная настройка исходного (`setSourceModifierFractured`); это не Fracturing Orb.
- Определение базы (`ItemBase`) в состояние не копируется: арт, свойства, теги и правила настройки
  берутся из CraftDB по `baseId`.
- `quality` и `slots` — факты о предмете. Пока нет проверенного правила, пул и вероятности от них
  не зависят (инвариант 37).
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
| **source** — исходный | импорт из игры и/или ручная правка | база, с которой начали; меняется только руками, никогда — крафтом |
| **current** — текущий | `source` + применённые шаги | то, что сейчас крафтится; меняется только через `applyStep` |
| **target** — цель | импорт примера и/или ручная сборка | `TargetSpec`: требования «семейство не хуже тира N»; используется для сравнения и как источник целей шага |

| Понятие | Пакет | Суть |
|---|---|---|
| `withExplicitModifier` | domain | новый `ItemState` с ещё одним модом; исходный не меняется |
| `renderModifierText` | domain | текст мода с конкретными значениями (точность берётся из диапазона) |
| `CraftSession` | craft-session | `{ gameVersion, seed, rollCount, source, current, target: TargetSpec, steps, redoStack }`, неизменяемая |
| `ToolSelection`, `ResolvedTool` | craft-session | выбранная сфера + omen → действие из данных (`ready`) или `unsupported` |
| `PoolMode` | craft-session | `inspect` / `edit-source` (+ `replaceIndex`) / `edit-target` — один обозреватель на три задачи |
| `MANUAL_EDIT_ACTION` | craft-session | правила «что законно стоит на предмете» для режимов правки; не игровое действие |
| `CraftStepRecord` | craft-session | номер, действие, `AttemptCost` на момент шага, `before`, `after`, выпавший мод и его шанс |
| `ApplyOutcome` | craft-session | `applied` (новый предмет, мод, его доля) или `rejected` (`pool-blocked`, `no-free-slot`, `no-eligible-modifiers`, `unknown-weights`) |
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

## Настройка исходного предмета (v0.4)

| Понятие | Пакет | Суть |
|---|---|---|
| `createItemFromBase` / `blankItem` | craft-session | пустой редкий предмет базы: качество = минимум правила, слоты = первое допустимое значение |
| `itemSetupFields` | craft-session | какие поля база поддерживает: ilvl (границы ввода 1–100), `QualityRule \| null`, `SlotRule[]` |
| `setItemLevel`, `setQuality`, `setSlotCount` | craft-session | новые `ItemState`; значение вне правила — предмет без изменений |
| `setSourceModifierFractured` | craft-session | «мод уже fractured на моей базе» (через `withExplicitFractured` из домена) |
| `sourceTierOptions` | craft-session | тиры семейства мода с `allowed` и причинами — тот же manual-edit пул, что у обозревателя |
| `sourceModifierIssues` | craft-session | почему стартовый мод уже не может стоять на предмете (после смены ilvl/базы); мод не удаляется |
| `applyToolStep` | craft-session | клик инструментом: `ToolSelection` → действие из данных → `AttemptCost` → `applyStep`; отказы `no-item` / `no-tool` / `unsupported-tool` |
| `targetBaseCheck` | craft-session | `match` / `mismatch` / `unknown`: цель на другой базе не планируется |
| `TargetModStatus.not-fractured` | craft-session | требование fractured, а мод на предмете обычный |
| `hasCraftHistory`, `isSourceOutOfSync` | craft-session | есть ли шаги (в т. ч. отменённые); current не происходит от source — нужен Reset |
