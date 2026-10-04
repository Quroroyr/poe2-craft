# AGENTS.md — правила для AI coding agents

Проект: PoE 2 Craft Planner, веб-сайт для крафта в **Path of Exile 2** (не PoE 1).
Перед работой прочитайте `docs/crafting-invariants.md`: это обязательные правила.

## Структура

| Путь | Назначение |
|---|---|
| `apps/web` | Next.js 16 (App Router). `src/lib/analyze.ts` — композиция (`analyzeWorkspace`); `src/components/Workspace.tsx` — состояние страницы; `src/lib/art-manifest.ts` — локальные картинки и их источники; остальные компоненты — отображение |
| `packages/craft-domain` | Типы домена и чистые правила (версии, provenance, spawn-веса, ItemState) |
| `packages/craft-db` | `CraftDataset`, валидация, `CraftDb.forVersion()`, fixture (моды — `akoyan-spear.ts`, каталог баз — `bases.ts`, источники — `sources.ts`) |
| `packages/item-parser` | `parseItemText` (только текст) + `resolveItem` (сопоставление с каталогом) |
| `packages/probability-engine` | `buildEligiblePool`, `calculateTargetProbability`, геометрия, `explainCalculation` |
| `packages/economy` | `PriceSnapshot`, `calculateAttemptCost`, `calculateStageCost` |
| `packages/craft-session` | `applyAction` + `checkApplicable` (демо-симуляция), `CraftSession` (undo/redo/reset), инструменты (`resolveTool`, `applyToolStep`), настройка source (`item-setup.ts`: база, ilvl, качество, слоты, fractured, тиры), `poolForMode`, сравнение с `TargetSpec` |
| `docs/` | архитектура, доменная модель, инварианты, источники данных, ADR |
| `tests/` | архитектурные границы, картинки (манифест + файлы); тесты сайта — `apps/web/src/**/*.test.tsx` |

## Команды

```bash
pnpm install
pnpm dev         # сайт на :3000
pnpm build       # production-сборка
pnpm test        # vitest, все пакеты
pnpm typecheck   # tsc по всем пакетам и сайту (у сайта без инкрементального кэша — он прятал ошибки)
pnpm check       # test + typecheck + build
```

Линтер не настроен; стиль — как в окружающем коде (Prettier-подобный, одинарные кавычки, 2 пробела).

## Границы архитектуры

- Направление зависимостей: `craft-domain` ← `craft-db` ← `probability-engine` ← `economy` ← `craft-session`;
  `item-parser` зависит только от `craft-domain`. Сайт зависит от всех.
- Текущий предмет меняется только операциями сессии в `craft-session`: craft-шаг (`applyStep` / `applyToolStep`), ручная правка (`applyManualEdit`, ADR 009), `undoLastStep` / `redoStep` / `undoToStep`, `resetToSource`; source — только настройкой (`setSource` + функции `item-setup.ts`), target — функциями `TargetSpec`.
- История — `SessionStep = CraftStepRecord | ManualEditStepRecord`: читая `session.steps`, различайте `kind`; потрачено — только `craftSteps`. Ручная правка не выдаётся за Annulment / Fracturing Orb / улучшение тира.
- Контекстное меню модов: пункты строит `apps/web/src/lib/mod-menu.ts` из функций craft-session, `Workspace` выполняет намерения; у каждой строки есть кнопка «…» — только ПКМ недостаточно.
- Подпись семейства модов — `familyTemplate` (craft-domain) по тирам семейства; имя collision-группы (`ModifierGroup.name`) — техническое, его не выводите как название семейства.
- ПКМ по плитке палитры — справка (`toolInfo` в craft-session → `ToolInfoPopover`), не выбор. Закрытие плавающих поверхностей — общий `useDismiss` из `ContextMenu.tsx`.
- Буквенные горячие клавиши — по `KeyboardEvent.code` (`apps/web/src/lib/shortcuts.ts`), не по `key`: иначе они не работают на русской раскладке.
- Экран ≠ архитектура (ADR 010): исходный остаётся в `CraftSession`, но на экране — строка над текущим и поверхность настройки (`SourceSetupSurface`); текущий — главный верстак, цель всегда справа. Новая сессия пуста; входы — Ctrl+V / «Импорт» (одно превью) и «Создать предмет». Экраны и диалоги — UI-состояние `Workspace`, в домен не попадают.
- **Текст интерфейса — только через `t()`** (`apps/web/src/i18n`): новый ключ — в `en.ts` и `ru.ts` (тип `Messages` требует оба), подстановки `{name}`, множественное число — объект `{ one, few, many, other }`. Не пишите `locale === 'ru' ? … : …` в компонентах; кириллица в коде компонентов и `lib/` ломает тест. Игровые названия из данных не переводятся.
- Настройка исходного — не крафт: не пишет шагов и не стоит денег. Fractured при настройке — не Fracturing Orb (ADR 007).
- `ItemState` ссылается на базу только `baseId`; арт, свойства и правила настройки — в `ItemBase`. Домен хранит id арта, путь к файлу знает только `art-manifest.ts`; новую картинку — скачать локально и записать источник.
- Качество, слоты и другие записанные, но не смоделированные свойства не влияют на расчёт без отдельного проверенного правила в пакете.
- Палитра показывает все известные расходники; применяется только действие из данных, остальное — «не смоделировано» (ADR 008). Omen при смене валюты не сбрасывается.
- Статусы цели (`targetOutlook`), разбивка затрат (`sessionSpentByConsumable`) — в craft-session; сайт только показывает.
- Случайность — только через переданный `Rng`; `Math.random` в пакетах запрещён.
- Симуляция подписывается как демо, пока механика не подтверждена данными.
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
