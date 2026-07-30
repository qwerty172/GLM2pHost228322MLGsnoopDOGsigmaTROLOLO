import type { AgentState, HeartbeatState } from "./agent-troubleshoot-types";

export type { AgentState, HeartbeatState } from "./agent-troubleshoot-types";

export type TroubleshootScenario =
  | "fresh_install"
  | "agent_died"
  | "remote_online"
  | "local_online"
  | "port_conflict";

export type TroubleshootItem = {
  symptom: string;
  fix: string;
};

export type TroubleshootGuide = {
  scenario: TroubleshootScenario;
  title: string;
  summary: string;
  steps: string[];
  items: TroubleshootItem[];
};

const BASE_STEPS = [
  "Скачай ZIP и распакуй в папку без кириллицы (например C:\\CloudAgent)",
  "Запусти start.bat — при первом запуске установятся зависимости (~2 мин)",
  "Вставь токен хоста в окне агента и дождись «Вход выполнен»",
  "Разреши доступ в брандмауэре Windows, если спросит",
];

const COMMON_ITEMS: TroubleshootItem[] = [
  {
    symptom: "Агент не отвечает на localhost",
    fix: "Перезапусти start.bat; проверь, что порты 18080–18083 не заняты другим процессом",
  },
  {
    symptom: "В логе EADDRINUSE",
    fix: "Закрой лишние копии агента в трее — он сам перейдёт на 18081–18083",
  },
  {
    symptom: "Ввод игрока не доходит (native-игра)",
    fix: "Alt+Tab в окно игры — focus guard пропускает ввод только в foreground",
  },
  {
    symptom: "«Окно игры не найдено»",
    fix: "В агенте выбери окно вручную («Цель захвата») или проверь заголовок окна",
  },
  {
    symptom: "Видео нет, но ICE подключён",
    fix: "Не минимизируй игру; перевыбери окно захвата в настройках агента",
  },
  {
    symptom: "ViGEm / геймпад не работает",
    fix: "Установи ViGEmBus и положи ViGEmClient.dll рядом с агентом",
  },
];

export function getAgentTroubleshootScenario(
  agent: AgentState,
  heartbeat: HeartbeatState,
): TroubleshootScenario {
  if (agent.status === "online") return "local_online";
  if (heartbeat.status === "fresh") return "remote_online";
  if (heartbeat.status === "stale") return "agent_died";
  return "fresh_install";
}

export function getAgentTroubleshootGuide(
  agent: AgentState,
  heartbeat: HeartbeatState,
): TroubleshootGuide {
  const scenario = getAgentTroubleshootScenario(agent, heartbeat);

  switch (scenario) {
    case "local_online":
      return {
        scenario,
        title: "Агент на этом ПК",
        summary: "Локальный ping успешен. Если игроки не подключаются — проверь сессию и «Выйти в онлайн».",
        steps: [
          "В агенте выбери игру и нажми «Выйти в онлайн»",
          "Убедись, что в библиотеке есть хотя бы один шаблон с ценой",
          "Проверь карточку «События агента» ниже — там видны ошибки захвата или запуска",
        ],
        items: COMMON_ITEMS.slice(2),
      };
    case "remote_online":
      return {
        scenario,
        title: "Агент на другом ПК",
        summary:
          "Сервер видит heartbeat, но браузер не достучался до localhost — агент запущен на другой машине.",
        steps: [
          "Открой этот дашборд на том же ПК, где крутится агент, или используй удалённый рабочий стол",
          "На ПК с агентом проверь иконку в трее и статус «Вход выполнен»",
          "Скопируй токен хоста на тот ПК, если привязка ещё не сделана",
        ],
        items: [
          {
            symptom: "Дашборд на ноутбуке, агент на игровом ПК",
            fix: "Это нормально — локальный ping здесь будет offline, heartbeat остаётся зелёным",
          },
          ...COMMON_ITEMS.slice(0, 2),
        ],
      };
    case "agent_died":
      return {
        scenario,
        title: "Агент пропал с связи",
        summary:
          "Раньше heartbeat был свежим, сейчас агент не отвечает — возможно, процесс завершился или сеть пропала.",
        steps: [
          "На ПК с агентом открой трей и перезапусти start.bat",
          "Посмотри «События агента» — последняя ошибка часто объясняет причину",
          "Проверь, не ушёл ли ПК в сон и не оборвался ли интернет",
        ],
        items: COMMON_ITEMS,
      };
    case "port_conflict":
      return {
        scenario,
        title: "Конфликт порта",
        summary: "Агент мог не поднять HTTP-сервер на 18080 — смотри события и перезапусти.",
        steps: BASE_STEPS,
        items: COMMON_ITEMS,
      };
    default:
      return {
        scenario: "fresh_install",
        title: "Первый запуск агента",
        summary: "Агент ещё не подключался к серверу — установи и привяжи токен.",
        steps: BASE_STEPS,
        items: COMMON_ITEMS,
      };
  }
}
