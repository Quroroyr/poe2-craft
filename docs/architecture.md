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
| `src/lib/analyze.ts` | `analyzeWorkspace`: парсинг обоих предметов, синхронизация сессии, пул, обозреватель, сравнение, цели шага, вероятность, объяснение |
| `src/lib/session-ui.ts` | seed (crypto), бейджи модов, текст уведомлений — без игровых правил |
| `src/lib/texts.ts` | формулировки для кодов статусов, причин и отказов |
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
