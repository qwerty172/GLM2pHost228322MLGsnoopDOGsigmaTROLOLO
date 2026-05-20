// Class-specific gameplay mechanics patch
// Loaded after main.js, replay-system.js, mod-panel.js, challenges.js
//
// ── PowerStrike stun ─────────────────────────────────────────────────────────
//   Stun duration = talent level (Lv1→1 turn, Lv2→2 turns, Lv3→3 turns).
//
// ── Berserk rework ───────────────────────────────────────────────────────────
//   While active: movementSpeed forced to NORMAL (ignores slow/Barbarian slow).
//   Two-handed weapons treated as one-handed (StrafeAttack, hasShield check).
//   Original bonuses (alwaysCrit, knockBackOnHit) preserved.
//
// ── Crit knockback (non-stealth) ─────────────────────────────────────────────
//   Any melee/physical crit where the enemy was already aggroed → knockback 1.
//   Stealth crits (enemy not aggroed) are excluded.
//
// ── Aggro drop system ────────────────────────────────────────────────────────
//   tryDropAggro(npc) sets isAgroed=false and shows "?" popup.
//   Triggers:
//     • Electric crit (damageType='Shock' + isCrit + killer=pc): 50% chance
//     • Stun (Stunned status applied to hostile): 100%
//     • SmokeBomb landing area (radius 1.5): 100%
//     • Shock SPELL (all flooded NPCs): 100%
//     • Standing still (no tile change last turn): passive per-NPC check
//       formula: dropChance% = 100/3/detectPct, only if detectPct < 30 (else 0)
//
// ── Barbarian Shift+Dash ─────────────────────────────────────────────────────
//   Cardinal Shift+direction → dash 1-2 tiles; only checks enemies in dash dir.
//   Attack found: 3 rage; pc.attack() handles AoE. No enemy: 2 rage.
//
// ── Charge / Sprint level-based cooldowns ────────────────────────────────────
//   Charge  Lv1:cd8  Lv2:cd4  Lv3:cd9
//   Sprint  Lv1:cd5  Lv2:cd10 Lv3:cd3
//
// ── Poison does not break sleep ──────────────────────────────────────────────
// ── Diagonal movement penalty at 2× speed ───────────────────────────────────
// ── Necromancer LifeSpike rework (NecroSummon, bone gathering, HP cost) ──────

(function () {
  'use strict';

  // ── Helper: drop aggro on an NPC ────────────────────────────────────────────
  function tryDropAggro(npc) {
    if (!npc || !npc.isAlive || !npc.isAgroed || npc.faction !== FACTION.HOSTILE) {
      return false;
    }
    npc.isAgroed    = false;
    npc.unagroTimer = 0;
    npc.popUpText('?', '#ffff00');
    return true;
  }

  // ── 1. Poison does not break sleep ─────────────────────────────────────────
  if (typeof Character !== 'undefined') {
    var _origOnTurnPoison = Character.prototype.onTurnPoison;
    Character.prototype.onTurnPoison = function () {
      if (!window.STAT_REBALANCE_ENABLED) {
        return _origOnTurnPoison.call(this);
      }
      var wasAsleep = this.isAsleep;
      _origOnTurnPoison.call(this);
      if (wasAsleep) { this.isAsleep = true; }
    };
  }

  // ── 2. Track movement (aggro-drop) + Berserk StrafeAttack ──────────────────
  if (typeof PlayerCharacter !== 'undefined') {
    var _origMoveTo_CM = PlayerCharacter.prototype.moveTo;
    PlayerCharacter.prototype.moveTo = function (tileIndex, moveTime) {
      if (this === gs.pc) {
        gs._playerMovedThisTurn = true;
      }

      // Berserk: two-handed weapon temporarily treated as one-handed
      // so StrafeAttack fires on every step (original moveTo checks hands===1)
      var weaponType = null;
      var origHands;
      if (window.STAT_REBALANCE_ENABLED && this._berserkerMode) {
        var w = this.inventory && this.inventory.getWeapon && this.inventory.getWeapon();
        if (w && w.type && w.type.hands === 2) {
          weaponType = w.type;
          origHands  = w.type.hands;
          w.type.hands = 1;
        }
      }

      _origMoveTo_CM.call(this, tileIndex, moveTime);

      if (origHands !== undefined) { weaponType.hands = origHands; }
    };

    // Also track teleportTo (dash, Sneak, etc.)
    var _origTeleportTo_CM = PlayerCharacter.prototype.teleportTo;
    PlayerCharacter.prototype.teleportTo = function (tileIndex) {
      if (this === gs.pc) {
        gs._playerMovedThisTurn = true;
      }
      _origTeleportTo_CM.call(this, tileIndex);
    };
  }

  // ── 3. Fix food / speed boots / Berserk speed — all run AFTER original updateStats ──
  // updateStatsBase() recalculates movementSpeed at its very end, overwriting anything
  // set by statusEffects.onUpdateStats. The Barbarian STAT_REBALANCE block then runs
  // after updateStatsBase and forces movementSpeed=0, wiping boots benefit entirely.
  // Solution: apply all speed fixes here, after _origPCUpdateStats has finished.
  if (typeof PlayerCharacter !== 'undefined') {
    var _origPCUpdateStats = PlayerCharacter.prototype.updateStats;
    PlayerCharacter.prototype.updateStats = function () {
      this._berserkerMode = false;
      var wasAtMax = this.maxFood > 0 && this.currentFood >= this.maxFood;
      _origPCUpdateStats.call(this);

      if (window.STAT_REBALANCE_ENABLED) {
        // Food fix: restore to max if was at max before stats recalc
        if (wasAtMax) { this.currentFood = this.maxFood; }

        // Speed boots fix for Barbarian: STAT_REBALANCE forces movementSpeed=0,
        // but equipped boots (bonusMovementSpeed > 0) should still give NORMAL speed.
        if (this.characterClass === 'Barbarian' && this.bonusMovementSpeed > 0) {
          this.movementSpeed = Math.min(2, Math.max(0, this.bonusMovementSpeed));
          this.moveTime      = MOVE_TIME[this.movementSpeed];
        }

        // Berserk speed override: force at least NORMAL speed (ignoring slows).
        // Must run after STAT_REBALANCE since that block overrides to SLOW.
        if (this.statusEffects && this.statusEffects.has('Berserk')) {
          this.movementSpeed = Math.max(1, this.movementSpeed);
          this.moveTime      = MOVE_TIME[this.movementSpeed];
          this._berserkerMode = true;
        }
      }
    };
  }

  // ── 4. Patch NPC.prototype.updateStats to call statusEffects.onUpdateStats ─
  if (typeof NPC !== 'undefined') {
    var _origNPCUpdateStats = NPC.prototype.updateStats;
    NPC.prototype.updateStats = function () {
      _origNPCUpdateStats.call(this);
      if (this.statusEffects && typeof this.statusEffects.onUpdateStats === 'function') {
        this.statusEffects.onUpdateStats();
      }
    };
  }

  // ── 5. Aggro-drop + crit-knockback system (runs after gs fully initialised) ─
  function installAggroDrop() {

    // 5a. Electric crit → 50% aggro drop
    //     Non-stealth physical crit → knockback 1
    var _origTakeDamage = Character.prototype.takeDamage;
    Character.prototype.takeDamage = function (amount, damageType, flags) {
      // Snapshot aggroed state BEFORE damage (stealth detection happens inside)
      var wasAgroed = this.isAgroed;
      var result = _origTakeDamage.call(this, amount, damageType, flags);

      if (!window.STAT_REBALANCE_ENABLED || !flags) { return result; }
      if (!gs.pc || this === gs.pc || !this.isAlive) { return result; }
      if (flags.killer !== gs.pc) { return result; }

      // Electric crit → 50% aggro drop
      if (damageType === 'Shock' && flags.isCrit &&
          this.faction === FACTION.HOSTILE && Math.random() < 0.5) {
        tryDropAggro(this);
      }

      // Non-stealth physical crit → knockback 1
      // wasAgroed===true means the enemy already knew about the player (not surprised)
      if (flags.isCrit && wasAgroed && damageType === 'Physical') {
        this.body.applyKnockBack(
          gs.getNormal(gs.pc.tileIndex, this.tileIndex), 1
        );
      }

      return result;
    };

    // 5b. Stun → always drop aggro
    var _origStunnedOnCreate = gs.statusEffectTypes.Stunned.onCreate;
    gs.statusEffectTypes.Stunned.onCreate = function (character) {
      if (_origStunnedOnCreate) { _origStunnedOnCreate.call(this, character); }
      if (window.STAT_REBALANCE_ENABLED &&
          gs.pc && character !== gs.pc &&
          character.isAlive && character.faction === FACTION.HOSTILE) {
        tryDropAggro(character);
      }
    };

    // 5c. SmokeBomb landing area → drop aggro on all NPCs in radius 1.5
    var _origSmokeBomb = gs.projectileEffects.SmokeBomb;
    gs.projectileEffects.SmokeBomb = function (targetTile, projectile) {
      _origSmokeBomb.call(this, targetTile, projectile);
      if (!window.STAT_REBALANCE_ENABLED) { return; }
      gs.getIndexInRadius(targetTile.tileIndex, 1.5).forEach(function (idx) {
        var c = gs.getChar(idx);
        if (c && c !== gs.pc) { tryDropAggro(c); }
      });
    };

    // 5d. Shock SPELL → drop aggro on all NPCs in the initial flood list
    var _origShockUseOn = gs.abilityTypes.Shock.useOn;
    gs.abilityTypes.Shock.useOn = function (actingCharacter, targetTileIndex) {
      var pred = function (tileIndex) {
        return gs.getChar(tileIndex) && gs.getChar(tileIndex) !== gs.pc;
      };
      var indexList = gs.getIndexInFlood(targetTileIndex, pred, 3);
      var targets = [];
      indexList.forEach(function (tileIndex) {
        var c = gs.getChar(tileIndex);
        if (c && c.isAlive && c.faction === FACTION.HOSTILE) { targets.push(c); }
      });

      _origShockUseOn.call(this, actingCharacter, targetTileIndex);

      if (window.STAT_REBALANCE_ENABLED && actingCharacter === gs.pc) {
        targets.forEach(function (npc) {
          if (npc.isAlive) { tryDropAggro(npc); }
        });
      }
    };

    // 5e. Standing still → passive per-turn chance to drop aggro
    gs._playerMovedThisTurn = true;

    var _origStartTurn = gs.startTurn;
    gs.startTurn = function () {
      _origStartTurn.call(this);

      if (!window.STAT_REBALANCE_ENABLED) { return; }
      if (this.activeCharacter !== this.pc) { return; }

      if (!gs._playerMovedThisTurn) {
        gs.getAllNPCs().forEach(function (npc) {
          if (!npc.isAgroed || npc.faction !== FACTION.HOSTILE || !npc.isAlive) { return; }
          var detectPct = npc.detectPlayerPercent() * 100;
          if (detectPct > 0 && detectPct < 30) {
            var dropChance = (100 / 3 / detectPct) / 100;
            if (Math.random() < dropChance) { tryDropAggro(npc); }
          }
        });
      }

      gs._playerMovedThisTurn = false;
    };
  }

  // ── 6. Barbarian Shift+Dash ─────────────────────────────────────────────────
  function installDash() {
    gs.tryBarbarianDash = function (vector) {
      if (!window.STAT_REBALANCE_ENABLED)           { return false; }
      var pc = gs.pc;
      if (!pc || pc.characterClass !== 'Barbarian') { return false; }
      if (!gs.keys.shift.isDown)                    { return false; }
      if (!pc.isReadyForInput())                    { return false; }
      if (!((vector.x === 0 && Math.abs(vector.y) === 1) || (vector.y === 0 && Math.abs(vector.x) === 1))) {
        return false;
      }
      if (pc.rage < 2) { return false; }

      var tile1 = {x: pc.tileIndex.x + vector.x,       y: pc.tileIndex.y + vector.y};
      var tile2 = {x: pc.tileIndex.x + 2 * vector.x,   y: pc.tileIndex.y + 2 * vector.y};

      // Search weapon range from a tile for the nearest attackable enemy.
      function findTargetFrom(fromTile) {
        var weapon  = pc.inventory.getWeapon();
        var range   = pc.weaponRange(weapon);
        var minRange = pc.weaponMinRange(weapon);
        var r = Math.ceil(range);
        var best = null, bestDist = Infinity;
        for (var dx = -r; dx <= r; dx++) {
          for (var dy = -r; dy <= r; dy++) {
            var t = {x: fromTile.x + dx, y: fromTile.y + dy};
            if (!gs.isInBounds(t)) { continue; }
            var d = gs.distance(fromTile, t);
            if (d > range || d < minRange || d >= bestDist) { continue; }
            var c = gs.getChar(t);
            if (!c || !c.isAlive) { continue; }
            if (c.faction !== FACTION.HOSTILE && c.faction !== FACTION.DESTRUCTABLE) { continue; }
            if (!gs.isRayPassable(fromTile, t)) { continue; }
            best = t; bestDist = d;
          }
        }
        return best;
      }

      // Try tile1 first (must be free to land).
      if (gs.isInBounds(tile1) && gs.isPassable(tile1) && !gs.getChar(tile1)) {
        var target = findTargetFrom(tile1);
        if (target && pc.rage >= 3) {
          pc.rage -= 3;
          pc.teleportTo(tile1);
          pc.popUpText('Dash!', '#ff8800');
          pc.attack(target);
          return true;
        }

        // Try tile2 if tile1 had no target in range.
        if (!target && gs.isInBounds(tile2) && gs.isPassable(tile2) && !gs.getChar(tile2)) {
          target = findTargetFrom(tile2);
          if (target && pc.rage >= 3) {
            pc.rage -= 3;
            pc.teleportTo(tile2);
            pc.popUpText('Dash!', '#ff8800');
            pc.attack(target);
            return true;
          }

          // No target anywhere — no-attack 2-tile dash (costs 2 rage).
          if (pc.rage >= 2) {
            pc.rage -= 2;
            pc.teleportTo(tile2);
            gs.createParticlePoof(tile2, 'WHITE');
            pc.popUpText('Dash~', '#ff8800');
            pc.endTurn(pc.moveTime);
            return true;
          }
        }
      }

      // Conditions met but couldn't act — consume input as no-op.
      return true;
    };
  }

  // ── 7. Charge / Sprint level-based cooldowns ────────────────────────────────
  function patchCooldowns() {
    var CHARGE_CD = [0, 8, 4, 9];
    var SPRINT_CD = [0, 5, 10, 3];

    var _origChargeUseOn = gs.abilityTypes.Charge.useOn;
    gs.abilityTypes.Charge.useOn = function (actingCharacter, targetTileIndex) {
      _origChargeUseOn.call(this, actingCharacter, targetTileIndex);
      var lv = actingCharacter.getTalentLevel('Charge');
      gs.abilityTypes.Charge.coolDown = CHARGE_CD[lv] || CHARGE_CD[1];
    };

    var _origSprintUseOn = gs.abilityTypes.Sprint.useOn;
    gs.abilityTypes.Sprint.useOn = function (actingCharacter, targetTileIndex) {
      _origSprintUseOn.call(this, actingCharacter, targetTileIndex);
      var lv = actingCharacter.getTalentLevel('Sprint');
      gs.abilityTypes.Sprint.coolDown = SPRINT_CD[lv] || SPRINT_CD[1];
    };
  }

  // ── 8. PowerStrike stun ──────────────────────────────────────────────────────
  //   Duration = talent level (Lv1→1, Lv2→2, Lv3→3 turns).
  //   Saves target reference before knockback fires (knockback moves the char).
  function installPowerStrikeStun() {
    var _origPowerStrikeUseOn = gs.abilityTypes.PowerStrike.useOn;
    gs.abilityTypes.PowerStrike.useOn = function (actingChar, targetTileIndex) {
      var target = gs.getChar(targetTileIndex); // save before knockback may move it
      _origPowerStrikeUseOn.call(this, actingChar, targetTileIndex);
      if (window.STAT_REBALANCE_ENABLED && target && target.isAlive) {
        var lvl = actingChar.getTalentLevel('PowerStrike');
        if (lvl > 0) {
          target.statusEffects.add('Stunned', {duration: lvl + 1}); // +1 = game convention
        }
      }
    };
  }

  // ── 9. Berserk rework ────────────────────────────────────────────────────────
  //   onUpdateStats: force normal speed, set _berserkerMode flag.
  //   _berserkerMode is cleared at the top of PlayerCharacter.updateStats
  //   and set here only while Berserk is active.
  //   moveTo patch (section 2) uses _berserkerMode to treat 2H weapons as 1H.
  function installBerserkRework() {
    var _origBerserkUpdateStats = gs.statusEffectTypes.Berserk.onUpdateStats;
    gs.statusEffectTypes.Berserk.onUpdateStats = function (character) {
      _origBerserkUpdateStats.call(this, character); // preserves alwaysCrit & knockBackOnHit
      if (!window.STAT_REBALANCE_ENABLED) { return; }
      // Override any slow effects — Berserk forces at least NORMAL speed
      character.movementSpeed = Math.max(1, character.movementSpeed);
      character.moveTime      = MOVE_TIME[1]; // NORMAL (100ms)
      character._berserkerMode = true;
    };
  }

  // ── 10. Necromancer LifeSpike + NecroSummon ──────────────────────────────────
  function installNecromancer() {
    var NecroSummon = new StatusEffectType();
    NecroSummon.addDuration   = false;
    NecroSummon.dontPopUpText = true;
    NecroSummon.propertyList  = ['overhealBonus', 'poisonDamage'];
    NecroSummon.desc = 'Overheal buff. Will decay into poison when it expires.';

    NecroSummon.onUpdateStats = function (character) {
      character.maxHp += (this.overhealBonus || 0);
    };

    NecroSummon.onDestroy = function (character) {
      if (!character.isAlive) { return; }
      var bonus = this.overhealBonus || 0;
      if (bonus > 0) {
        character.currentHp = Math.max(1, character.currentHp - bonus);
      }
      character.statusEffects.add('StrongPoison', {
        damage:   this.poisonDamage || 3,
        duration: 30
      });
      if (character.popUpText) { character.popUpText('Decaying!', '#aa44ff'); }
    };

    gs.statusEffectTypes.NecroSummon = NecroSummon;

    gs.abilityTypes.LifeSpike.canUseOn = function (actingChar, targetTileIndex) {
      if (gs.abilityCanUseOn.SingleCharacterRay.call(this, actingChar, targetTileIndex)) {
        return true;
      }
      if (!window.STAT_REBALANCE_ENABLED) { return false; }
      var hasObj = gs.getObj(targetTileIndex, 'SkeletonCorpse') ||
                   gs.getObj(targetTileIndex, 'Bones');
      return !!hasObj
        && gs.isInBounds(targetTileIndex)
        && !gs.getChar(targetTileIndex)
        && gs.distance(actingChar.tileIndex, targetTileIndex) <= this.range(actingChar)
        && gs.isRayClear(actingChar.tileIndex, targetTileIndex);
    };

    gs.abilityTypes.LifeSpike.useOn = function (actingCharacter, targetTileIndex) {
      var damage   = this.attributes.damage.value(actingCharacter);
      var duration = this.attributes.duration.value(actingCharacter);

      if (window.STAT_REBALANCE_ENABLED) {
        var hpCost = Math.min(2, actingCharacter.currentHp - 1);
        if (hpCost > 0) {
          actingCharacter.takeDamage(hpCost, 'Physical', {neverCrit: true});
        }
      }

      var targetObj = gs.getObj(targetTileIndex, 'SkeletonCorpse') ||
                      gs.getObj(targetTileIndex, 'Bones');
      if (window.STAT_REBALANCE_ENABLED && !gs.getChar(targetTileIndex) && targetObj) {
        var boneCount = 0;
        gs.getIndexInRadius(targetTileIndex, 1.5).forEach(function (idx) {
          var bObj = gs.getObj(idx, 'Bones');
          if (bObj) { boneCount += 1; gs.destroyObject(bObj); }
        });

        var corpseObj = gs.getObj(targetTileIndex, 'SkeletonCorpse');
        var npcTypeName;
        if (corpseObj) {
          npcTypeName = corpseObj.npcTypeName || 'SkeletonWarrior';
          gs.destroyObject(corpseObj);
        } else {
          npcTypeName = (boneCount >= 4) ? 'SkeletonArcher' : 'SkeletonWarrior';
        }

        var npc = gs.createNPC(targetTileIndex, npcTypeName);
        npc.faction    = FACTION.PLAYER;
        npc.summonerID = actingCharacter.id;

        var overhealBonus = Math.max(4, Math.round(npc.maxHp * 0.25) + boneCount * 3);
        var poisonDamage  = Math.max(2, damage + Math.floor(boneCount / 2));

        npc.statusEffects.add('NecroSummon', {
          duration:      duration,
          overhealBonus: overhealBonus,
          poisonDamage:  poisonDamage
        });
        npc.updateStats();
        npc.currentHp = npc.maxHp;

        var lvText = boneCount > 0 ? ('Lv' + boneCount + ' risen!') : 'Risen!';
        npc.popUpText(lvText, '#aaffaa');
        gs.createParticlePoof(targetTileIndex, 'PURPLE');
        actingCharacter.body.faceTileIndex(targetTileIndex);
        actingCharacter.body.bounceTowards(targetTileIndex);
        gs.playSound(gs.sounds.throw, actingCharacter.tileIndex);
        return;
      }

      gs.createProjectile(actingCharacter, targetTileIndex, 'LifeSpike', damage,
        {killer: actingCharacter, duration: duration});
      actingCharacter.body.faceTileIndex(targetTileIndex);
      actingCharacter.body.bounceTowards(targetTileIndex);
      gs.createMagicShootEffect(actingCharacter, targetTileIndex, 'ToxicShoot');
      gs.playSound(gs.sounds.throw, actingCharacter.tileIndex);
    };
  }

  // ── Cold Attunement rework ────────────────────────────────────────────────────
  function installColdAttunement() {
    var COOL_DOWNS   = [null, 250, 150, 50];
    var DURATIONS    = [null, 10,  15,  20];

    gs.abilityTypes.ColdAttunement.useOn = function (actingCharacter) {
      if (!window.STAT_REBALANCE_ENABLED) {
        var coldPower = this.attributes.coldPower
          ? this.attributes.coldPower.value(actingCharacter)
          : 10;
        var dur = this.attributes.duration.value(actingCharacter);
        actingCharacter.statusEffects.add('ColdAttunement', {coldPower: coldPower, duration: dur});
        gs.createIceEffect(actingCharacter.tileIndex);
        gs.playSound(gs.sounds.cure, actingCharacter.tileIndex);
        return;
      }

      var lvl      = actingCharacter.getTalentLevel('ColdAttunement');
      var bonus    = actingCharacter.currentMp;
      var duration = DURATIONS[lvl] || 10;

      this.coolDown = COOL_DOWNS[lvl] || 250;

      actingCharacter.statusEffects.add('ColdAttunement', {manaBonus: bonus, duration: duration});

      gs.createIceEffect(actingCharacter.tileIndex);
      gs.playSound(gs.sounds.cure, actingCharacter.tileIndex);
      if (bonus > 0) {
        actingCharacter.popUpText('+' + bonus + ' Frost', '#aaddff');
      }
    };

    gs.statusEffectTypes.ColdAttunement.onUpdateStats = function (character) {
      if (!window.STAT_REBALANCE_ENABLED) {
        character.coldPower += (this.coldPower || 0);
        character.manaConservation.Cold += 1;
        return;
      }
      var bonus = this.manaBonus || 0;
      character.dexterity  += bonus;
      character.protection += bonus;
      character.coldPower  += bonus;
      character.isFlying   += 1;
    };

    gs.talents.ColdAttunement.desc =
      'Freezes your mana into power. Grants current-mana bonus to Dex/Protection/ColdPower + free levitation. ' +
      'Duration 10/15/20 turns. Cooldown 250/150/50.';
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  function patchGs() {
    if (typeof gs === 'undefined' ||
        !gs.tryBarbarianDash ||
        !gs.statusEffectTypes ||
        !gs.abilityTypes ||
        !gs.abilityTypes.LifeSpike) {
      setTimeout(patchGs, 300);
      return;
    }
    installDash();
    patchCooldowns();
    installPowerStrikeStun();
    installBerserkRework();
    installNecromancer();
    installAggroDrop();
    installColdAttunement();
  }

  patchGs();

}());
