# DecentralHub — UX Backlog (удобство и раннее тестирование)

> **Цель волны:** владелец проекта должен сам сесть и протестировать платформу **без чтения кода и документации**.
> **Главный критерий:** меньше окон, меньше копипаста, меньше «нужно знать заранее».
>
> **Как работает:** `scripts/marathon-scan.mjs` (категория **R**) читает строки со статусом `todo`
> и ставит их в очередь `M-NN` в [MARATHON.md](./MARATHON.md) **выше** технических задач.
> Automation берёт по одной за run. Закрыл → `todo` → `done` в этом файле.
>
> **Когда список кончится** — генерировать новые по промпту в [MARATHON.md § Генератор UX-задач](./MARATHON.md#генератор-ux-задач).

## Приоритеты

| Код | Значение |
|-----|----------|
| **P0** | Блокирует первый самостоятельный тест. Делать первым. |
| **P1** | Тест возможен, но больно/непонятно. |
| **P2** | Полировка, качество жизни. |

---

## Волна U — путь хоста (P0: сюда упирается первый тест)

| ID | Приор | Задача | Файлы | Критерий готовности | Status |
|----|-------|--------|-------|---------------------|--------|
| U-01 | P0 | Platform URL в агенте заполняется сам — не вводить руками | `artifacts/api-server/src/routes/downloads.ts`, `artifacts/host-agent/src/main/config.ts`, `artifacts/host-agent/src/renderer/index.html` | Скачанный ZIP содержит `config.json` с apiBaseUrl текущего домена; поле в UI предзаполнено; агент коннектится без правок | done |
| U-02 | P0 | Токен хоста вшит в скачиваемый агент — ноль копипаста | `artifacts/api-server/src/routes/downloads.ts`, `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/src/main/config.ts` | «Скачать агент» отдаёт персональный ZIP с hostToken; после `start.bat` агент уже привязан; bind-код только как fallback | done |
| U-03 | P0 | «Выйти в онлайн» на главном экране агента, не в свёрнутых настройках | `artifacts/host-agent/src/renderer/index.html`, `artifacts/host-agent/src/renderer/connect-events.ts` | Кнопка видна сразу при открытии агента; свёрнутые «Расширенные настройки» не содержат основных действий | done |
| U-04 | P0 | Выбор `.exe` через файловый диалог вместо ручного пути | `artifacts/web/src/pages/host/library.tsx`, `artifacts/host-agent/src/renderer/library.ts`, `artifacts/host-agent/src/main/index.ts` | В веб-библиотеке путь можно взять из агента (список найденных игр / Steam-скан), ручной ввод — резервный вариант | todo |
| U-05 | P0 | Квик-старт показывает реальное состояние, а не «шаг 1 всегда выполнен» | `artifacts/web/src/pages/host/dashboard-helpers.ts`, `artifacts/web/src/pages/host/dashboard.tsx` | Шаг «Скачай агент» становится done только по факту (download-эвент или агент once-seen); юнит-тест на step-логику | todo |
| U-06 | P1 | Один способ привязки агента вместо трёх | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/src/renderer/auth.ts`, `artifacts/host-agent/src/renderer/agent-auth.ts`, `artifacts/host-agent/src/renderer/pairing.ts` | Основной путь один (после U-02 — авто); остальные убраны или спрятаны в «Проблемы с подключением»; тексты не противоречат друг другу | todo |
| U-07 | P1 | Убрать дублирующий legacy BindingForm с ценами в USD | `artifacts/web/src/pages/host/binding-form.tsx`, `artifacts/web/src/pages/host/dashboard.tsx` | Настройка игр только через библиотеку (LZT/мин); расписание и RTMP перенесены или удалены; нет двух цен на одну сущность | todo |
| U-08 | P1 | Кнопка «Войти на сайте» в агенте открывает существующий маршрут | `artifacts/host-agent/src/main/index.ts` | Открывается `/host`, не `/host/dashboard`; ручной тест: клик из агента приводит на дашборд | todo |
| U-09 | P1 | Возврат хоста по сохранённому токену — поле «у меня уже есть токен» | `artifacts/web/src/components/host-auth-guard.tsx`, `artifacts/web/src/hooks/use-auth.tsx` | На экране регистрации есть ввод существующего токена; после вставки — сразу дашборд | todo |
| U-10 | P1 | Библиотека и «быстрое добавление игры» — один компонент | `artifacts/web/src/pages/host/library.tsx`, `artifacts/web/src/pages/host/dashboard.tsx` | Форма добавления игры вынесена в общий компонент, используется в обоих местах; поведение идентично | todo |
| U-11 | P2 | Русский язык во всём UI агента | `artifacts/host-agent/src/renderer/index.html` | Нет английских подписей в интерфейсе агента; технические идентификаторы не переводятся | todo |
| U-12 | P2 | INSTALL.txt и подсказки дашборда описывают один и тот же поток | `artifacts/host-agent/INSTALL.txt`, `artifacts/web/src/pages/host/dashboard.tsx` | Инструкции совпадают с фактическим потоком после U-01/U-02; нет упоминаний устаревших шагов | todo |

---

## Волна U — путь игрока

| ID | Приор | Задача | Файлы | Критерий готовности | Status |
|----|-------|--------|-------|---------------------|--------|
| U-20 | P0 | «Играть» ведёт в одно и то же место на десктопе и мобиле | `artifacts/web/src/components/site-nav.tsx`, `artifacts/web/src/pages/landing.tsx` | Одна цель для всех точек входа; юнит-тест на nav-хелперы | todo |
| U-21 | P0 | Кнопка «Играть сейчас» подбирает хост сама — без выбора из списка | `artifacts/web/src/pages/landing.tsx`, `artifacts/web/src/pages/landing-helpers.ts`, `artifacts/web/src/pages/hosts.tsx` | Главный CTA ведёт прямо на `/play` лучшего онлайн-хоста; при отсутствии онлайн-хостов — понятная альтернатива | todo |
| U-22 | P1 | Лендинг не прячет блок, когда онлайн-хостов нет | `artifacts/web/src/pages/landing.tsx` | Вместо скрытой секции — состояние «сейчас никто не хостит» + переход в каталог/уведомить меня | todo |
| U-23 | P1 | Выбор игры у хоста — раскрывающийся список вместо модалки | `artifacts/web/src/pages/hosts.tsx` | `GamePickerDialog` заменён на инлайн-раскрытие в строке хоста; на мобиле не перекрывает экран | todo |
| U-24 | P1 | Один экран подготовки сессии вместо модалки и дубля на `/play` | `artifacts/web/src/pages/game-detail.tsx`, `artifacts/web/src/pages/play.tsx` | Баланс/пинг/блок-время показаны в одном месте; нет двух похожих UI с разной вёрсткой | todo |
| U-25 | P1 | Экранная клавиатура включена по умолчанию на тач-устройствах | `artifacts/web/src/pages/play.tsx` | При `maxTouchPoints > 0` клавиатура активна как и геймпад; можно выключить | todo |
| U-26 | P1 | Никаких технических терминов в сообщениях игроку | `artifacts/web/src/pages/play-helpers.ts`, `artifacts/web/src/pages/play.tsx`, `artifacts/web/src/lib/api-errors.ts` | Нет «WebRTC», «ICE», «токен игрока», сырых reason-кодов и англоязычных fallback-сообщений в пользовательском тексте | todo |
| U-27 | P2 | Баланс LZT виден на мобиле | `artifacts/web/src/components/site-nav.tsx` | Чип баланса отображается на малых экранах (компактно) | todo |
| U-28 | P2 | В каталоге у офлайн-игр честная подпись и путь дальше | `artifacts/web/src/pages/games.tsx` | Понятно, что игра сейчас недоступна, и что можно сделать (уведомить / посмотреть похожие) | todo |
| U-29 | P2 | Фильтры каталога доступны на мобиле | `artifacts/web/src/pages/games.tsx` | Жанры/цена/категории доступны через шит или сворачиваемый блок на малых экранах | todo |
| U-30 | P2 | Понятная первая минута: сколько стоит и что такое LZT | `artifacts/web/src/pages/game-detail.tsx`, `artifacts/web/src/pages/play.tsx`, `artifacts/web/src/pages/profile.tsx` | Перед запуском видно цену за минуту в понятных единицах; расхождение «кредит нельзя на claim» устранено или объяснено | todo |

---

## Правила для automation

1. **Одна U-NN за run.** Как и M-NN: код → `pnpm typecheck` → тесты → merge в `main`.
2. **UI на русском** (правило проекта). Технические идентификаторы — английские.
3. **Не ломать существующие тесты.** Если UX-правка меняет хелперы — обновить их юнит-тесты в том же коммите.
4. **Ручной тест важнее покрытия.** В `TESTLOG.md` писать, что именно стало проще: было N шагов → стало M.
5. **Статус здесь и в MARATHON.md синхронно** — `todo` → `done` в этом файле, `pending` → `done` в очереди.
6. **P0 не откладывать.** Пока есть открытый P0, задачи P1/P2 не берутся.
