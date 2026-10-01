# Архитектура

PoE 2 Craft Planner — веб-сайт (Next.js). Вся игровая логика живёт в TypeScript-пакетах без
React; сайт только вызывает их и показывает результат.

## Цепочка v0.1

```
текст Ctrl+C
  → item-parser       parseItemText: секции, ilvl, строки модов (без игровых данных)
                      resolveItem: строки → stable modifier ids по каталогу
  → ItemState         неизменяемое состояние предмета (только id + значения)
  → craft-db          forVersion(v): срез данных одной версии игры
  → probability-engine buildEligiblePool: каждый мод версии + причины исключения
                      calculateTargetProbability: P, 1/P, 1−(1−P)^N, квантили
                      explainCalculation: структурированное «почему»
  → economy           calculateAttemptCost, calculateStageCost (+ квантили стоимости)
  → apps/web          analyze.ts (композиция) + компоненты (только отображение)
```

## Пакеты и направление зависимостей

| Пакет | Назначение | Зависит от |
|---|---|---|
| `craft-domain` | Типы и чистые правила домена: версии, provenance, моды, ItemState, CraftAction, spawn-веса | — |
| `craft-db` | Набор данных, валидация, версионные срезы (`CraftDbView`), fixture Akoyan Spear | craft-domain |
| `item-parser` | Текст предмета → `ItemState`; каталог — порт `ItemCatalog` | craft-domain |
| `probability-engine` | Пул модов, вероятность, геометрическое распределение, объяснение | craft-domain, craft-db |
| `economy` | Снимок цен, стоимость попытки, ожидаемая стоимость этапа, квантили | craft-domain, probability-engine |
| `apps/web` | Next.js сайт | все пакеты выше |

Направление проверяет `tests/architecture.test.ts`: пакеты не импортируют React/Next.js и не
зависят от пакетов вне разрешённого списка. Тестам внутри пакета разрешено брать fixture из
других пакетов (dev-зависимость).

`item-parser` намеренно не зависит от `craft-db`: ему нужен только список баз и модов
(`ItemCatalog`), и `CraftDbView` удовлетворяет этому интерфейсу структурно.

## Запланированные границы (пакетов пока нет)

- `craft-solver` — поиск маршрута из `CraftAction` по графу состояний.
- `simulator` — применение действий: `ItemState A + CraftAction → распределение ItemState B`.
- `guide-generator` — превращение маршрута в пошаговый гайд с recovery.

Пустые пакеты не создавались специально (см. ТЗ: «не создавай пустые пакеты ради дерева»).
Задел под них в домене: `CraftEffect` — расширяемый discriminated union, а `ProbabilityOk.outcomes`
уже даёт распределение исходов одного действия.

## Почему так

- Ядро без React можно гонять в тестах, на сервере, в воркере или CLI без изменений.
- Версия игры входит в каждый расчёт через `CraftContext` и `CraftDb.forVersion`, поэтому
  смешать данные двух патчей нельзя.
- Расчёт синхронный и детерминированный. Для одного этапа это микросекунды, поэтому сервер
  и API в v0.1 не нужны: страница статическая, всё считается в браузере.
