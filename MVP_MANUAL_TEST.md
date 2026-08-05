# MVP Manual Test — Windows, обычный Cursor (не Cloud Agent)

> **Зачем этот файл:** часть работы над MVP («скачал → запустил → стримит») требует настоящего
> Windows-ПК — сборку `.exe`, файрвол, права администратора, реальный первый стрим. Cloud-агент
> в Linux-песочнице этого не проверит. Открой этот файл в обычном (не cloud) Cursor **на своём
> Windows-компьютере** и вставь промпт ниже в чат.
>
> Контекст: [MARATHON.md](./MARATHON.md), [UX_BACKLOG.md](./UX_BACKLOG.md), [TESTLOG.md](./TESTLOG.md).

---

## Промпт для вставки в обычный Cursor-чат

```
Работаю в монорепо DecentralHub. Нужно провести ручной MVP-тест на этом Windows-ПК и
сразу исправить то, что найдётся сломанным — по возможности маленькими коммитами в main.

Контекст: cloud-агент (в Linux-песочнице) реализовал U-31 — /downloads/host-agent.exe
теперь сам находит последний GitHub Release (тег host-agent-v*) вместо 503, если задан
HOST_AGENT_EXE_URL. НО ни одного тега host-agent-v* ещё не было — релиза физически не
существует. Первым шагом его нужно создать.

СДЕЛАЙ ПО ПОРЯДКУ:

1. git pull origin main. Прочитай artifacts/api-server/src/routes/downloads.ts
   (функция resolveHostAgentExeUrl) и artifacts/host-agent/electron-builder.yml,
   чтобы понимать текущую механику.

2. Собери инсталлятор локально и проверь, что он вообще собирается на этой машине:
     pnpm install
     pnpm --filter @workspace/host-agent run package:win
   Результат — .exe в artifacts/host-agent/release/. Если сборка падает — почини
   (обычно нехватка нативных тулчейнов для koffi/native-модулей на этой машине).

3. Опубликуй первый релиз через тег (это то, что должен был бы сделать CI):
     git tag host-agent-v0.1.0
     git push origin host-agent-v0.1.0
   Это запустит .github/workflows/agent-build.yml на GitHub-раннере (не на этой машине)
   и опубликует .exe в GitHub Releases. Подожди зелёный workflow run (gh run watch).

4. На проде/деве открой /api/downloads/host-agent.exe в браузере — должен быть редирект
   на реальный .exe с GitHub Releases, а не 503. Если 503 — читай сообщение об ошибке,
   оно теперь по-русски и объясняет что не так.

5. Установи .exe на этом ПК (обычный юзер, не портированный ZIP). Проверь:
   - Windows Defender/SmartScreen не блокирует запуск насмерть (если блокирует —
     это ожидаемо для несигнированного инсталлятора; отметь это в UX_BACKLOG как
     будущую задачу на code-signing, НЕ пытайся сейчас доставать сертификат).
   - После установки агент открывается. Так как .exe — статический артефакт без
     personal-конфига, попроси код привязки на дашборде хоста (AgentBindCodeCard)
     и вставь его в агент. Замерь: сколько кликов и полей заняла привязка?
   - Сравни с ZIP-путём (тот же дашборд, кнопка «Скачать агент», обычная): там
     токен уже вшит и привязки просить не должно. Если тоже просит — это регрессия
     U-02, чини artifacts/api-server/src/routes/downloads.ts (resolveBundledHostToken).

6. Проверь файрвол по-честному:
   - Приложение слушает 127.0.0.1:18080 (и фолбэки 18081-18083, см. ping-server.ts).
     Это loopback — Windows Firewall по умолчанию НЕ блокирует чистый loopback-трафик
     между процессами на одной машине. Проверь это на деле: включи стандартный
     Windows Firewall (Public+Private профили), НЕ добавляй никаких правил заранее,
     и посмотри — дашборд в браузере видит агента (heartbeat/ping) или нет?
   - Если всё работает без ручных правил файрвола — INSTALL.txt и UI-чеклист сейчас
     ЛИШНЕ пугают пользователя файрволом; упрости текст (задача U-33 в UX_BACKLOG.md,
     переформулируй с реальным результатом).
   - Если НЕ работает — выясни, что реально блокируется (исходящие к платформе?
     WebRTC UDP?), и обнови U-33 точным описанием, а не предположением.

7. Проверь права администратора для игр с анти-читом:
   - electron-builder.yml сейчас: requestedExecutionLevel: asInvoker (без auto-UAC).
   - Запусти агент ОБЫЧНЫМ пользователем (не «от имени администратора»), выбери
     любую игру без анти-чита, попробуй управлять мышью/клавиатурой через
     тестовую сессию («Проверить самому» на дашборде хоста). Работает ли ввод?
   - Если ввод работает без админ-прав — текущий INSTALL.txt пункт про
     "ОБЯЗАТЕЛЬНО от имени администратора" избыточен для большинства игр;
     уточни формулировку (только анти-чит-игры, не всегда).
   - Если ввод НЕ работает без админ-прав вообще (для любых игр) — это баг,
     разбирайся в artifacts/host-agent/src/main/input.ts / gamepad-injection.ts.

8. Сквозной тест (главная метрика MVP — stepsToStream):
   - Как владелец, пройди путь целиком с чистого браузерного профиля:
     регистрация хоста → скачивание (выбери .exe ИЛИ zip) → привязка →
     добавление игры → «Выйти в онлайн» → «Проверить самому».
   - Посчитай реальные шаги/окна/ручные вводы. Запиши в TESTLOG.md одной записью:
     "Manual MVP test (Windows, <дата>): N шагов, M окон, K ручных вводов,
     что сломано / что уже ок".

9. Если что-то из UX_BACKLOG.md (особенно U-13, U-14 — guided-flow и
   "Проверить готовность", ещё не реализованы cloud-агентом на момент этого теста)
   мешает — можешь реализовать здесь сам, это обычный код без Windows-специфики.
   Но шаги 2-8 выше — единственная причина использовать этот файл вместо
   cloud-агента, не трогай их логику зря.

10. Закоммить находки: обновления в UX_BACKLOG.md (новые задачи или уточнения
    P0/P1/P2 по реальным фактам, не предположениям), запись в TESTLOG.md,
    и любые точечные фиксы кода. Пуш в main (или как договорено в MARATHON.md —
    прямой push, без лишних PR на файлы марафона).

Не переписывай MARATHON_AUTOMATION_PROMPT.txt/scripts/marathon-*.mjs, если не нашёл
там реальный баг — это инфраструктура cron, а не то, что тестируется сейчас.
```

---

## Если что-то сломалось — где чинить

| Симптом | Файл |
|---|---|
| `.exe` не собирается локально | `artifacts/host-agent/electron-builder.yml`, `artifacts/host-agent/package.json` (`package:win`) |
| `agent-build.yml` не публикует релиз | `.github/workflows/agent-build.yml` (тег должен быть `host-agent-v*`) |
| `/downloads/host-agent.exe` не находит релиз | `artifacts/api-server/src/routes/downloads.ts` (`resolveHostAgentExeUrl`, `RELEASE_REPO`) |
| Нужен всегда admin (SendInput не работает) | `artifacts/host-agent/electron-builder.yml` (`requestedExecutionLevel`), `artifacts/host-agent/src/main/input.ts` |
| Файрвол реально блокирует | `artifacts/host-agent/src/main/ping-server.ts` (порты), `artifacts/host-agent/INSTALL.txt`, встроенный `INSTALL_TXT` в `downloads.ts` |
| Токен не долетает в ZIP | `artifacts/api-server/src/routes/downloads.ts` (`resolveBundledHostToken`), тесты в `downloads.test.ts` (U-32) |
| Привязка через .exe слишком долгая | `artifacts/web/src/pages/host/dashboard.tsx` (`AgentBindCodeCard`), `artifacts/host-agent/src/renderer/pairing.ts` |

## После теста

Обнови [UX_BACKLOG.md](./UX_BACKLOG.md) реальными находками (не тем, что предполагалось),
отметь это тестом в [TESTLOG.md](./TESTLOG.md) — следующие cron-запуски automation продолжат
с того места, что здесь окажется зафиксировано.
