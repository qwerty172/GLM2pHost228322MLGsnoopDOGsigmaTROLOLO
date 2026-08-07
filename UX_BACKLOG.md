# DecentralHub — UX Backlog (удобство и раннее тестирование)

> **Цель волны:** владелец проекта должен сам сесть и протестировать платформу **без чтения кода и документации**.
> **Главный критерий:** меньше окон, меньше копипаста, меньше «нужно знать заранее».
> **Метрики волны:** `stepsToStream`, `surfaceCount`, `manualInputCount`,
> `deadEndCount`, `updateSteps`. Для новой задачи acceptance должен фиксировать
> хотя бы одно измеримое «было → стало».
>
> **Как работает:** `scripts/marathon-scan.mjs` (категория **R**) читает строки со статусом `todo`
> и ставит их в очередь `M-NN` в [MARATHON.md](./MARATHON.md) **выше** технических задач.
> Automation берёт по одной за run. Закрыл → `todo` → `done` в этом файле.
>
> **Когда список кончится** — генерировать новые по промпту в [MARATHON.md § Генератор UX-задач](./MARATHON.md#генератор-ux-задач).
>
> **Часть блокеров требует настоящего Windows** (сборка `.exe`, файрвол, admin, реальный первый стрим) —
> см. [MVP_MANUAL_TEST.md](./MVP_MANUAL_TEST.md) для ручного прогона в обычном (не cloud) Cursor.

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
| U-04 | P0 | Выбор `.exe` через файловый диалог вместо ручного пути | `artifacts/web/src/pages/host/library.tsx`, `artifacts/host-agent/src/renderer/library.ts`, `artifacts/host-agent/src/main/index.ts` | В веб-библиотеке путь можно взять из агента (список найденных игр / Steam-скан), ручной ввод — резервный вариант | done |
| U-05 | P0 | Квик-старт показывает реальное состояние, а не «шаг 1 всегда выполнен» | `artifacts/web/src/pages/host/dashboard-helpers.ts`, `artifacts/web/src/pages/host/dashboard.tsx` | Шаг «Скачай агент» становится done только по факту (download-эвент или агент once-seen); юнит-тест на step-логику | done |
| U-31 | P0 | Кнопка «Скачать агент» отдаёт готовый `.exe`, а не ZIP с Node.js/npm install | `artifacts/api-server/src/routes/downloads.ts`, `artifacts/web/src/pages/host/dashboard.tsx`, `.github/workflows/agent-build.yml` | `/downloads/host-agent.exe` сам находит последний GitHub Release (тег `host-agent-v*`) без ручного `HOST_AGENT_EXE_URL`; на дашборде рядом с ZIP есть честная ссылка на `.exe` (без Node.js, но нужен код привязки — установщик не несёт per-host конфиг); `stepsToStream`/`updateSteps` минус установка Node.js и ожидание `npm install` | done |
| U-32 | P0 | Тест реально проверяет, что hostToken лежит внутри ZIP, а не просто есть файл config.json | `artifacts/api-server/src/routes/downloads.test.ts` | Тест распаковывает архив (`adm-zip`) и парсит `config.json` как JSON, проверяя поле `hostToken` при авторизованном запросе, его отсутствие при неавторизованном/неизвестном токене; регрессия U-02 ловится в CI | done |
| U-13 | P0 | Дашборд всегда показывает одно следующее действие до первого стрима | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/web/src/pages/host/dashboard-helpers.ts`, `artifacts/host-agent/src/renderer/index.html` | Новый хост видит одну главную кнопку для текущего шага: скачать агент → дождаться связи → добавить игру → выйти онлайн → проверить стрим; завершённые и будущие шаги не конкурируют за внимание | done |
| U-14 | P0 | «Проверить готовность» проверяет весь путь хоста одной кнопкой | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/web/src/pages/host/dashboard-helpers.ts`, `artifacts/api-server/src/routes/hosts.ts`, `artifacts/host-agent/src/main/ping-server.ts` | Одна кнопка проверяет API, привязку и heartbeat агента, наличие доступной игры, готовность сессии и локальный ввод; результат — «Можно тестировать» либо один конкретный следующий фикс по-русски | done |
| U-06 | P1 | Один способ привязки агента вместо трёх | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/src/renderer/auth.ts`, `artifacts/host-agent/src/renderer/agent-auth.ts`, `artifacts/host-agent/src/renderer/pairing.ts` | Основной путь один (после U-02 — авто); остальные убраны или спрятаны в «Проблемы с подключением»; тексты не противоречат друг другу | done |
| U-07 | P1 | Убрать дублирующий legacy BindingForm с ценами в USD | `artifacts/web/src/pages/host/binding-form.tsx`, `artifacts/web/src/pages/host/dashboard.tsx` | Настройка игр только через библиотеку (LZT/мин); расписание и RTMP перенесены или удалены; нет двух цен на одну сущность | done |
| U-08 | P1 | Кнопка «Войти на сайте» в агенте открывает существующий маршрут | `artifacts/host-agent/src/main/index.ts` | Открывается `/host`, не `/host/dashboard`; ручной тест: клик из агента приводит на дашборд | done |
| U-09 | P1 | Возврат хоста по сохранённому токену — поле «у меня уже есть токен» | `artifacts/web/src/components/host-auth-guard.tsx`, `artifacts/web/src/hooks/use-auth.tsx` | На экране регистрации есть ввод существующего токена; после вставки — сразу дашборд | done |
| U-10 | P1 | Библиотека и «быстрое добавление игры» — один компонент | `artifacts/web/src/pages/host/add-game-modal.tsx`, `artifacts/web/src/pages/host/library.tsx`, `artifacts/web/src/pages/host/dashboard.tsx` | Форма добавления игры вынесена в общий компонент, используется в обоих местах; поведение идентично | done |
| U-11 | P2 | Русский язык во всём UI агента | `artifacts/host-agent/src/renderer/index.html` | Нет английских подписей в интерфейсе агента; технические идентификаторы не переводятся | done |
| U-12 | P2 | INSTALL.txt и подсказки дашборда описывают один и тот же поток | `artifacts/host-agent/INSTALL.txt`, `artifacts/web/src/pages/host/dashboard.tsx` | Инструкции совпадают с фактическим потоком после U-01/U-02; нет упоминаний устаревших шагов | done |
| U-33 | P1 | Порты файрвола согласованы между документацией и кодом | `artifacts/host-agent/INSTALL.txt`, `artifacts/api-server/src/routes/downloads.ts` (embedded INSTALL_TXT), `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/src/main/ping-server.ts` | INSTALL.txt и встроенный в ZIP INSTALL_TXT упоминают тот же диапазон портов (18080–18083), что UI-чеклист и фактические fallback-порты `ping-server.ts`; расхождений нет | done |
| U-15 | P1 | Версия агента берётся из сборки, а не из захардкоженной строки | `artifacts/host-agent/src/main/index.ts`, `artifacts/host-agent/src/main/ping-server.ts`, `artifacts/web/src/pages/host/dashboard.tsx` | `/ping` и дашборд показывают фактическую версию приложения через `app.getVersion()`; версия совпадает с установленной сборкой | done |
| U-16 | P1 | Обновление агента видно и устанавливается одной кнопкой | `artifacts/host-agent/src/main/index.ts`, `artifacts/host-agent/src/preload/index.ts`, `artifacts/host-agent/src/renderer/index.html` | При скачанном обновлении агент показывает русскую ненавязчивую плашку «Обновление готово» и кнопку «Перезапустить и обновить»; повторно скачивать ZIP не нужно | done |
| U-17 | P1 | Несовместимая версия агента объясняется до запуска стрима | `artifacts/api-server/src/routes/hosts.ts`, `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/src/main/api-client.ts` | Web/API знают минимальную поддерживаемую версию; дашборд заранее блокирует запуск несовместимого агента и предлагает одно действие «Обновить агент» | done |
| U-18 | P1 | Единая карточка диагностики вместо разрозненных heartbeat и troubleshoot-блоков | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/web/src/pages/host/dashboard-helpers.ts` | Состояния API, агент, привязка, игра и сессия собраны в одну карточку; у каждой ошибки одно понятное действие; дублирующие symptom/troubleshoot-блоки удалены | done |
| U-19 | P1 | Диагностический отчёт копируется одной кнопкой без секретов | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/web/src/pages/host/dashboard-helpers.ts`, `artifacts/host-agent/src/main/ping-server.ts` | «Скопировать диагностику» даёт версии, статусы, время heartbeat и коды безопасных проверок; hostToken, playerToken, пароли, URL с секретами и персональные данные отсутствуют; есть тест редактирования секретов | done |

---

## Волна U — путь игрока

| ID | Приор | Задача | Файлы | Критерий готовности | Status |
|----|-------|--------|-------|---------------------|--------|
| U-20 | P0 | «Играть» ведёт в одно и то же место на десктопе и мобиле | `artifacts/web/src/components/site-nav.tsx`, `artifacts/web/src/pages/landing.tsx` | Одна цель для всех точек входа; юнит-тест на nav-хелперы | done |
| U-21 | P0 | Кнопка «Играть сейчас» подбирает хост сама — без выбора из списка | `artifacts/web/src/pages/landing.tsx`, `artifacts/web/src/pages/landing-helpers.ts`, `artifacts/web/src/pages/hosts.tsx` | Главный CTA ведёт прямо на `/play` лучшего онлайн-хоста; при отсутствии онлайн-хостов — понятная альтернатива | done |
| U-22 | P1 | Лендинг не прячет блок, когда онлайн-хостов нет | `artifacts/web/src/pages/landing.tsx` | Вместо скрытой секции — состояние «сейчас никто не хостит» + переход в каталог/уведомить меня | done |
| U-23 | P1 | Выбор игры у хоста — раскрывающийся список вместо модалки | `artifacts/web/src/pages/hosts.tsx` | `GamePickerDialog` заменён на инлайн-раскрытие в строке хоста; на мобиле не перекрывает экран | done |
| U-24 | P1 | Один экран подготовки сессии вместо модалки и дубля на `/play` | `artifacts/web/src/pages/game-detail.tsx`, `artifacts/web/src/pages/play.tsx` | Баланс/пинг/блок-время показаны в одном месте; нет двух похожих UI с разной вёрсткой | done |
| U-25 | P1 | Экранная клавиатура включена по умолчанию на тач-устройствах | `artifacts/web/src/pages/play.tsx` | При `maxTouchPoints > 0` клавиатура активна как и геймпад; можно выключить | done |
| U-26 | P1 | Никаких технических терминов в сообщениях игроку | `artifacts/web/src/pages/play-helpers.ts`, `artifacts/web/src/pages/play.tsx`, `artifacts/web/src/lib/api-errors.ts` | Нет «WebRTC», «ICE», «токен игрока», сырых reason-кодов и англоязычных fallback-сообщений в пользовательском тексте | done |
| U-27 | P2 | Баланс LZT виден на мобиле | `artifacts/web/src/components/site-nav.tsx` | Чип баланса отображается на малых экранах (компактно) | done |
| U-28 | P2 | В каталоге у офлайн-игр честная подпись и путь дальше | `artifacts/web/src/pages/games.tsx` | Понятно, что игра сейчас недоступна, и что можно сделать (уведомить / посмотреть похожие) | done |
| U-29 | P2 | Фильтры каталога доступны на мобиле | `artifacts/web/src/pages/games.tsx` | Жанры/цена/категории доступны через шит или сворачиваемый блок на малых экранах | done |
| U-30 | P2 | Понятная первая минута: сколько стоит и что такое LZT | `artifacts/web/src/pages/game-detail.tsx`, `artifacts/web/src/pages/play.tsx`, `artifacts/web/src/pages/profile.tsx` | Перед запуском видно цену за минуту в понятных единицах; расхождение «кредит нельзя на claim» устранено или объяснено | done |

---

## Волна U-2 — после закрытия U-01…U-33 (статус `planned`)

> **`planned` ≠ `todo`.** Сканер (категория R) берёт в очередь только `todo`.
> Эти строки описаны и готовы к работе, но не выполняются автоматически: почти все
> меняют пользовательский UI, а ночной прогон не может проверить результат глазами.
> Перед запуском волны: перевести нужные строки `planned` → `todo` и прогнать
> `node scripts/marathon-scan.mjs --sync-marathon`.
>
> Часть строк требует Windows (`.exe`, SmartScreen, файрвол) — см. [MVP_MANUAL_TEST.md](./MVP_MANUAL_TEST.md).

### Путь хоста

| ID | Приор | Задача | Файлы | Критерий готовности | Status |
|----|-------|--------|-------|---------------------|--------|
| U-34 | P0 | Привязка `.exe` одним кликом с дашборда, без ввода 6 цифр | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/src/main/index.ts`, `artifacts/host-agent/src/renderer/pairing.ts` | Кнопка «Открыть в агенте» передаёт код привязки в уже установленный агент; ручной ввод остаётся резервным путём; `manualInputCount` −2 | done |
| U-35 | P0 | Честная разница между ZIP и `.exe` на дашборде | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/web/src/pages/host/dashboard-helpers.ts` | У каждой кнопки подпись «токен уже внутри» / «понадобится код привязки»; после `.exe` шаг привязки показывается сам; `deadEndCount` −1 | done |
| U-36 | P0 | Нет опубликованного релиза — понятный экран, а не пустая кнопка | `artifacts/api-server/src/routes/downloads.ts`, `artifacts/web/src/pages/host/dashboard.tsx` | Пока тега `host-agent-v*` нет, кнопка `.exe` объясняет это по-русски и предлагает ZIP; тест на ответ без релиза | done |
| U-37 | P0 | Предупреждение о проверке Windows до скачивания `.exe` | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/INSTALL.txt` | Перед скачиванием один короткий блок про подтверждение запуска; после установки хост не считает это поломкой; `deadEndCount` −1 | done |
| U-38 | P1 | Права администратора — только для игр с анти-читом | `artifacts/host-agent/INSTALL.txt`, `artifacts/api-server/src/routes/downloads.ts`, `artifacts/web/src/pages/host/dashboard.tsx` | Текст про «запуск от администратора» показывается только там, где он нужен; для обычных игр шага нет; `stepsToStream` −1 | planned |
| U-39 | P1 | Файрвол упоминается только при реальной проблеме связи | `artifacts/host-agent/INSTALL.txt`, `artifacts/web/src/pages/host/dashboard-helpers.ts`, `artifacts/host-agent/src/main/ping-server.ts` | Пока агент отвечает, чеклист файрвола скрыт; появляется только при неудачном ping с конкретным портом; `stepsToStream` −1 | planned |
| U-40 | P1 | «Проверить самому» сразу открывает вкладку игрока | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/api-server/src/routes/sessions.ts` | После создания тест-сессии открывается плеер и ссылка уже в буфере; `stepsToStream` −2 | planned |
| U-41 | P1 | Один способ пригласить игрока вместо двух форм | `artifacts/web/src/pages/host/setup.tsx`, `artifacts/web/src/pages/host/dashboard.tsx` | Создание сессии и выдача ссылки — один экран; вторая форма удалена или ведёт на него; `surfaceCount` −1 | planned |
| U-42 | P1 | Стрим вкладки браузера виден в основном потоке хоста | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/web/src/pages/host/browser-play.tsx` | Вариант «без установки агента» предлагается на шаге выбора способа; не спрятан в отдельном URL | planned |
| U-43 | P1 | Выбор окна для захвата — превью вместо списка заголовков | `artifacts/host-agent/src/renderer/capture.ts`, `artifacts/host-agent/src/renderer/index.html` | В окне выбора показываются миниатюры источников; ошибочный выбор окна виден до старта; `deadEndCount` −1 | planned |
| U-59 | P1 | Путь к игре подставляется из агента, руками — только как запасной | `artifacts/web/src/pages/host/library.tsx`, `artifacts/host-agent/src/renderer/library.ts` | В библиотеке кнопка «Выбрать на этом ПК» отдаёт путь из агента; поле ручного ввода свёрнуто; `manualInputCount` −1 | planned |
| U-60 | P1 | Привязка по коду не требует открывать расширенные настройки | `artifacts/host-agent/src/renderer/pairing.ts`, `artifacts/host-agent/src/main/config.ts`, `artifacts/api-server/src/routes/downloads.ts` | Адрес платформы уже в конфиге, форма кода просит только код; сообщение «сначала укажи URL» недостижимо в обычном потоке | planned |
| U-63 | P1 | Квик-старт различает установку через ZIP и через `.exe` | `artifacts/web/src/pages/host/dashboard-helpers.ts`, `artifacts/web/src/pages/host/dashboard.tsx` | Шаг привязки показывается только тем, кто ставил `.exe`; юнит-тест на step-логику обоих путей | planned |
| U-44 | P2 | Игры из Steam добавляются прямо из веб-библиотеки | `artifacts/web/src/pages/host/library.tsx`, `artifacts/host-agent/src/renderer/steam.ts` | Найденные агентом игры Steam видны в вебе и добавляются одной кнопкой; `manualInputCount` −1 | planned |
| U-45 | P2 | После выхода в онлайн видно, что именно опубликовано | `artifacts/web/src/pages/host/dashboard.tsx`, `artifacts/host-agent/src/renderer/connect-events.ts` | Подтверждение содержит игру и цену за минуту, а не только «в сети» | planned |

### Путь игрока

| ID | Приор | Задача | Файлы | Критерий готовности | Status |
|----|-------|--------|-------|---------------------|--------|
| U-46 | P0 | Не хватает LZT — сумма и пополнение прямо перед запуском | `artifacts/web/src/components/pre-session-screen.tsx`, `artifacts/web/src/pages/play.tsx`, `artifacts/web/src/pages/wallet.tsx` | Показано, сколько нужно на 30 минут, и кнопка пополнения без ухода в пустой кошелёк; `deadEndCount` −1 | done |
| U-47 | P1 | Ссылка-приглашение открывается по QR с телефона | `artifacts/web/src/pages/host/setup.tsx`, `artifacts/web/src/pages/host/dashboard.tsx` | Рядом со ссылкой есть QR; игрок заходит без пересылки текста; `manualInputCount` −1 | planned |
| U-48 | P1 | Обрыв связи — кнопка «Переподключиться», без технических кодов | `artifacts/web/src/pages/play.tsx`, `artifacts/web/src/pages/play-helpers.ts` | При разрыве одна понятная кнопка и текст без состояний соединения; юнит-тест на текст по каждому состоянию | planned |
| U-49 | P1 | Пополнение криптой — адрес с QR, а не длинная строка | `artifacts/web/src/pages/wallet.tsx`, `artifacts/api-server/src/routes/wallet.ts` | Для депозита показан QR и кнопка копирования; ручной перенос адреса не нужен; `manualInputCount` −1 | planned |
| U-50 | P1 | Раздел обмена объяснён обычными словами | `artifacts/web/src/pages/exchange.tsx` | Заявка и выдача описаны без терминов займа; понятно, что произойдёт с балансом | planned |
| U-53 | P1 | Встроенный виджет сообщает об ошибках по-русски | `artifacts/web/src/pages/embed.tsx`, `artifacts/web/src/pages/embed-helpers.ts` | В iframe нет английских fallback-сообщений; каждое состояние объясняет, что делать | planned |
| U-54 | P1 | Конец сессии объясняет причину и предлагает шаг дальше | `artifacts/web/src/pages/play.tsx`, `artifacts/web/src/pages/play-helpers.ts` | «Хост отключился» / «закончился баланс» + переход в каталог или повтор; `deadEndCount` −1 | planned |
| U-55 | P1 | Нехватка баланса видна до старта, а не в момент списания | `artifacts/web/src/components/pre-session-screen.tsx`, `artifacts/web/src/pages/game-detail.tsx` | При балансе меньше нескольких минут запуск блокируется заранее с понятным действием | planned |
| U-56 | P1 | Каталог доступен без пополнения кошелька | `artifacts/web/src/hooks/use-auth.tsx`, `artifacts/web/src/pages/landing.tsx`, `artifacts/web/src/pages/profile.tsx` | Новый игрок доходит до каталога и карточки игры без депозита; оплата запрашивается только перед сессией; `stepsToStream` −1 | planned |
| U-61 | P1 | На лендинге видно реальное число хостов и игр онлайн | `artifacts/web/src/pages/landing.tsx`, `artifacts/api-server/src/routes/public.ts` | Показаны живые счётчики; при нуле — честный текст и переход в каталог | planned |
| U-51 | P2 | История кошелька листается на мобиле | `artifacts/web/src/components/wallet-history.tsx`, `artifacts/web/src/pages/profile.tsx` | Есть «загрузить ещё»; на малых экранах видно больше одной страницы | planned |
| U-52 | P2 | Переключатель кредита объясняет последствия | `artifacts/web/src/pages/profile.tsx` | Рядом с настройкой сказано, что изменится при оплате сессии | planned |
| U-57 | P2 | В создании квоты виден прогресс по шагам | `artifacts/web/src/pages/quota-new.tsx` | Показано «шаг N из M»; понятно, сколько осталось | planned |
| U-58 | P2 | У офлайн-игры можно попросить уведомление | `artifacts/web/src/pages/games.tsx`, `artifacts/web/src/pages/game-detail.tsx` | Вместо тупика — действие «сообщить, когда появится хост» | planned |
| U-62 | P2 | Первое знакомство с LZT без чтения документации | `artifacts/web/src/components/site-nav.tsx`, `artifacts/web/src/pages/landing.tsx` | Однократная подсказка объясняет валюту рядом с балансом | planned |

---

## Правила для automation

1. **Одна U-NN за run.** Как и M-NN: код → `pnpm typecheck` → тесты → merge в `main`.
2. **UI на русском** (правило проекта). Технические идентификаторы — английские.
3. **Не ломать существующие тесты.** Если UX-правка меняет хелперы — обновить их юнит-тесты в том же коммите.
4. **Ручной тест важнее покрытия.** В `TESTLOG.md` писать, что именно стало проще: было N шагов → стало M.
5. **Статус здесь и в MARATHON.md синхронно** — `todo` → `done` в этом файле, `pending` → `done` в очереди.
6. **P0 не откладывать.** Пока есть открытый P0, задачи P1/P2 не берутся.
7. **Не дублировать готовую механику.** Перед задачей проверить код: если updater/heartbeat/ping/test-session уже есть,
   задача должна довести его до понятного пользовательского результата, а не создать второй механизм.
8. **Каждый UX-run измерим.** В `TESTLOG.md` записать хотя бы одну дельту:
   `stepsToStream`, `surfaceCount`, `manualInputCount`, `deadEndCount` или `updateSteps`.
9. **Категория Q (auth-verifier unit-тесты) заморожена до исчерпания UX_BACKLOG.** См. `MARATHON.md` —
   покрытие тестами не двигает к MVP «быстро зашёл и юзаешь», приоритет ниже любой строки этого файла.
