(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  var VLT_KEY     = 'rf3_vlt';
  var DEFAULT_VLT = 200;
  var BET_AMOUNT  = 100;
  var WIN_AMOUNT  = 200; // 2x payout

  // ── VLT balance ───────────────────────────────────────────────────────────
  function getVlt() {
    var v = parseInt(localStorage.getItem(VLT_KEY), 10);
    return isNaN(v) ? DEFAULT_VLT : v;
  }
  function setVlt(v) {
    localStorage.setItem(VLT_KEY, String(Math.max(0, v)));
  }
  window.RF3_VLT = {
    get:    getVlt,
    add:    function (n) { setVlt(getVlt() + n); },
    deduct: function (n) { setVlt(getVlt() - n); },
  };

  // ── Challenge catalogue ───────────────────────────────────────────────────
  var CHALLENGE_DEFS = [
    {
      id: 'only_crit',
      name: 'ONLY CRITS',
      // Survival challenge: passes on run-win if never violated
      desc: 'Every damaging hit must be a critical. First non-crit fails.',
      color: '#ff8844',
    },
    {
      id: 'combo_kills',
      name: 'COMBO KILLS',
      // Survival challenge: each turn with kills must have exactly 2 or 3
      // spec: "2-or-3-unit combo"; lone kills (1) or mass kills (4+) both fail
      desc: 'Every kill turn must have exactly 2 or 3 kills. Lone or mass kills fail.',
      color: '#ff44aa',
    },
    {
      id: 'gold_813',
      name: '813 GOLD',
      // Achievement challenge: passes the moment gold reaches 813
      desc: 'Accumulate 813 gold at any point during the run.',
      color: '#ffdd44',
    },
    {
      id: 'level_20',
      name: 'LEVEL 20',
      // Achievement challenge: passes when player reaches level 20
      desc: 'Reach player level 20.',
      color: '#44ffaa',
    },
    {
      id: 'speedrun_607',
      name: '6:07 SPEEDRUN',
      // Achievement challenge: passes only on game-win within 367 real seconds
      desc: 'Complete the run (win) within 6 min 7 sec of real time.',
      color: '#44aaff',
    },
    {
      id: 'great_combo_x5',
      name: 'GREAT COMBO ×5',
      // Achievement challenge: passes when player achieves 5+ kills/turn five times
      desc: 'Kill 5 or more enemies in one turn, five separate times.',
      color: '#dd44ff',
    },
  ];

  // ── Per-run state ─────────────────────────────────────────────────────────
  window.RF3_CHALLENGES = null; // null = no active run; [] = run with no challenges
  var runStartTime    = null;
  var _comboTurn      = -1;  // which game-turn the current kill streak is on
  var _comboKills     = 0;   // how many kills in _comboTurn
  var _greatComboCount = 0;  // how many times player hit 5+ kills in one turn
  var _pollTurn       = -1;  // last seen gs.turn for the interval poller

  // ── Challenge helpers ─────────────────────────────────────────────────────
  function isActive(id) {
    if (!window.RF3_CHALLENGES) return false;
    for (var i = 0; i < window.RF3_CHALLENGES.length; i++) {
      if (window.RF3_CHALLENGES[i].id === id &&
          window.RF3_CHALLENGES[i].status === 'active') return true;
    }
    return false;
  }

  function getCh(id) {
    if (!window.RF3_CHALLENGES) return null;
    for (var i = 0; i < window.RF3_CHALLENGES.length; i++) {
      if (window.RF3_CHALLENGES[i].id === id) return window.RF3_CHALLENGES[i];
    }
    return null;
  }

  function defById(id) {
    for (var i = 0; i < CHALLENGE_DEFS.length; i++) {
      if (CHALLENGE_DEFS[i].id === id) return CHALLENGE_DEFS[i];
    }
    return null;
  }

  function failChallenge(id) {
    var c = getCh(id);
    if (!c || c.status !== 'active') return;
    c.status = 'failed';
    var def = defById(id);
    showNotification('✖ ' + (def ? def.name : id) + ' FAILED', '#ff5555');
    if (window.recordReplayEvent) window.recordReplayEvent('challenge', { id: id, status: 'fail' });
    updateHud();
  }

  function passChallenge(id) {
    var c = getCh(id);
    if (!c || c.status !== 'active') return;
    c.status = 'passed';
    window.RF3_VLT.add(WIN_AMOUNT);
    var def = defById(id);
    showNotification('★ ' + (def ? def.name : id) + '  +' + WIN_AMOUNT + ' VLT', '#44ff88');
    if (window.recordReplayEvent) window.recordReplayEvent('challenge', { id: id, status: 'pass' });
    updateHud();
  }

  // ── Combo-turn resolver ───────────────────────────────────────────────────
  // Called when a game turn ends and we have recorded kills for that turn.
  // combo_kills spec: exactly 2 or 3 kills per kill-turn; 1 (lone) or 4+ both fail.
  // great_combo_x5: 5+ kills in one turn counts as one "great combo".
  function resolveComboTurn() {
    if (_comboTurn < 0 || _comboKills === 0) return;

    // combo_kills check
    if (isActive('combo_kills') && (_comboKills < 2 || _comboKills > 3)) {
      failChallenge('combo_kills');
    }

    // great_combo_x5 check
    if (_comboKills >= 5 && isActive('great_combo_x5')) {
      _greatComboCount++;
      if (_greatComboCount >= 5) passChallenge('great_combo_x5');
    }

    _comboTurn  = -1;
    _comboKills = 0;
  }

  // ── Live turn-boundary poller (200 ms) ────────────────────────────────────
  // Detects when gs.turn advances past the turn on which kills happened,
  // allowing combo failures to fire immediately rather than waiting for the
  // next kill event.
  setInterval(function () {
    var gs = window.gs;
    if (!gs || !window.RF3_CHALLENGES) {
      if (gs) _pollTurn = gs.turn;
      return;
    }
    var cur = gs.turn;
    if (typeof cur !== 'number') return;
    if (_comboTurn >= 0 && _comboKills > 0 && cur !== _comboTurn) {
      resolveComboTurn();
    }
    _pollTurn = cur;
  }, 200);

  // ── Prototype patches ─────────────────────────────────────────────────────
  // All patches check window.STAT_REBALANCE_ENABLED at runtime (not init-time)
  // so toggling the flag mid-session takes effect immediately.

  // ─ takeDamage → only_crit ────────────────────────────────────────────────
  if (typeof Character !== 'undefined') {
    var _origTakeDmg = Character.prototype.takeDamage;
    Character.prototype.takeDamage = function (amount, damageType, flags) {
      flags = flags || {};
      var gs = window.gs;
      var shouldTrack =
        window.STAT_REBALANCE_ENABLED &&
        gs && flags.killer === gs.pc &&
        this !== gs.pc &&
        damageType !== 'None' &&
        isActive('only_crit');

      if (shouldTrack) {
        // Temporarily intercept queuePopUpText to detect whether the
        // engine marks this hit as a crit (text starts with "Crit -N").
        var _savedQueue = this.queuePopUpText;
        var detectedCrit = false;
        this.queuePopUpText = function (text) {
          if (typeof text === 'string' && text.charAt(0) === 'C') detectedCrit = true;
          return _savedQueue ? _savedQueue.apply(this, arguments) : undefined;
        };
        var dmg = _origTakeDmg.call(this, amount, damageType, flags);
        this.queuePopUpText = _savedQueue;
        if (dmg > 0 && !detectedCrit) failChallenge('only_crit');
        return dmg;
      }

      return _origTakeDmg.call(this, amount, damageType, flags);
    };
  }

  // ─ onKill → combo_kills / great_combo_x5 ─────────────────────────────────
  if (typeof PlayerCharacter !== 'undefined') {
    var _origOnKill = PlayerCharacter.prototype.onKill;
    PlayerCharacter.prototype.onKill = function (character) {
      if (_origOnKill) _origOnKill.call(this, character);
      if (!window.RF3_CHALLENGES || !window.STAT_REBALANCE_ENABLED) return;
      var gs = window.gs;
      var turn = gs ? gs.turn : 0;

      if (_comboTurn >= 0 && turn !== _comboTurn) {
        // Player started a new turn; finalize the previous turn's kills
        resolveComboTurn();
      }
      _comboTurn = turn;
      _comboKills++;
    };

    // ─ gainLevel → level_20 ─────────────────────────────────────────────────
    var _origGainLevel = PlayerCharacter.prototype.gainLevel;
    PlayerCharacter.prototype.gainLevel = function () {
      _origGainLevel.call(this);
      if (window.RF3_CHALLENGES && window.STAT_REBALANCE_ENABLED && this.level >= 20) {
        passChallenge('level_20');
      }
    };
  }

  // ─ addItem → gold_813 ────────────────────────────────────────────────────
  if (typeof CharacterInventory !== 'undefined') {
    var _origAddItem = CharacterInventory.prototype.addItem;
    CharacterInventory.prototype.addItem = function (item) {
      _origAddItem.call(this, item);
      if (
        window.RF3_CHALLENGES &&
        window.STAT_REBALANCE_ENABLED &&
        item && item.type && item.type.name === 'GoldCoin' &&
        window.gs && this.character === window.gs.pc &&
        isActive('gold_813') &&
        this.gold >= 813
      ) {
        passChallenge('gold_813');
      }
    };
  }

  // ── Run-end resolver (patched onto gs.logGameRecord once gs is ready) ─────
  function patchGs() {
    var gs = window.gs;
    if (!gs || typeof gs.logGameRecord !== 'function') { setTimeout(patchGs, 300); return; }

    var _origLog = gs.logGameRecord;
    gs.logGameRecord = function (text, isWin) {
      if (window.RF3_CHALLENGES && window.RF3_CHALLENGES.length > 0) {
        // Finalize any outstanding combo-turn data before resolving run end
        resolveComboTurn();

        if (isWin) {
          // Survival challenges pass if never violated during the run
          ['only_crit', 'combo_kills'].forEach(function (id) {
            if (isActive(id)) passChallenge(id);
          });

          // Achievement challenges: if still active at win → failed
          ['gold_813', 'level_20', 'great_combo_x5'].forEach(function (id) {
            if (isActive(id)) failChallenge(id);
          });

          // Speedrun: check elapsed real time
          if (isActive('speedrun_607')) {
            if (runStartTime !== null && (Date.now() - runStartTime) / 1000 <= 367) {
              passChallenge('speedrun_607');
            } else {
              failChallenge('speedrun_607');
            }
          }
        } else {
          // Death: every still-active challenge fails; routed through failChallenge
          // so replay events are always emitted for each
          window.RF3_CHALLENGES.forEach(function (c) {
            if (c.status === 'active') failChallenge(c.id);
          });
        }

        showRunEndSummary(isWin);
      }
      return _origLog.call(gs, text, isWin);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(patchGs, 700); });
  } else {
    setTimeout(patchGs, 700);
  }

  // ── New-seed → reset per-run state ────────────────────────────────────────
  var _lastSeed = null;
  setInterval(function () {
    var gs = window.gs;
    if (!gs || !gs.seed) return;
    if (gs.seed !== _lastSeed) {
      _lastSeed        = gs.seed;
      runStartTime     = Date.now();
      _comboTurn       = -1;
      _comboKills      = 0;
      _greatComboCount = 0;
      _pollTurn        = -1;
      // RF3_CHALLENGES is set by showChallengeModal before the run begins
    }
  }, 400);

  // ── In-game HUD badge ─────────────────────────────────────────────────────
  var hudEl = null;

  function buildHud() {
    if (hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'challenge-hud';
    document.body.appendChild(hudEl);
    updateHud();
  }

  function updateHud() {
    if (!hudEl) return;
    if (!window.RF3_CHALLENGES || window.RF3_CHALLENGES.length === 0) {
      hudEl.style.display = 'none';
      return;
    }
    hudEl.style.display = 'flex';
    hudEl.innerHTML = '';

    var vltDiv = document.createElement('div');
    vltDiv.className = 'chud-vlt';
    vltDiv.textContent = 'VLT ' + getVlt();
    hudEl.appendChild(vltDiv);

    window.RF3_CHALLENGES.forEach(function (c) {
      var def = defById(c.id);
      var row = document.createElement('div');
      row.className = 'chud-row chud-' + c.status;
      var icon = c.status === 'active' ? '◈' : c.status === 'passed' ? '★' : '✖';
      row.textContent = icon + ' ' + (def ? def.name : c.id);
      if (def) row.style.borderLeftColor = def.color;
      hudEl.appendChild(row);
    });
  }

  // ── Floating toast notification ───────────────────────────────────────────
  function showNotification(text, color) {
    var note = document.createElement('div');
    note.className = 'challenge-notify';
    note.textContent = text;
    note.style.color = color || '#ffffff';
    document.body.appendChild(note);
    setTimeout(function () { note.style.opacity = '0'; }, 2200);
    setTimeout(function () { if (note.parentNode) note.parentNode.removeChild(note); }, 3000);
  }

  // ── Run-end summary panel ─────────────────────────────────────────────────
  function showRunEndSummary(isWin) {
    if (!window.RF3_CHALLENGES || window.RF3_CHALLENGES.length === 0) return;
    setTimeout(function () {
      var overlay = document.createElement('div');
      overlay.id = 'challenge-summary-overlay';

      var box = document.createElement('div');
      box.id = 'challenge-summary-box';

      var title = document.createElement('div');
      title.className = 'csummary-title';
      title.textContent = isWin ? '★ CHALLENGES' : '✖ CHALLENGES';
      title.style.color = isWin ? '#88ff88' : '#ff6666';
      box.appendChild(title);

      window.RF3_CHALLENGES.forEach(function (c) {
        var def = defById(c.id);
        var row = document.createElement('div');
        row.className = 'csummary-row';

        var icon = document.createElement('span');
        icon.className = 'csummary-icon';
        icon.textContent = c.status === 'passed' ? '★' : '✖';
        icon.style.color = c.status === 'passed' ? '#88ff88' : '#ff5555';

        var name = document.createElement('span');
        name.className = 'csummary-name';
        name.textContent = def ? def.name : c.id;
        if (def) name.style.color = def.color;

        var payout = document.createElement('span');
        payout.className = 'csummary-payout';
        payout.textContent = c.status === 'passed' ? '+' + WIN_AMOUNT + ' VLT' : '—';
        payout.style.color = c.status === 'passed' ? '#88ff88' : '#555577';

        row.appendChild(icon);
        row.appendChild(name);
        row.appendChild(payout);
        box.appendChild(row);
      });

      var vltRow = document.createElement('div');
      vltRow.className = 'csummary-vlt';
      vltRow.textContent = 'BALANCE: ' + getVlt() + ' VLT';
      box.appendChild(vltRow);

      var closeBtn = document.createElement('button');
      closeBtn.className = 'csummary-close pregame-btn pregame-btn-start';
      closeBtn.textContent = 'OK';
      closeBtn.addEventListener('click', function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (hudEl) hudEl.style.display = 'none';
        window.RF3_CHALLENGES = null;
      });
      box.appendChild(closeBtn);

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeBtn.click();
      });
    }, 800);
  }

  // ── Pre-game challenge selection modal ────────────────────────────────────
  window.showChallengeModal = function (onConfirm) {
    var selected = {};

    var overlay = document.createElement('div');
    overlay.id = 'challenge-pick-overlay';

    var panel = document.createElement('div');
    panel.id = 'challenge-pick-panel';

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'cpick-header';
    var hdrTitle = document.createElement('div');
    hdrTitle.className = 'cpick-title';
    hdrTitle.textContent = 'CHALLENGES & BETS';
    var hdrSub = document.createElement('div');
    hdrSub.className = 'cpick-sub';
    hdrSub.textContent = 'Each challenge costs ' + BET_AMOUNT + ' VLT. Pass pays ' + WIN_AMOUNT + ' VLT.';
    hdr.appendChild(hdrTitle);
    hdr.appendChild(hdrSub);
    panel.appendChild(hdr);

    // VLT balance bar
    var vltBar = document.createElement('div');
    vltBar.id = 'cpick-vlt-bar';
    var vltLabel = document.createElement('span');
    vltLabel.className = 'cpick-vlt-label';
    vltLabel.textContent = 'YOUR VLT:';
    var vltAmt = document.createElement('span');
    vltAmt.id = 'cpick-vlt-amt';
    vltAmt.textContent = getVlt();
    vltBar.appendChild(vltLabel);
    vltBar.appendChild(vltAmt);
    panel.appendChild(vltBar);

    function refreshVlt() {
      var count = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
      var spend = count * BET_AMOUNT;
      var remaining = getVlt() - spend;
      vltAmt.textContent = getVlt() + ' (−' + spend + ' = ' + remaining + ')';
      vltAmt.style.color = remaining < 0 ? '#ff5555' : '#ffdd66';
    }

    // Challenge cards
    var list = document.createElement('div');
    list.id = 'cpick-list';

    CHALLENGE_DEFS.forEach(function (def) {
      var card = document.createElement('div');
      card.className = 'cpick-card';
      card.style.borderLeftColor = def.color;

      var top = document.createElement('div');
      top.className = 'cpick-card-top';
      var cardName = document.createElement('span');
      cardName.className = 'cpick-card-name';
      cardName.textContent = def.name;
      cardName.style.color = def.color;
      var cardCost = document.createElement('span');
      cardCost.className = 'cpick-card-cost';
      cardCost.textContent = BET_AMOUNT + ' VLT';
      top.appendChild(cardName);
      top.appendChild(cardCost);

      var desc = document.createElement('div');
      desc.className = 'cpick-card-desc';
      desc.textContent = def.desc;

      card.appendChild(top);
      card.appendChild(desc);
      list.appendChild(card);

      card.addEventListener('click', function () {
        if (selected[def.id]) {
          delete selected[def.id];
          card.classList.remove('selected');
        } else {
          var count = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
          if ((count + 1) * BET_AMOUNT > getVlt()) {
            card.classList.add('cpick-shake');
            setTimeout(function () { card.classList.remove('cpick-shake'); }, 400);
            return;
          }
          selected[def.id] = true;
          card.classList.add('selected');
        }
        refreshVlt();
      });
    });

    panel.appendChild(list);

    // Buttons
    var btnRow = document.createElement('div');
    btnRow.id = 'cpick-btn-row';

    var skipBtn = document.createElement('button');
    skipBtn.className = 'pregame-btn pregame-btn-back';
    skipBtn.textContent = '← SKIP';
    skipBtn.addEventListener('click', function () {
      if (overlay.parentNode) document.body.removeChild(overlay);
      window.RF3_CHALLENGES = [];
      buildHud();
      onConfirm();
    });

    var startBtn = document.createElement('button');
    startBtn.className = 'pregame-btn pregame-btn-start';
    startBtn.textContent = '▶ START';
    startBtn.addEventListener('click', function () {
      var ids = Object.keys(selected).filter(function (k) { return selected[k]; });
      if (ids.length * BET_AMOUNT > getVlt()) return;
      window.RF3_VLT.deduct(ids.length * BET_AMOUNT);
      window.RF3_CHALLENGES = ids.map(function (id) { return { id: id, status: 'active' }; });
      _comboTurn       = -1;
      _comboKills      = 0;
      _greatComboCount = 0;
      if (overlay.parentNode) document.body.removeChild(overlay);
      buildHud();
      updateHud();
      onConfirm();
    });

    btnRow.appendChild(skipBtn);
    btnRow.appendChild(startBtn);
    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) skipBtn.click(); });
    refreshVlt();
  };

}());
