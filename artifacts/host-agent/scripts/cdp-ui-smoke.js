const http = require("http");
const WebSocket = require("ws");

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const targets = await getJson("http://127.0.0.1:9333/json");
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => {
        if (pending.has(i)) {
          pending.delete(i);
          reject(new Error("timeout " + method));
        }
      }, 15000);
    });
  }

  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  await send("Runtime.enable");

  async function evalExpr(expression) {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: false,
    });
    if (r.exceptionDetails) {
      throw new Error(JSON.stringify(r.exceptionDetails));
    }
    return r.result.value;
  }

  const state = await evalExpr(`(() => {
    const steam = document.getElementById('steam-modal');
    const progress = document.getElementById('steam-scan-progress');
    const connect = document.getElementById('connect');
    const session = document.getElementById('session-actions-card');
    const picker = document.getElementById('window-picker-modal');
    const settings = document.querySelector('section.card h2') &&
      Array.from(document.querySelectorAll('section.card')).find(s => s.querySelector('#settings-form'));
    const cs = (el) => (el ? getComputedStyle(el).display : null);
    return {
      steamHiddenAttr: steam ? steam.hidden : null,
      steamDisplay: cs(steam),
      progressHiddenAttr: progress ? progress.hidden : null,
      progressDisplay: cs(progress),
      pickerHiddenAttr: picker ? picker.hidden : null,
      pickerDisplay: cs(picker),
      connectExists: !!connect,
      connectText: connect ? connect.textContent.trim() : null,
      connectDisabled: connect ? connect.disabled : null,
      sessionHidden: session ? session.hidden : null,
      sessionDisplay: cs(session),
      settingsHidden: settings ? settings.hidden : null,
      bodyHasScanningOverlay: !!(steam && !steam.hidden && document.body.innerText.includes('Scanning Steam')),
    };
  })()`);
  console.log("INITIAL_STATE", JSON.stringify(state, null, 2));

  const connectClick = await evalExpr(`(() => {
    const b = document.getElementById('connect');
    if (!b) return 'no-btn';
    b.click();
    return 'clicked';
  })()`);
  console.log("CONNECT_CLICK", connectClick);

  const modalClose = await evalExpr(`(() => {
    const m = document.getElementById('steam-modal');
    const p = document.getElementById('steam-scan-progress');
    const close = document.getElementById('steam-modal-close');
    m.hidden = false;
    p.hidden = false;
    const openDisplay = getComputedStyle(m).display;
    close.click();
    return {
      openDisplay,
      afterHidden: m.hidden,
      afterDisplay: getComputedStyle(m).display,
      closeWorks: m.hidden === true && getComputedStyle(m).display === 'none',
    };
  })()`);
  console.log("MODAL_CLOSE", JSON.stringify(modalClose));

  const escapeTest = await evalExpr(`(() => {
    const m = document.getElementById('steam-modal');
    m.hidden = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return {
      afterHidden: m.hidden,
      display: getComputedStyle(m).display,
      escapeWorks: m.hidden === true && getComputedStyle(m).display === 'none',
    };
  })()`);
  console.log("ESCAPE", JSON.stringify(escapeTest));

  const openLog = await evalExpr(`(() => {
    const b = document.getElementById('open-log-file');
    return { exists: !!b, text: b ? b.textContent.trim() : null };
  })()`);
  console.log("OPEN_LOG_BTN", JSON.stringify(openLog));

  // Ping local agent
  ws.close();
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
