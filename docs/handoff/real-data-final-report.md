# Real Data Foundation — итог C–I

Завершено 2026-10-03 (Asia/Vladivostok; исходные снимки получены 2026-10-02 UTC).
Объём: продолжение handoff с C до I, включая production UI, импорт, арт и браузерную QA.

1. **Основной источник.** RePoE PoE 2 export: `repoe-fork/poe2`, ревизия
   `b818b843337cae43b090b272fd98bbc0fd3a34f3`, клиент `4.5.5.2`. Соответствие игре `0.5.5`
   остаётся документированным допущением. URL, SHA256 и размеры raw — `data/raw/manifest.json`.
2. **Официальный источник.** `trade2/data/items`, `static`, `stats` GGG: подтверждение баз,
   названий и категорий. У справочников нет upstream revision; время снимка записано в manifest.
   `--pinned` закрепляет RePoE, но официальный live-справочник при повторном fetch может измениться.
3. **Права и происхождение.** RePoE tooling MIT; PyPoE GPL-3.0. Код этих проектов не копировался.
   Игровой контент принадлежит GGG, используется для некоммерческого фан-инструмента.
   PoE2DB и Craft of Exile — ручная сверка, их данные/веса не импортированы.
4. **Каталог классов.** 31 класс. Расходники распределены по 8 категориям:
   currency, rune, soul-core, liquid-emotion, catalyst, omen, abyssal-bone, essence.
5. **Каталог баз.** 1841 база: 1559 crafting-supported, 243 imported, 39 unsupported.
   Статус crafting-supported означает известные правила класса и применимость, а не известные
   spawn-веса. Jewels/flasks/charms не получают лимиты оружия/брони по умолчанию.
6. **Моды и группы.** 3281 мод в слотах: 3040 explicit, 241 desecrated; 353 особых:
   234 implicit, 119 corruption. Групп — 599. Статус и диапазоны валидируются.
7. **Расходники.** Всего 499: currency 53, rune 210, soul-core 47, liquid-emotion 26,
   catalyst 26, omen 39, abyssal-bone 16, essence 82.
8. **Веса.** В отчёте считаются spawn-правила, не уникальные моды:
   known 0, community 0, unknown 4570, forbidden 4711. Разрешение спавна 0/1 не превращается
   в вероятностный вес; все такие веса `null`. Для числового production-веса обязателен evidence.
9. **Нормализация.** Generated JSON обновляет только скрипт. Развёрнутые числовые диапазоны
   упорядочены; домен desecrated нормализован в item, слой остаётся desecrated.
   Скрытые special-моды сохраняют id/statIds; 28 explicit-модов без текста исключены с warning.
10. **Валидация и отчёт.** `createCraftDb(productionDataset)` проходит validation.
    Проверяются ссылки, слои, стороны, положительные тиры, диапазоны, provenance, конфликты
    версий, расходы и связь modelled-расходника с действием. Машинный отчёт —
    `data/coverage-report.json`; там также полный список действий и warnings.
11. **Применимость.** Общий движок проверяет домен, слой, теги, ilvl, лимиты класса, стороны,
    группы и занятые слоты. Условий по названиям конкретных баз нет. Implicit/corruption
    показаны отдельно и не попадают в обычный explicit roll.
12. **Тиры.** Источник истины — `view.tierOf(modifierId, baseId)`. UI, picker, меню,
    история, ручная правка и сравнение цели используют тир для конкретной базы.
    Семейство учитывает layer/side/family; выбор тира не смешивает несовместимые базы.
13. **Golden cases.** Rare ilvl 82: Akoyan Spear 162, Recurve Bow 140, Rusted Cuirass 144,
    Rawhide Boots 129, Topaz Ring 203, Amber Amulet 209 eligible explicit-модов.
    Полные ids, уровни, семейства, тиры, группы, свойства и implicits сравниваются с
    независимо рассчитанным RePoE `mods_by_base.json`; fractured occupancy проверяет коллизии.
14. **Ручная сверка.** Для шести баз сверены metadata/drop level/tags/implicits с публичными
    страницами PoE2DB. Полные наборы модов проверены автоматом против RePoE, не вручную
    построчно против PoE2DB. Живые страницы могут отличаться по версии.
    Подробности и ссылки — `docs/research/golden-cross-check.md`.
15. **Примитивы.** ADR 011: `operations` — set-rarity, add-random-mod, remove-random-mod,
    reroll-values, fracture-random-mod, corrupt. Требования проверяются до применения;
    отказ атомарный, не тратит валюту и не пишет историю. Каждый add повторно проверяет пул.
    Примитив corrupt только ставит флаг; полная механика Vaal Orb не смоделирована.
16. **Базовые действия.** Exalted, Transmutation, Augmentation, Regal, Alchemy, Chaos,
    Annulment, Divine, Fracturing Orb — modelled/community. Добавление случайного мода
    на production отказывает при неизвестных весах. Annulment/Divine/Fracturing могут
    работать без spawn-весов при выполнении требований, защищая fractured-моды.
17. **Составные вероятности.** Удаление, reroll, fracture, Chaos и multi-add не выдают
    вероятность одного добавления. Их результат indeterminate/compound-action.
    Геометрия этапа не применяется к неизвестной вероятности; веса не подменяются fixture.
18. **Omen.** Восемь модификаторов: Sinistral/Dextral Exaltation, Greater Exaltation,
    Sinistral/Dextral Annulment, Sinistral/Dextral Erasure, Whittling. Композиция через правила
    restrict-side, extra-mod, remove-lowest-level; комбинации не перечисляются таблицей пар.
    Стоимость включает валюту и Omen; одновременно UI выбирает один Omen.
19. **Статусы механик.** 17 modelled (9 валют + 8 Omen), 482 catalogued, verified 0.
    Эссенции, Greater/Perfect currencies, руны, катализаторы и прочее остаются видимыми
    и не выполняют неподтверждённый крафт. Uniform removal/fracture/value rolls — допущения
    community-модели; наблюдений игры для статуса verified пока нет.
20. **Экономика.** Серверный `/api/prices` и `pnpm data:prices` используют публичные endpoints
    poe.ninja. User-Agent, общий disk cache ≥5 минут, ETag, deduplication.
    Используется primaryValue в core.primary, без выдуманных конвертаций. В smoke-запросе
    Forbidden Rites получено 429 цен. Лига и capturedAt не смешиваются с gameVersion;
    capturedAt снимка — самое раннее время получения частей. Неудачный запрос показывает ошибку.
21. **Ручные цены и стоимость.** Ручные переопределения сохраняются при refresh; пустая или
    неверная ручная цена остаётся неизвестной. Реальный режим не использует mock-цены.
    Цена базы вводится отдельно; материалы, ожидаемая стоимость этапа и сумма с базой
    разделены. Неполные цены/неизвестная вероятность не дают числовую итоговую оценку.
22. **Импорт.** Ctrl+V и кнопка используют production-каталог. Неоднозначная база не выбирается
    первой; implicit сопоставляется с special modifier, fractured сохраняется, unknown explicit
    остаётся unresolved. Hybrid-тексты рендерятся без потери значений второй строки.
    Неоднозначные/несопоставленные special-строки сохраняют текст и unresolvedReason;
    многострочные special-моды пока не разрешаются как единый блок.
23. **UI и арт.** Real data 0.5.5 по умолчанию, явный Demo, EN/RU, REAL DATA, modelled,
    NOT MODELLED, UNKNOWN WEIGHT; COMMUNITY WEIGHT предусмотрен для будущих evidence.
    Переключение набора начинает пустую сессию. Каталог баз полный. Все 980 уникальных PNG
    скачаны локально (41 701 239 bytes), runtime hotlinks нет. PNG игнорируются git и
    подготавливаются `data:art` при build; источник/размер/SHA256 находятся в manifest.
    Арт upstream не закреплён по ревизии, это отдельное ограничение воспроизводимости.
24. **Проверки.** `pnpm check`: 345 тестов / 29 файлов, typecheck и production build;
    `data:validate` отдельно (8 production-тестов).
    Chrome с отдельным профилем: 1920/1440/1024/768/390 × оружие/броня/кольцо/амулет,
    20 успешных сценариев создания, без page errors и горизонтального overflow.
    Проверены Ctrl+V preview, refusal без шагов, Annulment с fractured, undo/redo, меню→цель,
    manual edit, ручная цена после live refresh, база, EN/RU, Demo/Real.
    Найденный mobile overflow пяти вкладок пула исправлен. Скриншоты/JSON проверки сохранены
    вне репозитория в `C:/Users/Quroroyr/.codex/tmp/poe-browser/qa/`.
    Dataset JSON ≈4.12 MB, gzip ≈226 KB; суммарный static JS ≈5.29 MB, gzip ≈541 KB
    (это все JS chunks сборки, не измерение network transfer одного открытия).
25. **Обновление и следующий этап.** Node ≥23, pnpm 10.34.6:
    `pnpm data:refresh` = fetch → normalize → validate → report;
    затем `pnpm data:art`, при намеренном изменении эталонов `pnpm data:golden`, `pnpm check`.
    Для закреплённого RePoE — `data:fetch:pinned`, normalize/validate/report.
    Цены — `pnpm data:prices "<league>"` или кнопка UI. Следующий этап: разрешённый источник
    измеренных весов и наблюдения валют/Omen для verified, ограничения sockets/augments,
    full Vaal/essences только после подтверждения. Солвер и маршруты не начинались.

Контрольные точки C–H отправлены в main: `5c4a218`, `992f08d`, `37782fd`, `f365f58`.
Финальная контрольная точка I включает UI, цены, арт, дополнительные regression-тесты и этот отчёт.
Пользовательские `design/bg/*` и `reviews/` исключены из изменений.
