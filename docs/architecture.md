# Архитектура

PoE 2 Craft Planner — веб-сайт (Next.js). Вся игровая логика живёт в TypeScript-пакетах без
React; сайт только вызывает их и показывает результат.

## Цепочка расчёта (v0.1)

```
текст Ctrl+C
  → item-parser       parseItemText: секции, ilvl, строки модов (без игровых данных)
                      resolveItem: строки → stable modifier ids по каталогу
  → ItemState         неизменяемое состояние предмета (только id + значения)
  → craft-db          forVersion(v): срез данных одной версии игры
  → probability-engine buildEligiblePool: каждый мод версии + причины исключения
                      calculateTargetProbability: P, 1/P, 1−(1−P)^N, квантили
                      explorePool: вкладки → группы → тиры со статусами (v0.2)
                      explainCalculation: структурированное «почему»
  → economy           calculateAttemptCost, calculateStageCost (+ квантили стоимости)
  → apps/web          analyze.ts (композиция) + компоненты (только отображение)
```

## Рабочий стол (v0.2)

```
исходный текст ──parse──► source ItemState ─┐
                                            ├─ CraftSession { source, current, target, steps, seed }
целевой текст  ──parse──► target ItemState ─┘
                                 │
         applyStep(session, action, cost)        ← craft-session: applyAction (демо-симуляция)
                                 │                    = buildEligiblePool + выбор по весу (seeded RNG)
                                 ▼
             новая сессия: current' , steps + 1 , spent = Σ стоимостей шагов
                                 │
   compareToTarget(current, target) → совпадения / не хватает / лишние → цели шага
```

До первого шага `current` следует за текстом исходного предмета (`startFromSource`). После первого
шага сессия хранит свою копию исходного предмета, и правка текста не стирает историю: сайт
предлагает начать заново.

### Взаимодействие (v0.3)

```
палитра: ToolSelection {сфера, omen} ──resolveTool──► CraftAction из данных | unsupported
клик по текущему ──checkApplicable──► отказ (без изменений)  |  applyStep → current', история, потрачено
«+ Добавить…» у исходного / цели ──► ModifierPool в режиме edit-source / edit-target (poolForMode)
выбор тира ──► addSourceModifier / replaceSourceModifier | addRequirement (TargetSpec)
Ctrl+Z / Ctrl+Shift+Z / откат к шагу / Reset ──► undoLastStep / redoStep / undoToStep / resetToSource
```

### Конструктор базы и настройка исходного (v0.4)

```
«Новый предмет» ──► BaseSelector (CraftDbView.listBases / listItemClasses; поиск, класс, сортировка)
выбор базы ──createItemFromBase──► source: пустой редкий предмет (baseId, ilvl, quality, slots)
ilvl / качество / сокеты ──setItemLevel / setQuality / setSlotCount──► source'   (не крафт, 0 стоимости)
«+ Добавить суффикс» ──► тот же ModifierPool, режим edit-source ──► addSourceModifier
«Сделать fractured» ──setSourceModifierFractured──► source'   (не Fracturing Orb)
тир в редакторе мода ◄── sourceTierOptions (manual-edit пул)  · предупреждения ◄── sourceModifierIssues
клик по текущему с валютой в руке ──applyToolStep──► шаг | отказ без трат
```

Арт: `ItemBase.artAssetId` / `Consumable.art` (id) → `apps/web/src/lib/art-manifest.ts` (файл, размер,
источник) → `/icons/game/*.png`. Домен не знает ни путей, ни URL.

### Интерфейс по макету (v0.5)

```
┌ 1 Исходный ─────────┬ 2 Текущий (золотая рамка) ┬ 3 Целевой ──────────────┐
│ база/класс/редкость │ арт · свойства базы        │ требования + статус     │
│ ilvl/качество/сокеты│ моды P/S · T · fractured   │ targetOutlook, прогресс │
├ 4 Инструменты: вкладки · полоса иконок (toolPalette) · Активный крафт ──────┤
│   ToolSelection {валюта, omen} → resolveTool: ready | incompatible | unsupported | none
├ 5 Пул модов: семейства | таблица тиров ┬ 6 История ┬ 7 Затраты: факт | этап ┤
```

## Пакеты и направление зависимостей

| Пакет | Назначение | Зависит от |
|---|---|---|
| `craft-domain` | Типы и чистые правила домена: версии, provenance, моды, ItemState, CraftAction, spawn-веса | — |
| `craft-db` | Набор данных, валидация, версионные срезы (`CraftDbView`), fixture Akoyan Spear | craft-domain |
| `item-parser` | Текст предмета → `ItemState`; каталог — порт `ItemCatalog` | craft-domain |
| `probability-engine` | Пул модов, обозреватель пула, вероятность, геометрическое распределение, объяснение | craft-domain, craft-db |
| `economy` | Снимок цен, стоимость попытки, ожидаемая стоимость этапа, квантили | craft-domain, probability-engine |
| `craft-session` | Демо-применение действий, сессия крафта, сравнение с целевым предметом | craft-domain, craft-db, probability-engine, economy |
| `apps/web` | Next.js сайт | все пакеты выше |

Направление проверяет `tests/architecture.test.ts`: пакеты не импортируют React/Next.js и не
зависят от пакетов вне разрешённого списка. Тестам внутри пакета разрешено брать fixture из
других пакетов (dev-зависимость).

`item-parser` намеренно не зависит от `craft-db`: ему нужен только список баз и модов
(`ItemCatalog`), и `CraftDbView` удовлетворяет этому интерфейсу структурно.

Случайность есть только в `craft-session`, и только через переданный `Rng`. `probability-engine`
остаётся аналитическим и детерминированным.

## Веб-приложение

| Файл | Роль |
|---|---|
| `src/lib/analyze.ts` | `analyzeWorkspace`: пул, обозреватель, сравнение, проверка базы цели, цели шага, вероятность, объяснение, данные формы настройки исходного |
| `src/lib/session-ui.ts` | seed (crypto), бейджи модов, текст уведомлений — без игровых правил |
| `src/lib/texts.ts` | формулировки для кодов статусов, причин и отказов, подписи источников |
| `src/lib/icons.ts`, `src/lib/art-manifest.ts` | id игрового арта → локальный файл; манифест с источником каждой картинки |
| `src/lib/base-catalog.ts` | поиск / фильтр по классу / сортировка в селекторе баз (без игровых правил) |
| `src/lib/held-tool.ts` | что «держит» курсор: иконки и ready / blocked с причиной |
| `src/components/BaseSelector.tsx` | модальное окно выбора базы (`<dialog>`) |
| `src/components/HeldToolCursor.tsx` | оверлей валюты у курсора над предметом (портал, `pointer-events: none`), Omen — кольцевой значок |
| `src/components/Masthead.tsx`, `ToolPalette.tsx`, `HistoryPanel.tsx`, `SpendingPanel.tsx`, `ItemBits.tsx` | шапка, полоса инструментов с активным крафтом, история, затраты, рамка арта и свойства базы |
| `src/app/planner.css` | стили макета: позолоченные рамки, ряды, адаптивность (container queries для узких колонок) |
| `src/components/Workspace.tsx` | состояние страницы и вызовы пакетов |
| `src/components/*Panel.tsx`, `ItemCard.tsx` | отображение |

## Запланированные границы (пакетов пока нет)

- `craft-solver` — поиск маршрута из `CraftAction` по графу состояний.
- `simulator` с точными механиками — сейчас его упрощённую роль выполняет `craft-session/applyAction`.
- `guide-generator` — превращение маршрута в пошаговый гайд с recovery.

## Почему так

- Ядро без React можно гонять в тестах, на сервере, в воркере или CLI без изменений.
- Версия игры входит в каждый расчёт через `CraftContext` и `CraftDb.forVersion`, поэтому
  смешать данные двух патчей нельзя. Смена версии на сайте начинает новую сессию.
- Расчёт синхронный. Для одного этапа это микросекунды, поэтому сервер и API не нужны:
  страница статическая, всё считается в браузере, сессия живёт в состоянии страницы.
