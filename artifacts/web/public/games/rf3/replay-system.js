(function () {
  'use strict';

  var REPLAYS_KEY = 'rf3_replays';
  var MAX_REPLAYS = 10;
  window.RF3_API_BASE = '/api-server/api';

  // ── Per-run state ─────────────────────────────────────────────────────────
  window.REPLAY_SEED   = null;
  window.REPLAY_EVENTS = [];

  // ── recordReplayEvent(type, data, tags) ───────────────────────────────────
  // Public: main.js patches and challenge system (Task #7) can call this.
  window.recordReplayEvent = function (type, data, tags) {
    window.REPLAY_EVENTS.push({
      type: type,
      data: data || {},
      turn: (window.gs ? window.gs.turn : 0),
      tags: tags || [],
    });
  };

  // ── Storage helpers ────────────────────────────────────────────────────────
  function loadReplays() {
    try {
      var raw = localStorage.getItem(REPLAYS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveReplayToStorage(replay) {
    var list = loadReplays();
    list.push(replay);
    if (list.length > MAX_REPLAYS) {
      list = list.slice(list.length - MAX_REPLAYS);
    }
    try { localStorage.setItem(REPLAYS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  window.getRf3Replays = loadReplays;

  // ── Prototype patches (PlayerCharacter already defined by main.js) ────────
  // These run synchronously at script load — no polling needed.

  if (typeof PlayerCharacter !== 'undefined') {

    // Move — actual tile step (excludes attacks, recorded separately)
    var _origMoveTo = PlayerCharacter.prototype.moveTo;
    PlayerCharacter.prototype.moveTo = function (tileIndex, moveTime) {
      window.recordReplayEvent('move', { x: tileIndex.x, y: tileIndex.y });
      return _origMoveTo.apply(this, arguments);
    };

    // Attack — melee or ranged weapon strike
    var _origAttack = PlayerCharacter.prototype.attack;
    PlayerCharacter.prototype.attack = function (tileIndex, endTurn, weapon) {
      var wName = null;
      try { wName = (weapon || this.inventory.getWeapon()).type.name; } catch (e) {}
      window.recordReplayEvent('attack', { x: tileIndex.x, y: tileIndex.y, weapon: wName });
      return _origAttack.apply(this, arguments);
    };

    // Ability — fires (zap) with a selected ability type and optional target tile
    var _origZap = PlayerCharacter.prototype.zap;
    PlayerCharacter.prototype.zap = function (tileIndex) {
      var abilityName = null;
      try { abilityName = this.selectedAbility.type.name; } catch (e) {}
      window.recordReplayEvent('ability', {
        name: abilityName,
        x: tileIndex ? tileIndex.x : null,
        y: tileIndex ? tileIndex.y : null,
      });
      return _origZap.apply(this, arguments);
    };

    // Item use — consumable slot clicked (potion, scroll, food, wand)
    var _origConsumableSlot = PlayerCharacter.prototype.consumableSlotClicked;
    PlayerCharacter.prototype.consumableSlotClicked = function (slot) {
      try {
        if (slot && slot.hasItem && slot.hasItem()) {
          window.recordReplayEvent('item', { name: slot.item.type.name });
        }
      } catch (e) {}
      return _origConsumableSlot.apply(this, arguments);
    };

  }

  // ── Seed tracker (polls gs.seed, resets REPLAY_EVENTS on new run) ─────────
  var _lastSeed = null;

  setInterval(function () {
    var gs = window.gs;
    if (!gs) return;
    if (gs.seed && gs.seed !== _lastSeed) {
      _lastSeed = gs.seed;
      window.REPLAY_SEED = gs.seed;
      window.REPLAY_EVENTS = [];
    }
  }, 400);

  // ── Patch gs once it's initialised (for logGameRecord only) ───────────────
  function patchGs() {
    var gs = window.gs;
    if (!gs || typeof gs.logGameRecord !== 'function') {
      setTimeout(patchGs, 250);
      return;
    }

    // Auto-save replay on run end (death or win)
    var _origLogRecord = gs.logGameRecord;
    gs.logGameRecord = function (text, isWin) {
      try {
        var replay = {
          id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          seed:        gs.seed || window.REPLAY_SEED || '',
          date:        Date.now(),
          playerClass: gs.pc ? gs.pc.characterClass : 'Unknown',
          zoneName:    gs.zoneName || '',
          zoneLevel:   gs.zoneLevel || 0,
          floor:       (gs.niceZoneLevel ? gs.niceZoneLevel(gs.zoneName, gs.zoneLevel) : gs.zoneLevel) || 0,
          turns:       gs.turn || 0,
          isWin:       !!isWin,
          text:        text || '',
          events:      window.REPLAY_EVENTS.slice(),
        };
        saveReplayToStorage(replay);
        window.REPLAY_EVENTS = [];
        window.REPLAY_SEED   = null;
        _lastSeed            = null;
      } catch (e) {
        console.warn('[replay-system] save failed', e);
      }
      return _origLogRecord.call(gs, text, isWin);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(patchGs, 600); });
  } else {
    setTimeout(patchGs, 600);
  }
}());
