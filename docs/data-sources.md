# Источники данных

## Production foundation (0.5.5 / клиент 4.5.5.2)

Production-набор: `packages/craft-db/src/production`. Факты — RePoE PoE 2 export,
ревизия `b818b843337cae43b090b272fd98bbc0fd3a34f3`; `trade2/data/items` и `static`
подтверждают базы и каталог расходников. Хеши, даты и ревизии — `data/raw/manifest.json`.
RePoE tooling — MIT, PyPoE — GPL-3.0; игровые данные и изображения принадлежат GGG.
PoE2DB и Craft of Exile — только ручная сверка, их данные и веса не импортируются.

Клиент содержит разрешения спавна 0/1, не вероятностные веса: в production это
`spawns: boolean`, `weight: null`. Числовой вес принимается только с `WeightEvidence`.
Тир зависит от базы. Соответствие клиента 4.5.5.2 игре 0.5.5 — допущение исследования.
Скрытые implicit-механики сохраняют id/statIds без текста; пропуски explicit без текста — warnings.

`pnpm data:refresh`: fetch → normalize → validate → report. Для закреплённого экспорта:
`pnpm data:fetch:pinned`, затем normalize/validate/report. Отчёт — `data/coverage-report.json`.
Сырые файлы не коммитятся, JSON и manifest коммитятся. Нужен Node ≥23.
Подробности источников и лицензий — `docs/research/real-data-landscape.md`.

## Production mechanics, art and economy (2026-10-03)

`production/mechanics.json` содержит 9 базовых действий и 8 модификаторов Omen.
Источники — описания расходников из закреплённого RePoE `base_items.json`; точный текст
и пояснение модели сохранены в description/mechanicNotes. Confidence — community,
статус modelled, не verified. Равномерное удаление/выбор fracture и равномерные броски
значений — явные допущения модели. Greater/Perfect currencies, эссенции, руны и остальные
несмоделированные расходники не выполняют крафт. Клиентский текст не доказывает распределение.

poe.ninja: [документация API](https://poe.ninja/docs/api), только публичная PoE 2 economy:
`/poe2/api/economy/leagues`, `/poe2/api/economy/exchange/current/overview`.
Типы: Currency, Ritual, Essences, Runes, SoulCores, Abyss, Delirium, Breach.
Цена — `lines.primaryValue`, единица — `core.primary` (divine → div), id совпадает с trade id.
Ошибка источника не заменяется mock-ценами. Сервер кэширует минимум 5 минут и учитывает ETag.
Снимок и кэш не коммитятся. `pnpm data:prices [league]` пишет `data/prices/latest.json`.
Лига выбирается из списка API, отдельно от версии клиента. Ручная цена сохраняется при refresh.

`pnpm data:art`: 980 уникальных PNG / 41 701 239 bytes из
`https://repoe-fork.github.io/poe2/<artAssetId>.png`. Игровые изображения © GGG;
лицензия MIT tooling не передаёт права на игровой контент. Runtime не хотлинкает изображения.
Манифест `apps/web/src/lib/production-art.json` и отчёт `data/art-report.json` коммитятся,
`apps/web/public/art/` игнорируется и заполняется при build. У art-сайта нет закреплённого
URL по ревизии: SHA256 фиксирует скачанные байты, однако доступность и будущие байты upstream
могут измениться. Файлы в локальном кэше повторно не скачиваются.

## Demo / fixture (v0.4)

Демонстрационный набор — `packages/craft-db/src/fixtures/akoyan-spear.ts`, `kind: 'fixture'`; каталог баз
вынесен в `fixtures/bases.ts`, источники — в `fixtures/sources.ts`.

| Данные | Статус | Источник | Confidence |
|---|---|---|---|
| Тиры, диапазоны, item level, modifier level, spawn-веса всех модов | **придуманы** | `fixture.akoyan-spear-v0.1` | experimental |
| Группы модов, теги баз | **придуманы** | fixture | experimental |
| Тексты статов (`+# to Level of all Projectile Skills`, `#% to Critical Hit Chance` и др.) | текст существует в PoE 2, но привязка к стороне и тиры — fixture | сверено с trade2/data/stats 02.10.2026 | experimental (запись целиком) |
| Названия 13 баз (5 копий, 5 луков, 3 посоха) | **реальные** | `official.trade2-data` (trade2/data/items), 02.10.2026 | experimental (запись целиком: теги — fixture) |
| Свойства баз (урон, крит, скорость атаки), требования, implicit-строки, арт | **реальные**, наблюдение | `official.trade2-listings`: JSON одного обычного (normal) предмета без качества и сокетов на каждую базу, 02.10.2026 | verified (одно наблюдение, с файлами игры не сверено) |
| Теги спавна баз | **придуманы** | fixture | experimental |
| Диапазон качества 0–20 %, сокеты рун (1 у одноручных, 2 у двуручных) | общеизвестно, не сверено | `unverified.general-knowledge` | experimental |
| Названия и иконки 47 расходников (валюта, Omen, эссенции, катализаторы, руны) | **реальные** | `official.trade2-data` (trade2/data/static), 02.10.2026 | official |
| Какой валюте относится Omen (`Consumable.modifies`) | общеизвестно, не сверено | `unverified.general-knowledge` | experimental |
| Лимиты аффиксов (magic 1/1, rare 3/3) | общеизвестно, не сверено | `unverified.general-knowledge` | experimental |
| Действия (Exalted Orb и т. п.) | упрощённая модель «добавить 1 мод по весу»; реальные эффекты Omen **не закодированы** | fixture | experimental |
| Порог «modifier level ≥ 50» у Perfect Exalted Orb | **придуман** | fixture | experimental |
| Цены | **mock**, пользователь вводит свои | `MOCK_PRICE_SNAPSHOT` | — |
| Тексты предметов для примеров (исходные и целевые) | собраны вручную в формате Ctrl+C; свойства (урон, требования) — заглушки | `item-parser/src/fixtures` | — |
| Результаты «Применить» | демо-симуляция по fixture-весам: выбор мода по весу, значения равномерно в диапазоне | `craft-session` | — |

Итог: все показанные проценты и стоимости — демонстрация движка, а не прогноз для реальной игры.

## Официальные данные GGG

`https://www.pathofexile.com/api/trade2/data/static`, `/items`, `/stats` — публичные
справочники трейда PoE 2. Использованы один раз вручную, чтобы:

- подтвердить, что названия расходников, баз и тексты статов существуют в PoE 2;
- взять иконки (`image` → `https://web.poecdn.com/...`). Файлы скачаны в
  `apps/web/public/icons/game/` и раздаются сайтом сами, без хотлинка на CDN.

`https://www.pathofexile.com/api/trade2/search` + `/fetch` (v0.4) — по одному запросу на базу, с
паузами по лимитам API. Из JSON обычного предмета без качества и сокетов взяты свойства, требования,
implicit-строки и арт базы (`official.trade2-listings`). Картинки предметов 47×188 / 94×188 px (размер
CDN) — сайт показывает их в этом размере или меньше, не растягивая. Источник каждого файла записан в
`apps/web/src/lib/art-manifest.ts`.

Иконки © Grinding Gear Games, используются в некоммерческом фан-инструменте. Перед публичным
запуском проверить актуальные правила GGG для фан-сайтов.

Ограничения источника: трейд не отдаёт стороны (префикс/суффикс), тиры, уровни и веса модов.
Разбор клиента даёт слои, уровни, группы и теги, но не вероятностные веса.

## Будущие источники

| Источник | Что даст | Confidence по умолчанию |
|---|---|---|
| Файлы игры (Mods.datc64 и др.) | моды, уровни, разрешения спавна, группы; вероятностных весов нет | verified (извлечённые факты) |
| PoE2DB (poe2db.tw) | ручная сверка; ingestion не используется | community |
| Патчноуты GGG | изменения правил между версиями | official |
| Тесты сообщества / свои наблюдения | веса там, где данных нет; поведение Omen | community / experimental |
| poe.ninja / PoE2Scout | цены | — (ценам confidence не нужен; нужен `capturedAt`) |

Каждый импорт создаёт `DataSource` и проставляет `Provenance` с `lastVerified`. Правила из
PoE 1 без подтверждения для PoE 2 не импортируются (инвариант 11).

## Оформление, не данные

`apps/web/public/img/workshop.webp` — фон страницы, сгенерирован локально (ComfyUI, Z-Image-Turbo,
лицензия Apache 2.0), исходник — `design/bg/bg_00001_.png`. Это не игровой ассет и не источник данных.
