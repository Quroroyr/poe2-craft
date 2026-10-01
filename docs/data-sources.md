# Источники данных

## Что сейчас в CraftDB (v0.1)

Единственный набор — `packages/craft-db/src/fixtures/akoyan-spear.ts`, `kind: 'fixture'`.

| Данные | Статус | Источник | Confidence |
|---|---|---|---|
| Тиры, диапазоны, item level, modifier level, spawn-веса всех модов | **придуманы** | `fixture.akoyan-spear-v0.1` | experimental |
| Группы модов, теги баз | **придуманы** | fixture | experimental |
| Тексты статов (`+# to Level of all Projectile Skills`, `#% to Critical Hit Chance` и др.) | текст существует в PoE 2, но привязка к стороне и тиры — fixture | сверено с trade2/data/stats 02.10.2026 | experimental (запись целиком) |
| Названия баз Akoyan Spear, Recurve Bow | **реальные** | `official.trade2-data` (trade2/data/items), 02.10.2026 | experimental (теги — fixture) |
| Названия валют и Omen, их иконки | **реальные** | `official.trade2-data` (trade2/data/static), 02.10.2026 | official |
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

Иконки © Grinding Gear Games, используются в некоммерческом фан-инструменте. Перед публичным
запуском проверить актуальные правила GGG для фан-сайтов.

Ограничения источника: трейд не отдаёт стороны (префикс/суффикс), тиры, уровни и веса модов.
Для них нужен PoE2DB или разбор файлов игры.

## Будущие источники

| Источник | Что даст | Confidence по умолчанию |
|---|---|---|
| Файлы игры (Mods.datc64 и др.) | моды, тиры, уровни, spawn-веса, группы | verified |
| PoE2DB (poe2db.tw) | то же в готовом виде | community |
| Патчноуты GGG | изменения правил между версиями | official |
| Тесты сообщества / свои наблюдения | веса там, где данных нет; поведение Omen | community / experimental |
| poe.ninja / PoE2Scout | цены | — (ценам confidence не нужен; нужен `capturedAt`) |

Каждый импорт создаёт `DataSource` и проставляет `Provenance` с `lastVerified`. Правила из
PoE 1 без подтверждения для PoE 2 не импортируются (инвариант 11).
