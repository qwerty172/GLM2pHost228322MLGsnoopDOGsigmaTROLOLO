import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);
const trayModulePath = path.resolve("dist/main/main/tray.js");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-tray-"));
fs.mkdirSync(path.join(tmpRoot, "assets"), { recursive: true });
fs.writeFileSync(path.join(tmpRoot, "assets", "icon.png"), "icon", "utf8");

/** @type {Array<{ image: unknown; toolTip: string; contextMenu: unknown; handlers: Record<string, () => void> }>} */
const trayInstances = [];
/** @type {Array<unknown[]>} */
const menuTemplates = [];
/** @type {Array<{ title: string; body: string; shown: boolean }>} */
const notifications = [];

let notificationSupported = true;
let iconEmpty = false;
let appQuitCalled = false;
/** @type {Array<{ show: () => void }>} */
let browserWindows = [];

class MockTray {
  constructor(image) {
    this.image = image;
    this.toolTip = "";
    this.contextMenu = null;
    this.handlers = {};
    trayInstances.push(this);
  }

  setToolTip(tip) {
    this.toolTip = tip;
  }

  setContextMenu(menu) {
    this.contextMenu = menu;
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }
}

function MockNotification(opts) {
  const entry = { title: opts.title, body: opts.body, shown: false };
  notifications.push(entry);
  return {
    show: () => {
      entry.shown = true;
    },
  };
}
MockNotification.isSupported = () => notificationSupported;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      Tray: MockTray,
      Menu: {
        buildFromTemplate: (template) => {
          menuTemplates.push(template);
          return { template };
        },
      },
      nativeImage: {
        createFromPath: () => ({
          isEmpty: () => iconEmpty,
          resize: () => ({
            isEmpty: () => iconEmpty,
          }),
        }),
        createEmpty: () => ({ empty: true }),
      },
      app: {
        getAppPath: () => tmpRoot,
        quit: () => {
          appQuitCalled = true;
        },
      },
      BrowserWindow: {
        getAllWindows: () => browserWindows,
      },
      Notification: MockNotification,
    };
  }
  return load.apply(this, arguments);
};

async function importTray() {
  delete require.cache[trayModulePath];
  const url = new URL("../dist/main/main/tray.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetState() {
  trayInstances.length = 0;
  menuTemplates.length = 0;
  notifications.length = 0;
  notificationSupported = true;
  iconEmpty = false;
  appQuitCalled = false;
  browserWindows = [];
}

function latestMenuTemplate() {
  return menuTemplates[menuTemplates.length - 1];
}

test("createTray sets tooltip, menu and forwards click to openSettings", { concurrency: false }, async () => {
  resetState();
  const { createTray } = await importTray();
  let settingsOpened = false;
  const tray = createTray(() => {
    settingsOpened = true;
  });

  assert.equal(trayInstances.length, 1);
  assert.equal(tray, trayInstances[0]);
  assert.equal(tray.toolTip, "Агент DecentralHub");
  assert.ok(tray.contextMenu);
  assert.equal(typeof tray.handlers.click, "function");

  tray.handlers.click();
  assert.equal(settingsOpened, true);

  const menu = latestMenuTemplate();
  assert.equal(menu[0].label, "Статус: Ожидание игрока");
  assert.equal(menu[1].label, "Ожидание игрока");
  assert.equal(menu[3].label, "Открыть настройки");
  assert.equal(menu[5].label, "Выход");
});

test("createTray uses empty icon when nativeImage is empty", { concurrency: false }, async () => {
  resetState();
  iconEmpty = true;
  const { createTray } = await importTray();
  createTray(() => {});
  assert.deepEqual(trayInstances[0].image, { empty: true });
});

test("setStatus updates tooltip and menu labels for each AgentStatus", { concurrency: false }, async () => {
  resetState();
  const { createTray, setStatus } = await importTray();
  createTray(() => {});

  const cases = [
    ["idle", undefined, "Ожидание игрока"],
    ["connecting", undefined, "Подключение…"],
    ["streaming", undefined, "Стрим идёт"],
    ["error", "Сеть недоступна", "Сеть недоступна"],
  ];

  for (const [status, message, expectedMessage] of cases) {
    setStatus(status, message);
    assert.equal(
      trayInstances[0].toolTip,
      `Агент DecentralHub — ${expectedMessage}`,
    );
    const menu = latestMenuTemplate();
    assert.equal(menu[1].label, expectedMessage);
  }
});

test("setStatus shows desktop notification on error when supported", { concurrency: false }, async () => {
  resetState();
  notificationSupported = true;
  const { createTray, setStatus } = await importTray();
  createTray(() => {});

  setStatus("error", "Не удалось подключиться");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, "Ошибка агента");
  assert.equal(notifications[0].body, "Не удалось подключиться");
  assert.equal(notifications[0].shown, true);
});

test("setStatus uses default error body and skips notification when unsupported", { concurrency: false }, async () => {
  resetState();
  notificationSupported = false;
  const { createTray, setStatus } = await importTray();
  createTray(() => {});

  setStatus("error");
  assert.equal(notifications.length, 0);
  assert.equal(trayInstances[0].toolTip, "Агент DecentralHub — Ошибка");
});

test("setStatus no-ops when tray was not created", { concurrency: false }, async () => {
  resetState();
  const { setStatus } = await importTray();
  assert.doesNotThrow(() => setStatus("streaming", "Идёт трансляция"));
  assert.equal(trayInstances.length, 0);
  assert.equal(menuTemplates.length, 0);
});

test("menu quit item calls app.quit and status click shows first window", { concurrency: false }, async () => {
  resetState();
  let shown = false;
  browserWindows = [{ show: () => { shown = true; } }];
  const { createTray, setStatus } = await importTray();
  createTray(() => {});

  setStatus("streaming");
  const menu = latestMenuTemplate();
  menu[5].click();
  assert.equal(appQuitCalled, true);

  menu[3].click();
  assert.equal(shown, true);
});
