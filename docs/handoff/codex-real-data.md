# Передача работы Codex: этап REAL DATA FOUNDATION

> Фазы C–I завершены 2026-10-03. Итоги, ограничения, проверки и команды обновления:
> [real-data-final-report.md](real-data-final-report.md). Ниже сохранена исходная передача.

Дата: 2026-10-02. База: `main` после коммита «data 2/8 (WIP)». Исходное ТЗ этапа — у владельца
(большой промпт «REAL DATA FOUNDATION», пункты 0–36). Этот документ — где остановились и как
продолжать.

## 0. Перед началом

1. `git pull`, `pnpm install`.
2. Прочитать: `AGENTS.md`, `docs/crafting-invariants.md`, `docs/architecture.md`,
   `docs/domain-model.md`, `docs/data-sources.md`, ADR 001–010,
   **`docs/research/real-data-landscape.md`** и `docs/research/craft-of-exile.md`.
3. Скачать сырые данные (в git их нет):
   ```bash
   pnpm data:fetch:pinned   # тот же снимок, что в data/raw/manifest.json (RePoE b818b843…, клиент 4.5.5.2)
   pnpm data:normalize      # → packages/craft-db/src/production/poe2-data.json
   ```
   Нужен Node ≥ 23 (скрипты — `.ts` с type stripping, без сторонних раннеров). Проверено на Node 24.19.
4. Проверка: `pnpm check` (тесты + typecheck + build) должна быть зелёной на каждом коммите.

## 1. Правила проекта (не нарушать)

- Не ломать v0.7: Source / Current / Target, `ManualEditStep` (ADR 009), undo / redo,
  i18n EN / RU (ADR 010), стартовый экран, Ctrl+V-импорт, контекстное меню.
- **Неизвестный вес остаётся неизвестным** (`weight: null`). Никаких 0, средних, fixture-весов,
  весов соседнего тира. Веса Craft of Exile **не импортировать** (нет разрешения на повторное
  использование) — только ручная сверка.
- PoE2DB и Craft of Exile — только cross-check / поведение, не runtime и не ingestion.
- Никаких `if (Akoyan / Ring / Boots)` в коде. Особые механики — данными / правилами.
- Весь текст интерфейса — через `t()` (`apps/web/src/i18n`, ключ в `en.ts` и `ru.ts`);
  тест падает на кириллице в коде компонентов и `lib/`. Игровые названия не переводятся.
- Не начинать солвер, маршруты, AI-гайды, полные симуляции, визуальный редизайн.
- Коммиты — логическими чекпоинтами, сразу `git push origin main` (владелец так просит).
  **В коммитах и PR не указывать Claude / Codex / ИИ-соавторов** (никаких `Co-Authored-By`,
  «Generated with»). Не добавлять в git `design/bg/*` и `reviews/`.
- Новые механики — новым `CraftEffect.kind`; фундаментальное — через ADR.

## 2. Что уже сделано

| Чекпоинт | Что | Где |
|---|---|---|
| data 1/8 | исследование источников; воспроизводимый снимок | `docs/research/*`, `scripts/data/fetch.ts`, `data/raw/manifest.json` |
| data 2/8 (WIP) | нормализатор; доменные расширения; production-набор собран, **но ещё не подключён и не провалидирован** | `scripts/data/normalize.ts`, `packages/craft-db/src/production/*`, изменения в `craft-domain`, `craft-db` |

### Ключевые факты из исследования

- Основной источник — **RePoE PoE 2 export** (`github.com/repoe-fork/poe2`, закреплён по коммиту).
  Тулинг MIT; содержимое данных — собственность GGG (некоммерческий фан-инструмент).
- **Весов в клиенте нет**: `spawn_weights` только 0/1 = «может / не может появиться». В наборе это
  `spawnWeights: [{ tag, weight: null, spawns: true|false }]`.
- **Тир не хранится, он зависит от базы**: ранг мода в семействе (`family` = RePoE `type`) среди
  модов, которые могут появиться на этой базе, по `requiredItemLevel` (T1 = выше). Пример:
  `IncreasedMana9` — T1 на перчатках, T4 на кольце; у двуручных посохов своя серия.
  Реализовано: `CraftDbView.tierOf(modifierId, baseId)`; в `ModifierDefinition.tier` лежит
  «глобальный» ранг (только для показа без базы).
- Классы снаряжения выводятся данными: у выпущенных баз есть спавнящиеся explicit-моды **и**
  официальный трейд относит базы к weapon / armour / accessory / jewel / flask. Итог: 31 класс,
  1841 база (1597 подтверждены трейдом), 3309 модов в слотах (241 desecrated), 353 особых
  (implicit + corruption), 599 групп, 499 расходников, 28 модов без текста отброшены с warning.
- Расходники — из групп `trade2/data/static`: Currency, Runes, Essences, Ritual→Omens,
  Breach→Catalysts, Delirium→Liquid Emotions, Abyss (кости), Vaal (+Soul Cores). id = trade id
  (`exalted`, `transmute`…), это же id у poe.ninja.
- Эффекты эссенций в экспорте не описаны → эссенции только `catalogued`.
- Версия: клиент `4.5.5.2` ↔ игра `0.5.5` (допущение записано в research).
- poe.ninja: публичны только экономические эндпоинты:
  `GET https://poe.ninja/poe2/api/economy/leagues`,
  `GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league=&type=`.
  Свой User-Agent, кэш ~5 мин (ETag), не опрашивать часто. Билды и профили — нельзя.

### Доменные расширения (все поля необязательные, fixture остаётся валидным)

- `ItemBase`: `domain`, `dropLevel`, `implicitModifierIds`, `dataStatus`
  (`imported | validated | crafting-supported | unsupported`), `aliases`, `ambiguousName`.
- `ModifierDefinition`: `family`, `layer` (`explicit | desecrated`), `domain`, `statIds`.
- `SpawnWeight`: `spawns`, `evidence?: WeightEvidence` (`method`: game-extracted / official /
  recombinator-observation / trade-observation / community-estimate / fixture / unknown).
- `SpecialModifierDefinition` (layer `implicit | corruption`) + `CraftDataset.specialModifiers`.
- `Consumable`: категории `soul-core | liquid-emotion | abyssal-bone`, `craftStatus`
  (`catalogued | researched | modelled | verified | unsupported`), `mechanicNotes`, `tradeGroup`.
- `AffixLimitRule.itemClassIds` (нет правила для класса = лимиты неизвестны → крафт отказывает).
- `isSpawnable` учитывает `spawns`; `sameDomain(mod, base)`.
- `CraftDbView`: `tierOf`, `findBasesByName`, `getSpecialModifier`, `listSpecialModifiers`,
  `getAffixLimits(rarity, itemClassId?)`; `listModifiers({ baseId })` учитывает домен.
- `production/rules.ts`: источники, лимиты 0/0, 1/1, 3/3 только для weapon / armour / accessory
  (самоцветы, фласки, чармы — `unsupported` намеренно), качество 0–20 для weapon / armour.
- `production/index.ts`: `productionDataset` = JSON + правила; статус базы: класс без лимитов →
  `unsupported`, validated → `crafting-supported`.

## 3. Что делать дальше (по порядку ТЗ, фазы C → I)

### C. Доделать нормализацию и валидацию → коммит «data 2/8»
1. Экспортировать `productionDataset` из `packages/craft-db/src/index.ts`.
2. Тест `packages/craft-db/src/production/production.test.ts`: `createCraftDb(productionDataset)`
   не бросает; почти наверняка всплывут проблемы — чинить в нормализаторе, не в данных руками.
3. Расширить `validateDataset` (пункт 28 ТЗ): `side ∈ prefix|suffix`, `layer` валиден, база →
   класс существует, `implicitModifierIds` → `specialModifiers`, группы существуют, тиры > 0,
   `kind: 'production'` не ссылается на источник вида `fixture`, у числового веса в production
   есть `evidence`, `craftStatus: modelled|verified` только если действие тратит расходник,
   противоречивые дубли id в одной версии → ошибка.
4. `pnpm data:validate` (vitest этого теста) и `pnpm data:report` (скрипт отчёта: числа из
   пункта 27 ТЗ, покрытие весов known / community / unknown, статусы расходников, warnings).
   Общая команда обновления: `pnpm data:refresh` = fetch → normalize → validate → report.
5. Обновить `docs/data-sources.md` (новые источники, лицензии) и `docs/domain-model.md`.

### D. Универсальный движок применимости → коммит «data 5/8»
- `buildEligiblePool`: учитывать `sameDomain`, `layer` (обычная валюта — только `explicit`;
  desecrated — только своим действием), лимиты по классу (`getAffixLimits(rarity, base.itemClassId)`),
  `dataStatus === 'unsupported'` → issue `base-not-supported`.
- Везде, где UI показывает тир (`d.tier`, `def.tier`, `added.tier`), брать
  `view.tierOf(id, item.baseId)`: пул (добавить `tier` в `ExplorerRow` / `PoolEntry`), текущий
  предмет, цель, меню (`lib/mod-menu.ts`), ручные правки (`describe` в `manual-edit.ts`),
  `CraftStepRecord.added.tier`, `compareToTarget` (сравнение «тир хуже»). `familyTiers(view, def,
  baseId?)` — фильтровать по базе, сортировать по уровню; `sameFamily` — по `family`, если есть.
- Вкладки пула: Prefixes / Suffixes / Desecrated / Implicit / Corruption — **только если в данных
  есть записи** для этой базы. Компактный пикер v0.5.1 не ломать.

### E. Golden-тесты → коммит «data 6/8»
Akoyan Spear, лук (Recurve/Short Bow), Body Armour, Boots, Ring, Amulet (+ при желании Belt или
Focus). Для каждого: фиксированный ilvl, свойства базы, implicit, eligible prefixes / suffixes,
тиры, коллизии групп, веса = unknown. Сравнить с `data/raw/repoe-poe2/mods_by_base.json`
(независимый расчёт RePoE) автоматически и с PoE2DB вручную; сохранить проверенные снимки
(`packages/craft-db/src/production/golden/*.json`). Если Ring ломается — чинить общий движок.

### F–H. Примитивы и действия → коммит «data 7/8»
- Новый `CraftEffect.kind: 'operations'` со списком операций: `set-rarity`, `add-random-mod`
  (count, sides, minModLevel, layer), `remove-random-mod` (исключая fractured), `reroll-values`,
  `fracture-random-mod`, `corrupt`. Требования: редкость, число модов, не corrupted.
- Omen = модификатор действия (`restrict-side`, `count+1`, `remove-lowest-level`…), а не
  перебор пар. Реализовывать только подтверждённые для PoE 2 эффекты; confidence `community`,
  в `mechanicNotes` — источник. Ни одно действие не помечать `verified` без наблюдений.
- Ожидаемый результат при `weight: null`: Exalt / Transmute / Aug / Regal / Alchemy / Chaos
  **моделируются, но отказывают** (`unknown-weights`), пул и причины видны. Annulment
  (равновероятное удаление), Divine (пересчёт значений), Fracturing Orb — могут работать без весов.
- Палитра: весь каталог; бейджи `modelled` / `not modelled`; клик немоделированным ничего не делает.

### I. Экономика → коммит «data 8/8»
- Серверный роут Next (`apps/web/src/app/api/prices/route.ts`) или скрипт `pnpm data:prices`:
  poe.ninja exchange overview по лиге, кэш на сервере (не с каждого клиента), снимок
  `{ league, capturedAt, source, consumableId, price, unit }`. Лига и время — отдельная ось от
  версии игры. Ручное переопределение цены сохранить.
- Цена базы — ручной ввод (автооценку rare/fractured баз не делать). Показывать отдельно:
  стоимость базы, материалы, ожидаемая стоимость крафта, итого с базой.

### Параллельно
- **Парсер Ctrl+V** на production: база по имени (с `ambiguousName` → неоднозначность, не первая
  попавшаяся), implicit-строки → `specialModifiers`, explicit → семейство и тир через `tierOf`,
  fractured; неоднозначность → `unresolved/ambiguous`, ни одна строка не теряется.
- **UI**: выбор набора данных (Real data 0.5.5 по умолчанию / Demo), метки REAL DATA,
  COMMUNITY WEIGHT, UNKNOWN WEIGHT, NOT MODELLED (тексты — в i18n). Каталог баз в «Создать
  предмет» — весь production-каталог (фильтр по классу уже есть). Картинки баз: RePoE отдаёт PNG
  по пути `artAssetId` (`https://repoe-fork.github.io/poe2/<artAssetId>.png`) — скачивать скриптом
  `pnpm data:art` в `apps/web/public/art/` (решить, коммитить ли ~20 МБ, или gitignore + скрипт),
  не хотлинкать.
- Fixture оставить для unit-тестов и как режим Demo; в production не должно быть fixture-значений.

## 4. Подводные камни

- `poe2-data.json` ≈ 3.9 МБ (gzip ≈ 290 КБ) импортируется в клиентский бандл — следить за размером.
- `listModifiers` линейный; `tierOf` кэшируется по базе. На 3.3k модах ок, при росте — индексы.
- Next 16 dev: открывать `localhost`, не `127.0.0.1` (иначе нет гидратации).
- Vitest 5 на Vite 8: JSX через `oxc`; DOM-тесты — happy-dom, рендер через `src/test-utils.tsx`.
- PowerShell `.ps1` — только UTF-8 с BOM (если понадобятся скрипты под Windows).
- `typecheck` сайта без инкрементального кэша (он прятал ошибки).

## 5. Финальный отчёт владельцу

По пунктам 1–25 из раздела FINAL REPORT исходного ТЗ: источники и их ревизии, лицензии, числа
классов / баз / модов / категорий / расходников, покрытие весов, golden-кейсы и ручные сверки,
архитектура применимости, примитивы, какие валюты catalogued / modelled / verified, Omen /
эссенции, экономика (источник, лига, кэш), парсер, оставшиеся fixture, проверки, браузерная QA
(1920 / 1440 / 1024 / 768 / 390; классы оружие / броня / кольцо / амулет), команды обновления
данных после патча, предложение следующего этапа. Солвер не начинать.
