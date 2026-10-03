# Архитектура

PoE 2 Craft Planner — веб-сайт (Next.js). Вся игровая логика живёт в TypeScript-пакетах без
React; сайт только вызывает их и показывает результат.

## Real Data Foundation (2026-10-03)

По умолчанию Workspace передаёт `realCraftDb` во все сценарии анализа, импорта, настройки и
сессии. Demo выбирается отдельно и использует fixture. Переключение набора начинает пустую сессию;
наборы не смешивают версии, предметы, действия и цены. Наличие Demo в клиентском бандле не делает
его данные production-данными: validator запрещает fixture provenance в production.

`productionDataset` собирается из generated JSON, правил класса и `mechanics.json`.
`buildEligiblePool` учитывает домен, слой, базу, ilvl, сторону, группы и лимиты класса.
Тир вычисляет `view.tierOf(id, baseId)`. Особые implicit/corruption слои показаны отдельно.

Операции крафта и модификаторы Omen описаны в [ADR 011](adr/011-production-operations.md).
Отказ не меняет предмет, историю и затраты. Составное действие не получает вероятность
одного добавления: такой расчёт остаётся indeterminate. Неизвестные spawn-веса запрещают
случайное добавление; равномерные удаления и броски значений остаются community-моделью.

`apps/web/src/server/poe-ninja.ts` — Node-only адаптер; `/api/prices` — серверный proxy.
Клиент обращается только к своему API. Кэш на диске `.cache/poe-ninja`, минимум 5 минут,
ETag, объединение одновременно выполняющихся запросов, собственный User-Agent.
`PriceSnapshot` отделяет league/capturedAt от gameVersion; пакет economy не делает HTTP.
Workspace объединяет рыночный снимок с ручными переопределениями. Неполная цена не выдаётся
за полную стоимость попытки или ожидаемую стоимость. Цена базы вводится отдельно.

Арт production: `production-art.json` → `/art/*.png`; картинки скачивает `pnpm data:art`.
Сборка вызывает этот скрипт, чтобы свежий checkout получил локальные картинки.
PNG и кэши не коммитятся; манифест с URL, размерами и SHA256 — в git.

Итоги и ограничения: [отчёт](handoff/real-data-final-report.md).

## v0.8 — каталог баз и community-веса

```
production data (1841 баз, все записи) ──craft-db/catalog.ts──► видимость (player-facing / test / internal / unknown)
                                                                 + архетип защиты (свойства × атрибутный тег)
                                         ──web/lib/base-navigation.ts──► тип → вид → база (BaseSelector)
PoE2DB ──data:weights──► WeightTable на группу баз ──ItemBase.weightTableId──► CraftDbView.weightFor
                                                       ──► PoolEntry.weight ──► вероятность | обозреватель | pickWeighted
```

Каталог и навигация — слой представления над данными: ItemClass и набор не меняются, импорт
Ctrl+V распознаёт и скрытые записи. Веса — ADR 012.

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

### Ручная правка текущего и контекстное меню (v0.6, ADR 009)

```
ПКМ / «…» по моду ──buildModMenu (lib/mod-menu.ts)──► ContextMenu ──MenuIntent──► Workspace
  current: applyManualEdit ──► ManualEditStep (retier | remove | replace | fracture | unfracture), 0 стоимости
           «Заменить из пула» ──► ModifierPool, режим edit-current (replaceIndex) ──► applyManualEdit(replace)
  source:  replaceSourceModifier / setSourceModifierFractured / removeSourceModifier   (настройка, не шаг)
  target:  setRequirementTier / setRequirementFractured / removeRequirement
  все:     «Показать в пуле» (вкладка + семейство + тир) · «Добавить в цель» = addModifierToTarget (без дублей)
история: SessionStep = craft | manual-edit → undo / redo одинаково; потрачено = только craft-шаги
```

### Входные сценарии, раскладка и язык (v0.7, ADR 010)

```
первое открытие: сессия пуста ─► стартовый экран (Импорт / Создать) │ цель справа
Ctrl+V на странице / «Импорт предмета» ─► recognizeItem ─► превью ─► «Начать крафт» = startFromSource
«Создать предмет» / «Изменить исходный» ─► SourceSetupSurface (SourcePanel + BaseSelector + пикер edit-source
                                            + меню исходного над черновиком) ─► startFromSource | setSource
активная работа: [ строка исходного ][ ТЕКУЩИЙ — верстак ]  [ ЦЕЛЬ ]
                 инструменты · пул модов · история · затраты · «Как посчитано»
язык: I18nProvider (EN по умолчанию, localStorage) ─► t(key, params) / fmt ─► все компоненты и lib/
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
| `craft-session` | Демо-применение действий, сессия крафта (craft-шаги и ручные правки), сравнение с целевым предметом | craft-domain, craft-db, probability-engine, economy |
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
| `src/lib/base-navigation.ts` | дерево выбора базы: тип → вид (архетип защиты / класс оружия) → база, поиск только по видимым базам; классификация — `craft-db/src/catalog.ts` |
| `src/lib/held-tool.ts` | что «держит» курсор: иконки и ready / blocked с причиной |
| `src/i18n/core.ts`, `en.ts`, `ru.ts`, `I18nProvider.tsx` | язык интерфейса: типизированные ключи, `t()` с подстановкой и множественным числом, форматирование, провайдер с localStorage |
| `src/components/StartScreen.tsx`, `ImportDialog.tsx`, `ImportPreview.tsx`, `StartStrip.tsx`, `SourceSetupSurface.tsx` | входные сценарии: старт, импорт и превью, строка исходного, поверхность настройки исходного |
| `src/test-utils.tsx` | рендер `Workspace` в тестах (язык, демо-сессия, вставка, клики) |
| `src/lib/mod-menu.ts` | пункты контекстного меню мода (current / source / target) как данные и намерения |
| `src/components/ContextMenu.tsx`, `ModMoreButton.tsx`, `ManualEditDialog.tsx` | меню у курсора (портал, в пределах экрана, клавиатура), кнопка «…», одноразовое предупреждение о ручной правке |
| `src/components/BaseSelector.tsx` | модальное окно выбора базы (`<dialog>`) по шагам: крошки, «Назад», Escape, поиск по всем базам и внутри группы |
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
