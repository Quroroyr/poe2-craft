# AGENTS.md — правила для AI coding agents

Проект: PoE 2 Craft Planner, веб-сайт для крафта в **Path of Exile 2** (не PoE 1).
Перед работой прочитайте `docs/crafting-invariants.md`: это обязательные правила.

## Структура

| Путь | Назначение |
|---|---|
| `apps/web` | Next.js 16 (App Router). `src/lib/analyze.ts` — композиция; `src/components` — отображение |
| `packages/craft-domain` | Типы домена и чистые правила (версии, provenance, spawn-веса, ItemState) |
| `packages/craft-db` | `CraftDataset`, валидация, `CraftDb.forVersion()`, fixture Akoyan Spear |
| `packages/item-parser` | `parseItemText` (только текст) + `resolveItem` (сопоставление с каталогом) |
| `packages/probability-engine` | `buildEligiblePool`, `calculateTargetProbability`, геометрия, `explainCalculation` |
| `packages/economy` | `PriceSnapshot`, `calculateAttemptCost`, `calculateStageCost` |
| `docs/` | архитектура, доменная модель, инварианты, источники данных, ADR |
| `tests/` | архитектурные границы, наличие иконок |

## Команды

```bash
pnpm install
pnpm dev         # сайт на :3000
pnpm build       # production-сборка
pnpm test        # vitest, все пакеты
pnpm typecheck   # tsc по всем пакетам и сайту
pnpm check       # test + typecheck + build
```

Линтер не настроен; стиль — как в окружающем коде (Prettier-подобный, одинарные кавычки, 2 пробела).

## Границы архитектуры

- Направление зависимостей: `craft-domain` ← `craft-db` ← `probability-engine` ← `economy`;
  `item-parser` зависит только от `craft-domain`. Сайт зависит от всех.
- Пакеты не импортируют React/Next.js (проверяет `tests/architecture.test.ts`).
- В React-компонентах нет игровых правил и расчётов вероятностей.
- Игровые числа живут только в данных CraftDB, у каждой записи есть `provenance`.
- Fixture-данные должны оставаться помеченными (`kind: 'fixture'`, источник `fixture`).

## Правила работы

- **Без посторонних рефакторингов.** Меняйте то, что нужно для задачи; не переименовывайте и не
  переформатируйте попутно.
- **API `craft-domain` не меняется без причины.** Не хватает чего-то в UI — адаптер в
  `apps/web/src/lib`. Если менять домен действительно нужно, опишите причину в PR.
- **Фундаментальные изменения — через ADR.** Новая модель данных, другой способ версионирования,
  новая модель вероятностей, перенос расчёта на сервер — обновите или добавьте ADR в `docs/adr/`.
- **Исправили механику крафта — добавьте регрессионный тест,** который падал до исправления.
- **Не подгоняйте данные под ожидаемый процент.** Ожидания в тестах выводятся из данных; вывод
  записан комментарием рядом.
- **Не переносите механики из PoE 1.** Неподтверждённое для PoE 2 — только `experimental` с пояснением.
- **Неизвестное не превращается в ноль.** Неизвестный вес — `null`; нераспознанная строка — `UnresolvedModifier`.
- После изменений запускайте `pnpm check`.
