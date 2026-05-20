// game-balance.js
// ════════════════════════════════════════════════════════════════════════════
// Single source of truth for all class balance.
// Loaded after main.js, before all other custom scripts.
//
// HOW TO USE:
//   Edit window.GB.classes[ClassName] to change anything about a class.
//   Changes take effect on the next new game (no page reload needed).
//
// TOGGLE DEPENDENCY:
//   HP/MP/attributes/resistances/special → only active when STAT_REBALANCE_ENABLED = true
//   Gear/talents                         → default always; mod version when STARTING_GEAR_ENABLED = true
// ════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  // CLASS DEFINITIONS
  // ══════════════════════════════════════════════════════════════════════════

  window.GB = {
    classes: {

      // ─── WARRIOR ────────────────────────────────────────────────────────
      Warrior: {
        // Pre-game modal display
        name: 'WARRIOR', role: 'Melee Tank',
        desc: 'A heavily armored brawler. Excels in close combat with shield and sword. Gains extra protection and fire resistance.',
        mpDisplay: 'None',

        // HP / MP  (STAT_REBALANCE_ENABLED)
        hp: 5,  hpPer: 5,     // base HP at lv1; HP gained per level
        mp: 3,  mpPer: 0.33,  // base MP at lv1; MP gained per level

        // Attributes & resistances  (STAT_REBALANCE_ENABLED)
        str: 12, dex: 10, int: 11,
        prot: 5,
        res: { Fire: 1, Shock: -1 },
        scalingProp: 'meleePower',   // gets +(level-1) each level

        // Special  (STAT_REBALANCE_ENABLED)
        hpRegen: 2,   // default for most classes is 1

        // Starting gear  ─ string = item type name; {item,amount} = stack; {equip,item} = slot
        defaultGear: ['ShortSword', {item:'Dart',amount:10}, {equip:'shield',item:'WoodenShield'}],
        modGear: null,    // null → use defaultGear even when STARTING_GEAR_ENABLED

        // Pre-game modal gear text (display only, independent from above)
        defaultGearDisplay: ['Short Sword', '10× Dart', 'Wooden Shield', '[SKILL] Shields Up'],
        modGearDisplay: null,

        // Starting talent + talent pool
        defaultTalent: 'ShieldsUp',
        defaultTalentPool: ['ShieldsUp','PowerStrike','Fortitude','WeaponMastery','ShieldWall','Deflect','Charge'],
        modTalent: null,       // null → use defaultTalent
        modTalentPool: null,   // null → use defaultTalentPool
      },

      // ─── BARBARIAN ──────────────────────────────────────────────────────
      Barbarian: {
        name: 'BARBARIAN', role: 'Rage Brawler',
        desc: 'Hold Shift + direction to dash up to 2 tiles and strike (costs 3 Rage). Auto-berserks at max rage. Highest HP, cold resistant, vulnerable to poison.',
        mpDisplay: 'None',

        hp: 22, hpPer: 1,
        mp: 3,  mpPer: 0,   // Barbarian mp is always forced to 0 by the engine

        str: 14, dex: 10, int: 10,
        prot: 0,
        res: { Cold: 3, Toxic: -1 },
        scalingProp: 'rangePower',

        hpRegen: 4,
        size: 'LARGE',       // CHARACTER_SIZE.LARGE
        movementSpeed: 0,    // SLOW (boots/Berserk still override in class-mechanics.js)
        maxFood: 30,

        defaultGear: ['HandAxe', {item:'Dart',amount:10}],
        modGear: ['Spear', {item:'ThrowingNet',amount:4}],

        defaultGearDisplay: ['Hand Axe', '10× Dart', '[SKILL] Power Strike'],
        modGearDisplay: ['Spear', '4× Throwing Net', '[SKILL] Power Strike'],

        defaultTalent: 'PowerStrike',
        defaultTalentPool: ['PowerStrike','Sprint','BloodLust','WeaponMastery','StrafeAttack'],
        modTalent: 'Charge',
        modTalentPool: ['Charge','PowerStrike','Sprint','BloodLust','WeaponMastery','StrafeAttack'],
      },

      // ─── RANGER ─────────────────────────────────────────────────────────
      Ranger: {
        name: 'RANGER', role: 'Ranged Specialist',
        desc: 'A skilled archer who deals critical hits at maximum range. Good protection, toxic resistance.',
        mpDisplay: 'Low',

        hp: 15, hpPer: 1,
        mp: 3,  mpPer: 0,

        str: 11, dex: 11, int: 11,
        prot: 3,
        res: { Cold: -2, Toxic: 2 },
        scalingProp: 'intelligence',  // +1 int per level

        size: 'SMALL',
        maxFood: 10,

        defaultGear: ['ShortBow', 'BootsOfSpeed'],
        modGear: null,

        defaultGearDisplay: ['Short Bow', 'Boots of Speed', '[SKILL] Power Shot'],
        modGearDisplay: null,

        defaultTalent: 'PowerShot',
        defaultTalentPool: ['PowerShot','Sprint','Evasive','RangeMastery','TunnelShot','PerfectAim','StrafeAttack'],
        modTalent: null,
        modTalentPool: null,
      },

      // ─── ROGUE ──────────────────────────────────────────────────────────
      Rogue: {
        name: 'ROGUE', role: 'Stealth Operative',
        desc: 'A cunning operative skilled in stealth and utility. Extra shock resistance. Crits from the shadows.',
        mpDisplay: '1 (flat)',

        hp: 25, hpPer: 0,
        mp: 1,  mpPer: 0,

        str: 8, dex: 14, int: 10,
        prot: 0,
        res: { Shock: 1 },
        scalingProp: 'protection',   // +1 protection per level

        defaultGear: ['PoisonDagger'],
        modGear: ['Mace'],

        defaultGearDisplay: ['Poison Dagger', '[SKILL] Sleeping Dart'],
        modGearDisplay: ['Mace', '[SKILL] Smoke Bomb'],

        defaultTalent: 'SleepingDart',
        defaultTalentPool: ['SleepingDart','Sprint','Evasive','StealthMastery','DungeonSense','NimbleFingers','SmokeBomb'],
        modTalent: 'SmokeBomb',
        modTalentPool: ['SmokeBomb','Sprint','Evasive','StealthMastery','DungeonSense','NimbleFingers','SleepingDart'],
      },

      // ─── FIRE MAGE ──────────────────────────────────────────────────────
      FireMage: {
        name: 'FIRE MAGE', role: 'Pyromancer',
        desc: 'Commands the power of fire. High damage AOE spells. Immune to fire, fragile in melee.',
        mpDisplay: 'High',

        hp: 18, hpPer: 2,
        mp: 3,  mpPer: 0.75,

        str: 12, dex: 10, int: 12,
        prot: 0,
        res: {},
        scalingProp: 'stealth',   // +1 stealth per level

        defaultGear: ['StaffOfFire'],
        modGear: null,

        defaultGearDisplay: ['Staff of Fire', 'Potion of Energy', '[SKILL] Fireball'],
        modGearDisplay: null,

        defaultTalent: 'FireBall',
        defaultTalentPool: ['FireBall','FireAttunement','FireMastery','Focus','BurstOfFlame','FlamingHands','FireBolt'],
        modTalent: null,
        modTalentPool: null,
      },

      // ─── ICE MAGE ───────────────────────────────────────────────────────
      IceMage: {
        name: 'ICE MAGE', role: 'Cryomancer',
        desc: 'Wields ice and cold magic. Slows and freezes enemies solid. Strong crowd control.',
        mpDisplay: 'High',

        hp: 23, hpPer: 1,
        mp: 3,  mpPer: 0.5,

        str: 10, dex: 6, int: 13,
        prot: 0,
        res: {},
        scalingProp: 'spellPower',  // +1 spellPower per level

        defaultGear: ['StaffOfIce'],
        modGear: null,

        defaultGearDisplay: ['Staff of Ice', 'Potion of Energy', '[SKILL] Cone of Cold'],
        modGearDisplay: null,

        defaultTalent: 'ConeOfCold',
        defaultTalentPool: ['ConeOfCold','ColdAttunement','ColdMastery','Focus','FreezingCloud','Freeze','IceArmor'],
        modTalent: null,
        modTalentPool: null,
      },

      // ─── STORM MAGE ─────────────────────────────────────────────────────
      StormMage: {
        name: 'STORM MAGE', role: 'Stormcaller',
        desc: 'Commands lightning and thunder. Chain lightning and area shocks make short work of groups.',
        mpDisplay: 'High',

        hp: 23, hpPer: 1,
        // NOTE: mpPer must stay 0 here — main.js adds a SEPARATE +1/level block
        // for StormMage (line 26467). Effective mpPer is 1. Change that block in main.js
        // if you want to adjust it, then set mpPer accordingly.
        mp: 3,  mpPer: 0,

        str: 10, dex: 10, int: 14,
        prot: 0,
        res: {},
        // no scalingProp

        defaultGear: ['StaffOfStorms'],
        modGear: null,

        defaultGearDisplay: ['Staff of Storms', 'Potion of Energy', '[SKILL] Lightning Bolt'],
        modGearDisplay: null,

        defaultTalent: 'LightningBolt',
        defaultTalentPool: ['LightningBolt','StormAttunement','StormMastery','Focus','ThunderClap','Shock','Levitation'],
        modTalent: null,
        modTalentPool: null,
      },

      // ─── NECROMANCER ────────────────────────────────────────────────────
      Necromancer: {
        name: 'NECROMANCER', role: 'Undead Master',
        desc: 'Life Spike can target skeleton corpses — revives them as friendly allies with HP regen and 100-turn poison. No HP regen, immune to hunger damage. Vulnerable to fire.',
        mpDisplay: 'High',

        hp: 23, hpPer: 1,
        mp: 3,  mpPer: 0.5,

        // str starts at 5 and gains +1 per level (scalingProp below)
        str: 5, dex: 10, int: 15,
        prot: 0,
        res: { Fire: -3 },
        scalingProp: 'strength',   // +1 strength per level (str = 5 + lv-1)

        hpRegen: 0,   // Necromancer has no HP regen

        defaultGear: ['StaffOfPoison'],
        modGear: null,

        defaultGearDisplay: ['Staff of Poison', 'Potion of Energy', '[SKILL] Life Spike'],
        modGearDisplay: null,

        defaultTalent: 'LifeSpike',
        defaultTalentPool: ['LifeSpike','ToxicAttunement','ToxicMastery','Focus','InfectiousDisease','SummonSkeleton','Cannibalise'],
        modTalent: null,
        modTalentPool: null,
      },

      // ─── ENCHANTER ──────────────────────────────────────────────────────
      Enchanter: {
        name: 'ENCHANTER', role: 'Mind Controller',
        desc: 'Confuses and charms enemies, turning their allies against them. Slightly weaker to all elements.',
        mpDisplay: 'High',

        hp: 23, hpPer: 1,
        mp: 3,  mpPer: 0.5,

        str: 9, dex: 9, int: 9,
        prot: 0,
        res: { Fire: -1, Cold: -1, Shock: -1, Toxic: -1 },
        // no scalingProp

        defaultGear: ['StaffOfMagicMissiles'],
        modGear: null,

        defaultGearDisplay: ['Staff of Magic Missiles', 'Potion of Energy', '[SKILL] Confusion'],
        modGearDisplay: null,

        defaultTalent: 'Confusion',
        defaultTalentPool: ['Confusion','Fear','MagicMastery','Focus','Charm','Mesmerize','Swiftness'],
        modTalent: null,
        modTalentPool: null,
      },

    }, // end GB.classes
  };  // end GB


  // ══════════════════════════════════════════════════════════════════════════
  // PATCH 1 — HP/MP stats + special class properties
  //
  // Wraps PlayerCharacter.prototype.updateStats.
  // Computes the delta between main.js hardcoded values and GB values,
  // applies the difference AFTER all other bonuses (equipment, skills, etc.)
  // have already been added by the original.
  //
  // Also overrides hpRegen, size, movementSpeed, maxFood from GB.special.
  // ══════════════════════════════════════════════════════════════════════════
  if (typeof PlayerCharacter !== 'undefined') {

    // DO NOT CHANGE these 4 objects — they mirror main.js playerUpdateStats
    // lines 26434-26437. Update GB.classes instead.
    var _ORIG_H  = {Warrior:5,  Barbarian:22, Ranger:15, Rogue:25, FireMage:18, StormMage:23, IceMage:23, Necromancer:23, Enchanter:23};
    var _ORIG_HL = {Warrior:5,  Barbarian:1,  Ranger:1,  Rogue:0,  FireMage:2,  StormMage:1,  IceMage:1,  Necromancer:1,  Enchanter:1};
    var _ORIG_MI = {Rogue:1};           // others fall through to PLAYER_INITIAL_MP = 3
    var _ORIG_ML = {Warrior:0.33, Barbarian:0, Ranger:0, Rogue:0, FireMage:0.75, StormMage:0, IceMage:0.5, Necromancer:0.5, Enchanter:0.5};
    // StormMage extra: main.js line 26467 adds (level-1) on top of _ORIG_ML
    var _STORM_EXTRA_MP_PER = 1;

    var _origPCStats = PlayerCharacter.prototype.updateStats;
    PlayerCharacter.prototype.updateStats = function () {
      _origPCStats.call(this);

      var cls = this.characterClass;
      var c = GB.classes[cls];
      if (!c || !window.STAT_REBALANCE_ENABLED) { return; }

      var lv = this.level;

      // ── Delta correction for HP ────────────────────────────────────────
      var origHpBase = (_ORIG_H[cls]  !== undefined ? _ORIG_H[cls]  : PLAYER_INITIAL_HP[cls])
                     + (lv - 1) * (_ORIG_HL[cls] !== undefined ? _ORIG_HL[cls] : PLAYER_HP_PER_LEVEL[cls]);
      var gbHpBase   = c.hp + (lv - 1) * c.hpPer;
      if (gbHpBase !== origHpBase) {
        this.maxHp = Math.round(this.maxHp + (gbHpBase - origHpBase));
      }

      // ── Delta correction for MP ────────────────────────────────────────
      var origMpBase = (_ORIG_MI[cls] !== undefined ? _ORIG_MI[cls] : PLAYER_INITIAL_MP[cls])
                     + (lv - 1) * (_ORIG_ML[cls] !== undefined ? _ORIG_ML[cls] : 0);
      if (cls === 'StormMage') { origMpBase += (lv - 1) * _STORM_EXTRA_MP_PER; }
      var gbMpBase   = c.mp + (lv - 1) * c.mpPer;
      if (cls === 'StormMage') { gbMpBase += (lv - 1) * _STORM_EXTRA_MP_PER; } // keep engine's StormMage extra
      if (gbMpBase !== origMpBase) {
        this.maxMp = Math.round(this.maxMp + (gbMpBase - origMpBase));
      }

      // ── Special property overrides ─────────────────────────────────────
      if (c.hpRegen      !== undefined) { this.hpRegenAmount = c.hpRegen; }
      if (c.size         !== undefined) { this.size = CHARACTER_SIZE[c.size]; }
      if (c.maxFood      !== undefined) { this.maxFood = c.maxFood; }
      if (c.movementSpeed !== undefined) {
        this.movementSpeed = c.movementSpeed;
        this.moveTime      = MOVE_TIME[c.movementSpeed];
      }
    };
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PATCH 2 — Class attributes & resistances
  //
  // Wraps gs.createPlayerClasses (called during gs.initialize).
  // After the original runs, replaces each gs.classEffects[cls] with a
  // version that reads str/dex/int/prot/res/scalingProp from GB.
  // ══════════════════════════════════════════════════════════════════════════
  if (typeof gs !== 'undefined' && typeof gs.createPlayerClasses === 'function') {

    var _origCreatePC = gs.createPlayerClasses;
    gs.createPlayerClasses = function () {
      _origCreatePC.call(this);

      var self = this;
      Object.keys(GB.classes).forEach(function (cls) {
        if (!self.classEffects || !self.classEffects[cls]) { return; }

        var _origEffect = self.classEffects[cls];
        var c = GB.classes[cls];

        self.classEffects[cls] = function (character) {
          // Run the vanilla (non-SR) part only: str/dex/int+=3, hasRage, etc.
          var savedSR = window.STAT_REBALANCE_ENABLED;
          window.STAT_REBALANCE_ENABLED = false;
          _origEffect.call(self, character);
          window.STAT_REBALANCE_ENABLED = savedSR;

          if (!savedSR) { return; }

          // Apply GB attributes (override vanilla += with explicit values)
          character.strength     = c.str;
          character.dexterity    = c.dex;
          character.intelligence = c.int;

          // Apply GB protection bonus
          if (c.prot) { character.protection += c.prot; }

          // Apply GB resistances
          var r = c.res || {};
          Object.keys(r).forEach(function (el) {
            character.resistance[el] += r[el];
          });

          // Apply per-level scaling stat
          if (c.scalingProp) {
            character[c.scalingProp] += (character.level - 1);
          }
        };
      });
    };
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PATCH 3 — Starting gear & talents
  //
  // Replaces PlayerCharacter.prototype.setClass entirely.
  // Reads gear and talents from GB.classes instead of main.js hardcoded blocks.
  // Food (Meat / PotionOfEnergy) logic is kept identical to vanilla.
  // ══════════════════════════════════════════════════════════════════════════
  if (typeof PlayerCharacter !== 'undefined') {

    PlayerCharacter.prototype.setClass = function (className) {
      var c = GB.classes[className];
      if (!c) { throw 'game-balance.js setClass: unknown class "' + className + '"'; }

      this.characterClass = className;

      // ── Food (identical to vanilla) ────────────────────────────────────
      if (this.race.name !== 'Mummy') {
        this.inventory.addItem(Item.createItem('Meat'));
        if (gs.inArray(className, ['Necromancer','Enchanter','FireMage','IceMage','StormMage'])) {
          this.inventory.addItem(Item.createItem('PotionOfEnergy'));
        }
      }

      // ── Gear ──────────────────────────────────────────────────────────
      var useMod    = window.STARTING_GEAR_ENABLED && c.modGear;
      var gearList  = useMod ? c.modGear : c.defaultGear;
      var character = this;

      gearList.forEach(function (entry) {
        if (typeof entry === 'string') {
          character.inventory.addItem(Item.createItem(entry));
        } else if (entry.equip) {
          character.inventory.equipmentSlot(entry.equip).addItem(Item.createItem(entry.item));
        } else {
          character.inventory.addItem(Item.createItem(entry.item, {amount: entry.amount}));
        }
      });

      // ── Talents ────────────────────────────────────────────────────────
      var useModTalent = window.STARTING_GEAR_ENABLED && c.modTalent;
      var firstTalent  = useModTalent ? c.modTalent   : c.defaultTalent;
      var talentPool   = (window.STARTING_GEAR_ENABLED && c.modTalentPool) ? c.modTalentPool : c.defaultTalentPool;

      this.learnTalent(firstTalent);
      this.addAvailableTalents(talentPool);

      // ── Finalize (identical to vanilla) ───────────────────────────────
      this.inventory.lastWeaponIndex = 1;
      this.inventory.weaponIndex     = 0;

      this.updateStats();
      this.talentPoints = 0;
      this.currentHp    = this.maxHp;
      this.currentMp    = this.maxMp;
      this.sprite.frame = PLAYER_FRAMES[className];
      this.type.frame   = PLAYER_FRAMES[className];
    };
  }

}());
