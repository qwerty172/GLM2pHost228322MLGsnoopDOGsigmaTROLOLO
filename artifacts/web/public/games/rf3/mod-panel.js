(function () {
  'use strict';

  var STORAGE_KEY = 'rf3_mod_landscape';
  var TOGGLES_KEY  = 'rf3_mod_toggles';

  var PARAMS = [
    {
      section: 'Plants & Fungi',
      items: [
        { label: 'Fire mushrooms', varName: 'MAX_FIRE_MUSHROOMS', min: 0, max: 20, step: 1, def: 4 },
        { label: 'Vines — spawn chance', varName: 'SPAWN_VINE_PERCENT', min: 0, max: 1, step: 0.01, def: 0.50 },
        { label: 'Vines — max', varName: 'MAX_VINES', min: 0, max: 20, step: 1, def: 4 },
      ]
    },
    {
      section: 'Streamers',
      items: [
        { label: 'Streamers — chance', varName: 'SPAWN_STREAMER_PERCENT', min: 0, max: 1, step: 0.01, def: 0.05 },
        { label: 'Streamers — min length', varName: 'MIN_STREAMER_LENGTH', min: 4, max: 60, step: 1, def: 24 },
      ]
    },
    {
      section: 'Liquids',
      items: [
        { label: 'Water — chance', varName: 'SPAWN_WATER_PERCENT', min: 0, max: 1, step: 0.01, def: 0.50 },
        { label: 'Water — max', varName: 'MAX_WATER', min: 0, max: 20, step: 1, def: 4 },
        { label: 'Lava — max', varName: 'MAX_LAVA', min: 0, max: 20, step: 1, def: 6 },
        { label: 'Ice — max', varName: 'MAX_ICE', min: 0, max: 20, step: 1, def: 4 },
      ]
    },
    {
      section: 'Traps',
      items: [
        { label: 'Teleport — chance', varName: 'SPAWN_TELEPORT_TRAP_PERCENT', min: 0, max: 1, step: 0.01, def: 0.20 },
        { label: 'Teleport — max', varName: 'MAX_TELEPORT_TRAPS', min: 0, max: 10, step: 1, def: 2 },
        { label: 'Pit — chance', varName: 'SPAWN_PIT_TRAP_PERCENT', min: 0, max: 1, step: 0.01, def: 0.10 },
        { label: 'Pit — max', varName: 'MAX_PIT_TRAPS', min: 0, max: 10, step: 1, def: 2 },
        { label: 'Bear trap — chance', varName: 'SPAWN_BEAR_TRAPS_PERCENT', min: 0, max: 1, step: 0.01, def: 0.25 },
        { label: 'Bear trap — max', varName: 'MAX_BEAR_TRAPS', min: 0, max: 30, step: 1, def: 10 },
        { label: 'Spike trap — chance', varName: 'SPAWN_SPIKE_TRAPS_PERCENT', min: 0, max: 1, step: 0.01, def: 0.25 },
        { label: 'Spike trap — max', varName: 'MAX_SPIKE_TRAPS', min: 0, max: 30, step: 1, def: 10 },
      ]
    },
    {
      section: 'Fire Hazards',
      items: [
        { label: 'Fire vents — chance', varName: 'SPAWN_FIRE_VENTS_PERCENT', min: 0, max: 1, step: 0.01, def: 0.25 },
        { label: 'Fire vents — max', varName: 'MAX_FIRE_VENTS', min: 0, max: 30, step: 1, def: 10 },
        { label: 'Fire pots — chance', varName: 'SPAWN_FIRE_POTS_PERCENT', min: 0, max: 1, step: 0.01, def: 0.25 },
        { label: 'Fire pots — max', varName: 'MAX_FIRE_POTS', min: 0, max: 30, step: 1, def: 10 },
      ]
    },
    {
      section: 'Gas Hazards',
      items: [
        { label: 'Gas pots — chance', varName: 'SPAWN_GAS_POTS_PERCENT', min: 0, max: 1, step: 0.01, def: 0.25 },
        { label: 'Gas pots — max', varName: 'MAX_GAS_POTS', min: 0, max: 30, step: 1, def: 10 },
        { label: 'Gas vents — chance', varName: 'SPAWN_GAS_VENTS_PERCENT', min: 0, max: 1, step: 0.01, def: 0.50 },
        { label: 'Gas vents — max', varName: 'MAX_GAS_VENTS', min: 0, max: 20, step: 1, def: 5 },
      ]
    },
    {
      section: 'Misc',
      items: [
        { label: 'Camp fires', varName: 'NUM_CAMP_FIRES', min: 0, max: 10, step: 1, def: 2 },
      ]
    }
  ];

  var TOGGLES = [
    { key: 'CRIT_UPDATE_ENABLED',     label: 'CRIT UPDATE',      def: true },
    { key: 'WEAPON_REBALANCE_ENABLED', label: 'WEAPON REBALANCE', def: true },
    { key: 'STAT_REBALANCE_ENABLED',   label: 'STAT REBALANCE',   def: true },
    { key: 'STARTING_GEAR_ENABLED',    label: 'STARTING GEAR',    def: true },
  ];

  var RESIST_COLORS = { Fire:'#ff7744', Cold:'#44aaff', Shock:'#ffee44', Toxic:'#88ff44' };

  // ─── Pre-game modal ───────────────────────────────────────────────────────────

  function showPreGameModal(className, onConfirm) {
    var info = (window.GB && window.GB.classes) ? window.GB.classes[className] : null;
    if (!info) { onConfirm(); return; }

    var gearList = (window.STARTING_GEAR_ENABLED && info.modGearDisplay) ? info.modGearDisplay : info.defaultGearDisplay;
    var gearNote = (window.STARTING_GEAR_ENABLED && info.modGearDisplay) ? '(mod)' : '';

    var overlay = document.createElement('div');
    overlay.id = 'pregame-overlay';

    var panel = document.createElement('div');
    panel.id = 'pregame-panel';

    // ── Header ──────────────────────────────────────────────────────────────
    var header = document.createElement('div');
    header.id = 'pregame-header';

    var title = document.createElement('div');
    title.id = 'pregame-title';
    title.textContent = info.name;

    var role = document.createElement('div');
    role.id = 'pregame-role';
    role.textContent = info.role;

    header.appendChild(title);
    header.appendChild(role);
    panel.appendChild(header);

    // ── Description ─────────────────────────────────────────────────────────
    var desc = document.createElement('div');
    desc.id = 'pregame-desc';
    desc.textContent = info.desc;
    panel.appendChild(desc);

    // ── Stats + Gear (two columns) ───────────────────────────────────────────
    var cols = document.createElement('div');
    cols.id = 'pregame-cols';

    // Left: stats
    var statsCol = document.createElement('div');
    statsCol.className = 'pregame-col';

    var statsTitle = document.createElement('div');
    statsTitle.className = 'pregame-col-title';
    statsTitle.textContent = 'STATS';
    statsCol.appendChild(statsTitle);

    function statRow(label, value, color) {
      var row = document.createElement('div');
      row.className = 'pregame-stat-row';
      var lbl = document.createElement('span');
      lbl.className = 'pregame-stat-label';
      lbl.textContent = label;
      var val = document.createElement('span');
      val.className = 'pregame-stat-val';
      val.textContent = value;
      if (color) val.style.color = color;
      row.appendChild(lbl);
      row.appendChild(val);
      statsCol.appendChild(row);
    }

    var statSR = window.STAT_REBALANCE_ENABLED;
    statRow('HP', (statSR ? info.hp : '?'), '#ff8888');
    if (info.prot > 0 && statSR) statRow('PROTECTION', '+' + info.prot, '#88ffcc');
    statRow('MP', info.mpDisplay, '#8888ff');

    // Resistances
    var resKeys = Object.keys(info.res || {});
    if (resKeys.length > 0 && statSR) {
      var resistTitle = document.createElement('div');
      resistTitle.className = 'pregame-col-title';
      resistTitle.style.marginTop = '10px';
      resistTitle.textContent = 'RESISTANCES';
      statsCol.appendChild(resistTitle);

      resKeys.forEach(function(el) {
        var v = info.res[el];
        var sign = v > 0 ? '+' : '';
        statRow(el.toUpperCase(), sign + v, v > 0 ? '#88ff88' : '#ff6666');
      });
    } else if (!statSR) {
      var noSRNote = document.createElement('div');
      noSRNote.className = 'pregame-stat-row';
      noSRNote.style.cssText = 'font-size:8px;color:#555577;margin-top:6px;';
      noSRNote.textContent = 'stat rebalance off';
      statsCol.appendChild(noSRNote);
    }

    // Right: gear
    var gearCol = document.createElement('div');
    gearCol.className = 'pregame-col';

    var gearTitle = document.createElement('div');
    gearTitle.className = 'pregame-col-title';
    gearTitle.textContent = 'STARTING GEAR' + (gearNote ? ' ' + gearNote : '');
    gearCol.appendChild(gearTitle);

    gearList.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'pregame-gear-row';
      var bullet = document.createElement('span');
      bullet.className = 'pregame-gear-bullet';
      bullet.textContent = '▸';
      var text = document.createElement('span');
      text.textContent = item;
      if (item.indexOf('[SKILL]') === 0) text.style.color = '#aaaaff';
      row.appendChild(bullet);
      row.appendChild(text);
      gearCol.appendChild(row);
    });

    cols.appendChild(statsCol);
    cols.appendChild(gearCol);
    panel.appendChild(cols);

    // ── Buttons ─────────────────────────────────────────────────────────────
    var btnRow = document.createElement('div');
    btnRow.id = 'pregame-btn-row';

    var backBtn = document.createElement('button');
    backBtn.className = 'pregame-btn pregame-btn-back';
    backBtn.textContent = '← BACK';
    backBtn.addEventListener('click', function() {
      document.body.removeChild(overlay);
    });

    var challengeBtn = document.createElement('button');
    challengeBtn.className = 'pregame-btn pregame-btn-challenges';
    challengeBtn.textContent = '⚡ CHALLENGES';
    challengeBtn.addEventListener('click', function() {
      document.body.removeChild(overlay);
      if (typeof window.showChallengeModal === 'function') {
        window.showChallengeModal(onConfirm);
      } else {
        onConfirm();
      }
    });

    var startBtn = document.createElement('button');
    startBtn.className = 'pregame-btn pregame-btn-start';
    startBtn.textContent = '▶ PLAY';
    startBtn.addEventListener('click', function() {
      document.body.removeChild(overlay);
      window.RF3_CHALLENGES = [];
      onConfirm();
    });

    btnRow.appendChild(backBtn);
    btnRow.appendChild(challengeBtn);
    btnRow.appendChild(startBtn);
    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Trap clicks on overlay background
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
  }

  // ─── Storage helpers ───────────────────────────────────────────────────────

  function loadSaved() {
    try { var r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; }
    catch (e) { return {}; }
  }

  function saveValues(values) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch (e) {}
  }

  function loadSavedToggles() {
    try { var r = localStorage.getItem(TOGGLES_KEY); return r ? JSON.parse(r) : {}; }
    catch (e) { return {}; }
  }

  function saveToggles(toggles) {
    try { localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles)); } catch (e) {}
  }

  // ─── Apply to game globals ─────────────────────────────────────────────────

  function applyValues(values) {
    PARAMS.forEach(function (group) {
      group.items.forEach(function (p) {
        var val = values.hasOwnProperty(p.varName) ? values[p.varName] : p.def;
        window[p.varName] = Number(val);
      });
    });
  }

  function applyToggles(toggles) {
    TOGGLES.forEach(function (t) {
      window[t.key] = toggles.hasOwnProperty(t.key) ? Boolean(toggles[t.key]) : t.def;
    });
  }

  // Apply saved settings immediately, before Phaser initialises on window.onload
  var saved = loadSaved();
  applyValues(saved);

  var savedToggles = loadSavedToggles();
  applyToggles(savedToggles);

  // ─── UI ───────────────────────────────────────────────────────────────────

  function getCurrentValues() {
    var vals = {};
    PARAMS.forEach(function (group) {
      group.items.forEach(function (p) {
        var input = document.getElementById('mod-input-' + p.varName);
        if (input) { vals[p.varName] = Number(input.value); }
      });
    });
    return vals;
  }

  function getCurrentToggles() {
    var t = {};
    TOGGLES.forEach(function (tg) {
      var cb = document.getElementById('mod-toggle-' + tg.key);
      if (cb) { t[tg.key] = cb.checked; }
    });
    return t;
  }

  function formatValue(p, val) {
    return p.step < 1 ? Number(val).toFixed(2) : String(Number(val));
  }

  function buildPanel() {
    var current = loadSaved();
    var currentToggles = loadSavedToggles();

    // ─── Overlay ───────────────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.id = 'mod-overlay';

    var panel = document.createElement('div');
    panel.id = 'mod-panel';

    // ─── Header ────────────────────────────────────────────────────────────
    var header = document.createElement('div');
    header.id = 'mod-panel-header';

    var title = document.createElement('span');
    title.id = 'mod-panel-title';
    title.textContent = 'MOD PANEL';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'mod-close';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', closePanel);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // ─── Tabs ──────────────────────────────────────────────────────────────
    var tabs = document.createElement('div');
    tabs.id = 'mod-tabs';

    var tabMods = document.createElement('button');
    tabMods.className = 'mod-tab active';
    tabMods.textContent = 'MODS';

    var tabLandscape = document.createElement('button');
    tabLandscape.className = 'mod-tab';
    tabLandscape.textContent = 'LANDSCAPE';

    var tabReplays = document.createElement('button');
    tabReplays.className = 'mod-tab';
    tabReplays.textContent = 'REPLAYS';

    tabs.appendChild(tabMods);
    tabs.appendChild(tabLandscape);
    tabs.appendChild(tabReplays);

    // ─── Body ──────────────────────────────────────────────────────────────
    var body = document.createElement('div');
    body.id = 'mod-body';

    // ── MODS section (tab 1) ───────────────────────────────────────────────
    var modsSection = document.createElement('div');
    modsSection.id = 'mod-section-mods';

    var toggleTitle = document.createElement('div');
    toggleTitle.className = 'mod-section-title';
    toggleTitle.textContent = 'TOGGLES';
    modsSection.appendChild(toggleTitle);

    TOGGLES.forEach(function (tg) {
      var isOn = currentToggles.hasOwnProperty(tg.key) ? Boolean(currentToggles[tg.key]) : tg.def;

      var row = document.createElement('div');
      row.className = 'mod-toggle-row';

      var lbl = document.createElement('div');
      lbl.className = 'mod-label';
      lbl.style.flex = '1';
      lbl.textContent = tg.label;

      var switchLabel = document.createElement('label');
      switchLabel.className = 'mod-switch';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'mod-toggle-' + tg.key;
      cb.checked = isOn;

      var switchSlider = document.createElement('span');
      switchSlider.className = 'mod-switch-slider';

      switchLabel.appendChild(cb);
      switchLabel.appendChild(switchSlider);

      row.appendChild(lbl);
      row.appendChild(switchLabel);
      modsSection.appendChild(row);
    });

    body.appendChild(modsSection);

    // ── LANDSCAPE section (tab 2, hidden by default) ───────────────────────
    var landscapeSection = document.createElement('div');
    landscapeSection.id = 'mod-section-landscape';
    landscapeSection.style.display = 'none';

    PARAMS.forEach(function (group) {
      var sectionTitle = document.createElement('div');
      sectionTitle.className = 'mod-section-title';
      sectionTitle.textContent = group.section.toUpperCase();
      landscapeSection.appendChild(sectionTitle);

      group.items.forEach(function (p) {
        var val = current.hasOwnProperty(p.varName) ? current[p.varName] : p.def;

        var row = document.createElement('div');
        row.className = 'mod-row';

        var label = document.createElement('div');
        label.className = 'mod-label';
        label.textContent = p.label;
        label.title = p.varName;

        var slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'mod-slider';
        slider.id = 'mod-input-' + p.varName;
        slider.min = String(p.min);
        slider.max = String(p.max);
        slider.step = String(p.step);
        slider.value = String(val);

        var valueDisplay = document.createElement('div');
        valueDisplay.className = 'mod-value';
        valueDisplay.id = 'mod-val-' + p.varName;
        valueDisplay.textContent = formatValue(p, val);

        slider.addEventListener('input', function () {
          valueDisplay.textContent = formatValue(p, slider.value);
        });

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueDisplay);
        landscapeSection.appendChild(row);
      });
    });

    body.appendChild(landscapeSection);

    // ── REPLAYS section (tab 3, hidden by default) ─────────────────────────
    var replaysSection = document.createElement('div');
    replaysSection.id = 'mod-section-replays';
    replaysSection.style.display = 'none';

    function buildReplaysList() {
      replaysSection.innerHTML = '';

      var replays = window.getRf3Replays ? window.getRf3Replays() : [];

      if (replays.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'replay-empty';
        empty.textContent = 'No replays saved yet. Complete a run to record one.';
        replaysSection.appendChild(empty);
        return;
      }

      var apiBase = window.RF3_API_BASE || '/api-server/api';

      replays.slice().reverse().forEach(function (replay) {
        var date = replay.date ? new Date(replay.date) : null;
        var dateStr = date
          ? date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0') + ' ' +
            String(date.getHours()).padStart(2, '0') + ':' +
            String(date.getMinutes()).padStart(2, '0')
          : '—';

        var outcome = replay.isWin ? '★ WIN' : '✖ DEAD';
        var outcomeColor = replay.isWin ? '#88ff88' : '#ff6666';

        var row = document.createElement('div');
        row.className = 'replay-row';

        var meta = document.createElement('div');
        meta.className = 'replay-meta';
        meta.innerHTML =
          '<span class="replay-class">' + (replay.playerClass || '?') + '</span>' +
          '<span class="replay-outcome" style="color:' + outcomeColor + '">' + outcome + '</span>' +
          '<span class="replay-info">Floor ' + (replay.floor || replay.zoneLevel || '?') +
          ' · T' + (replay.turns || 0) + '</span>' +
          '<span class="replay-date">' + dateStr + '</span>';

        var btns = document.createElement('div');
        btns.className = 'replay-btns';

        var dlBtn = document.createElement('button');
        dlBtn.className = 'replay-btn';
        dlBtn.textContent = '↓ DL';
        dlBtn.title = 'Download replay as JSON';
        dlBtn.addEventListener('click', function () {
          var blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          var className = (replay.playerClass || 'run').replace(/\s+/g, '');
          var dateTag = date
            ? date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0')
            : 'replay';
          a.download = 'rf3_' + className + '_' + dateTag + '.json';
          a.href = url;
          a.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        });

        var ulBtn = document.createElement('button');
        ulBtn.className = 'replay-btn';
        ulBtn.textContent = '↑ UP';
        ulBtn.title = 'Upload replay to server';
        ulBtn.addEventListener('click', function () {
          ulBtn.textContent = '...';
          ulBtn.disabled = true;
          fetch(apiBase + '/replays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replay),
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.ok) {
                ulBtn.textContent = '✓ OK';
                ulBtn.style.color = '#88ff88';
              } else {
                ulBtn.textContent = 'ERR';
                ulBtn.style.color = '#ff6666';
                ulBtn.disabled = false;
              }
            })
            .catch(function () {
              ulBtn.textContent = 'ERR';
              ulBtn.style.color = '#ff6666';
              ulBtn.disabled = false;
            });
        });

        btns.appendChild(dlBtn);
        btns.appendChild(ulBtn);
        row.appendChild(meta);
        row.appendChild(btns);
        replaysSection.appendChild(row);
      });
    }

    body.appendChild(replaysSection);

    // ── Tab switching ──────────────────────────────────────────────────────
    function showTab(active) {
      [tabMods, tabLandscape, tabReplays].forEach(function (t) { t.classList.remove('active'); });
      [modsSection, landscapeSection, replaysSection].forEach(function (s) { s.style.display = 'none'; });
      active.tab.classList.add('active');
      active.section.style.display = '';
      if (active.onShow) active.onShow();
    }

    tabMods.addEventListener('click', function () {
      showTab({ tab: tabMods, section: modsSection });
    });

    tabLandscape.addEventListener('click', function () {
      showTab({ tab: tabLandscape, section: landscapeSection });
    });

    tabReplays.addEventListener('click', function () {
      showTab({ tab: tabReplays, section: replaysSection, onShow: buildReplaysList });
    });

    // ─── Footer ────────────────────────────────────────────────────────────
    var footer = document.createElement('div');
    footer.id = 'mod-footer';

    var applyBtn = document.createElement('button');
    applyBtn.className = 'mod-footer-btn';
    applyBtn.textContent = 'APPLY';
    applyBtn.addEventListener('click', function () {
      var vals = getCurrentValues();
      var togs = getCurrentToggles();
      saveValues(vals);
      saveToggles(togs);
      applyValues(vals);
      applyToggles(togs);
      closePanel();
    });

    var resetBtn = document.createElement('button');
    resetBtn.className = 'mod-footer-btn';
    resetBtn.textContent = 'RESET';
    resetBtn.title = 'Reset all values to defaults and apply';
    resetBtn.addEventListener('click', function () {
      var defaults = {};
      PARAMS.forEach(function (group) {
        group.items.forEach(function (p) {
          var input = document.getElementById('mod-input-' + p.varName);
          var display = document.getElementById('mod-val-' + p.varName);
          if (input) { input.value = String(p.def); display.textContent = formatValue(p, p.def); }
          defaults[p.varName] = p.def;
        });
      });
      var defToggles = {};
      TOGGLES.forEach(function (tg) {
        var cb = document.getElementById('mod-toggle-' + tg.key);
        if (cb) { cb.checked = tg.def; }
        defToggles[tg.key] = tg.def;
      });
      saveValues(defaults);
      saveToggles(defToggles);
      applyValues(defaults);
      applyToggles(defToggles);
      closePanel();
    });

    var noteSpan = document.createElement('span');
    noteSpan.style.cssText = 'font-size:10px;color:#777799;align-self:center;margin-left:auto;';
    noteSpan.textContent = 'takes effect on next level';

    footer.appendChild(applyBtn);
    footer.appendChild(resetBtn);
    footer.appendChild(noteSpan);

    // ─── Assemble ──────────────────────────────────────────────────────────
    panel.appendChild(header);
    panel.appendChild(tabs);
    panel.appendChild(body);
    panel.appendChild(footer);
    overlay.appendChild(panel);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePanel();
    });

    return overlay;
  }

  var overlayEl = null;
  var visible = false;

  function openPanel() {
    if (!overlayEl) {
      overlayEl = buildPanel();
      document.body.appendChild(overlayEl);
    }
    overlayEl.classList.add('open');
    visible = true;
  }

  function closePanel() {
    if (overlayEl) overlayEl.classList.remove('open');
    visible = false;
  }

  function togglePanel() {
    if (visible) { closePanel(); } else { openPanel(); }
  }

  // ─── Return to Main Menu (M key) ─────────────────────────────────────────

  function tryReturnToMenu() {
    var gs = window.gs;
    var game = window.game;
    if (!gs || !gs.pc || !gs.pc.isAlive || !game || !game.state) return;
    if (document.getElementById('menu-confirm-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'menu-confirm-overlay';

    var box = document.createElement('div');
    box.id = 'menu-confirm-box';
    box.innerHTML =
      '<p id="menu-confirm-text">Return to main menu?<br><span style="font-size:10px;opacity:.7">(progress will be saved)</span></p>';

    var btnYes = document.createElement('button');
    btnYes.className = 'pregame-btn pregame-btn-start';
    btnYes.textContent = 'YES';
    btnYes.addEventListener('click', function () {
      overlay.remove();
      gs.saveLevel();
      gs.pc.save();
      game.state.start('menu');
    });

    var btnNo = document.createElement('button');
    btnNo.className = 'pregame-btn pregame-btn-back';
    btnNo.textContent = 'NO';
    btnNo.addEventListener('click', function () { overlay.remove(); });

    var btnRow = document.createElement('div');
    btnRow.className = 'pregame-btn-row';
    btnRow.appendChild(btnNo);
    btnRow.appendChild(btnYes);

    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var onKey = function (e) {
      if (e.key === 'Escape' || e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
      }
      if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y' || e.key === 'н' || e.key === 'Н') {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        gs.saveLevel();
        gs.pc.save();
        game.state.start('menu');
      }
    };
    document.addEventListener('keydown', onKey);
  }

  // ─── MOD button ───────────────────────────────────────────────────────────

  function init() {
    var btn = document.createElement('button');
    btn.id = 'mod-btn';
    btn.textContent = 'MOD';
    btn.addEventListener('click', togglePanel);
    document.body.appendChild(btn);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'u' || e.key === 'U' || e.code === 'KeyU' || e.key === 'г' || e.key === 'Г') {
        togglePanel();
      }
      if (e.key === 'm' || e.key === 'M' || e.code === 'KeyM' || e.key === 'ь' || e.key === 'Ь') {
        tryReturnToMenu();
      }
    });

    window.showPreGameModal = showPreGameModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
