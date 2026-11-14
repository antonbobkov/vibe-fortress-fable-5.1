// docs/03-content/items.md and weapons-and-armor.md -> items, weapons, ammo, armor, damageVsLayer, spells, enchants, draughts.

import { join } from 'node:path';
import {
  CONTENT_DIR,
  asObjects,
  byId,
  compact,
  fixed,
  findTable,
  glyph,
  id,
  int,
  isBlank,
  plain,
  ticked,
  readTables,
  words,
} from '../md-tables.mjs';

const MATERIAL_CLASSES = new Set([
  'stone', 'soil', 'ore', 'gem', 'metal', 'wood', 'plant', 'leather', 'cloth', 'bone', 'shell',
  'glass', 'ice', 'meat', 'liquid', 'obsidian',
]);

/** "metal, obsidian, bone (0.5)" -> ['metal','obsidian','bone']; "any" -> 'any'. */
function materials(cell) {
  if (isBlank(cell)) return 'any';
  const text = plain(cell).replace(/\([^)]*\)/g, ' ');
  if (/^as figurine$/i.test(text.trim())) return ['stone', 'bone', 'wood', 'metal', 'shell'];
  const found = [];
  for (const word of text.split(/[,;]| or /)) {
    const w = word.trim().split(/\s+/)[0]?.toLowerCase();
    if (w !== undefined && MATERIAL_CLASSES.has(w) && !found.includes(w)) found.push(w);
  }
  if (found.length === 0) return 'any';
  return found;
}

/** items.md § Meal ingredients. */
const INGREDIENT_CATEGORIES = [
  'food/meat/raw', 'food/fish/raw', 'food/plant/raw', 'food/egg', 'food/cheese',
  'food/plant/processed', 'food/fat', 'food/salt',
];

/** items.md § Food: "Flour and salt are not edible raw." */
const NOT_EDIBLE = new Set(['flour', 'salt']);

/** workshops-and-recipes.md: "3 craft (random of figurine, ring, amulet)". */
const CRAFT_ITEMS = new Set(['figurine', 'ring', 'amulet']);

/** buildings-and-furniture.md constructions accept "1 block, log, bar or raw stone". */
const BLOCK_ITEMS = new Set(['stone_block', 'wood_block']);

/** minerals-and-metals.md § Fuel: the two fuels carry the item tag fuel. */
const FUEL_ITEMS = new Set(['coal_bar', 'charcoal_bar']);

const ITEM_SECTIONS = [
  'Food', 'Drink', 'Seeds', 'Stone, ore, gems', 'Wood and bars',
  'Furniture (items that become buildings when placed)', 'Containers', 'Tools', 'Crafts and gems',
  'Textiles and animal parts', 'Clothing', 'Medical and herbs', 'Refuse',
];

function itemRow(row) {
  const iid = plain(row.id);
  const category = plain(row.category);
  const tags = [];
  if (INGREDIENT_CATEGORIES.includes(category)) tags.push('ingredient');
  if (CRAFT_ITEMS.has(iid)) tags.push('craft');
  if (BLOCK_ITEMS.has(iid)) tags.push('block');
  if (FUEL_ITEMS.has(iid)) tags.push('fuel');
  tags.push(...ticked(row.tags ?? ''));
  const notes = plain(row.notes ?? '');
  const capacityCell = row.capacity ?? '';
  let capacity = isBlank(capacityCell) ? undefined : int(capacityCell);
  const alsoContainer = /also a container \((\d+)\)/.exec(notes);
  if (alsoContainer !== null) capacity = Number(alsoContainer[1]);
  const holdsUpTo = /holds up to (\d+)/.exec(notes);
  if (holdsUpTo !== null) capacity = Number(holdsUpTo[1]);
  const containerClass =
    category.startsWith('container/') ? category.slice('container/'.length)
      : iid === 'chest' ? 'chest'
        : undefined;

  return compact({
    id: iid,
    name: plain(row.name),
    category,
    mult: fixed(row.mult, 1000),
    stack: isBlank(row.stack) ? 1 : int(row.stack, 1),
    container: isBlank(row.container) ? 'none' : plain(row.container),
    rotDays: isBlank(row.rotDays) ? 0 : int(row.rotDays),
    // D-009: rows without a weight column take the "no penalty" class.
    weight: isBlank(row.weight) ? 'light' : (plain(row.weight).split(' ')[0] ?? 'light'),
    materials: materials(row.materials ?? row['materials allowed']),
    glyph: glyph(row.glyph),
    fg: plain(row.fg) === 'material' ? undefined : id(row.fg),
    edible: category.startsWith('food/') && !NOT_EDIBLE.has(iid) ? true : undefined,
    drinkable: category === 'drink' ? true : undefined,
    quality: false, // set from the recipes that produce it
    slot: isBlank(row.slot) ? undefined : plain(row.slot).split(' ')[0],
    capacity,
    containerClass,
    tags: tags.length > 0 ? tags : undefined,
  });
}

export function exportItems() {
  const tables = readTables(join(CONTENT_DIR, 'items.md'));
  const out = [];
  for (const section of ITEM_SECTIONS) {
    for (const row of asObjects(findTable(tables, section, 'category'))) out.push(itemRow(row));
  }
  for (const w of exportWeapons()) out.push(weaponItemType(w));
  for (const a of exportAmmo()) out.push(ammoItemType(a));
  for (const a of exportArmor()) out.push(armorItemType(a));

  // items.md § Tools already defines `pick` and `axe`; weapons-and-armor.md restates them as
  // weapons. Keep one item type per id, the first (items.md) definition winning. See D-010.
  const byKey = new Map();
  for (const item of out) {
    if (!byKey.has(item.id)) byKey.set(item.id, item);
  }
  return byId(Array.from(byKey.values()));
}

function weaponItemType(w) {
  // weapons-and-armor.md § Channels: a launcher with no ammunition is a channel, quality-bearing,
  // with its own glyph and color and no `weapon` tag.
  const channel = w.launcher !== undefined && w.launcher.ammo === undefined;
  const look = CHANNEL_LOOK.get(w.id);
  return compact({
    id: w.id,
    name: w.name,
    category: w.launcher === undefined ? `weapon/${w.weaponClass}` : `weapon/ranged`,
    mult: w.mult,
    stack: 1,
    container: 'none',
    rotDays: 0,
    weight: 'medium',
    materials: w.materials,
    glyph: look?.glyph ?? (w.launcher === undefined ? '/' : ')'),
    fg: look?.fg,
    quality: channel,
    slot: 'weapon',
    tags: channel ? undefined : ['weapon'],
  });
}

/** weapons-and-armor.md § Channels: each channel's glyph and color, by id. */
const CHANNEL_LOOK = new Map();

function ammoItemType(a) {
  return compact({
    id: a.id,
    name: a.name,
    category: `ammo/${a.id}`,
    mult: a.mult,
    stack: a.stack,
    container: 'bin',
    rotDays: 0,
    weight: 'light',
    materials: a.materials,
    glyph: '↑',
    quality: false,
    slot: 'quiver',
    tags: ['ammo'],
  });
}

function armorItemType(a) {
  return compact({
    id: a.id,
    name: a.name,
    category: `armor/${a.armorSlot}`,
    mult: a.mult,
    stack: 1,
    container: 'bin',
    rotDays: 0,
    weight: 'medium',
    materials: a.materials,
    glyph: a.armorSlot === 'shield' ? ')' : '[',
    quality: false,
    slot: a.armorSlot,
    tags: ['armor'],
  });
}

/** "1 (+1 log)" -> { bars: 1, logs: 1 }; "1 log" -> { bars: 0, logs: 1 }. */
function barsAndLogs(cell) {
  const s = plain(cell);
  if (isBlank(s)) return { bars: 0 };
  const logs = /(\d+)\s*log/.exec(s);
  const lead = /^\(?\+?(\d+)/.exec(s);
  const leadIsLog = /^\(?\+?\d+\s*log/.test(s);
  return compact({
    bars: leadIsLog ? 0 : lead === null ? 0 : Number(lead[1]),
    logs: logs === null ? undefined : Number(logs[1]),
  });
}

export function exportWeapons() {
  const tables = readTables(join(CONTENT_DIR, 'weapons-and-armor.md'));
  const melee = asObjects(findTable(tables, 'Melee', 'hands')).map((row) => {
    const rawId = plain(row.id);
    // weapons-and-armor.md: "the same item as the woodcutting `axe`; `axe` in items.md is this".
    const isBattleAxe = rawId === 'battle_axe';
    const damageType = isBlank(row.type) ? null : plain(row.type);
    return compact({
      id: isBattleAxe ? 'axe' : rawId,
      name: plain(row.name),
      weaponClass: plain(row.class),
      skill: id(row.skill),
      damageType,
      damage: int(row.damage),
      size: int(row.size),
      hands: int(row.hands, 1),
      ...barsAndLogs(row.bars),
      mult: fixed(row.mult, 1000),
      materials: materials(row.materials),
      training: /^training_/.test(rawId) ? true : undefined,
      tags: isBattleAxe ? ['battle_axe'] : undefined,
    });
  });
  const launchers = asObjects(findTable(tables, 'Launchers', 'ammo')).map((row) => {
    const notes = plain(row.notes);
    const metalPower = /metal crossbows: power ([\d.]+)/.exec(notes);
    const yewPower = /yew: power ([\d.]+)/.exec(notes);
    return compact({
      id: plain(row.id),
      name: plain(row.name),
      weaponClass: plain(row.class),
      skill: id(row.skill),
      damageType: null,
      damage: 0,
      size: int(row.size),
      hands: int(row.hands, 1),
      ...barsAndLogs(row.materials),
      mult: fixed(row.mult, 1000),
      materials: materials(row.materials),
      launcher: compact({
        range: int(row.range),
        power: fixed(row.power, 1000),
        ammo: id(row.ammo),
        metalPower: metalPower === null ? undefined : Math.round(Number(metalPower[1]) * 1000),
        yewPower: yewPower === null ? undefined : Math.round(Number(yewPower[1]) * 1000),
      }),
    });
  });
  const channels = asObjects(findTable(tables, 'Channels', 'logs')).map((row) => {
    CHANNEL_LOOK.set(plain(row.id), { glyph: glyph(row.glyph), fg: id(row.fg) });
    return compact({
      id: plain(row.id),
      name: plain(row.name),
      weaponClass: plain(row.class),
      skill: id(row.skill),
      damageType: null,
      damage: 0,
      size: int(row.size),
      hands: int(row.hands, 1),
      bars: int(row.bars),
      logs: isBlank(row.logs) || int(row.logs) === 0 ? undefined : int(row.logs),
      mult: fixed(row.mult, 1000),
      materials: materials(row.materials),
      launcher: { range: int(row.range), power: fixed(row.power, 1000) },
    });
  });
  return byId([...melee, ...launchers, ...channels]);
}

/** weapons-and-armor.md § Spells. */
export function exportSpells() {
  const tables = readTables(join(CONTENT_DIR, 'weapons-and-armor.md'));
  const cell = (c) => (isBlank(c) || plain(c) === '—' ? undefined : c);
  return byId(
    asObjects(findTable(tables, 'Spells', 'kind')).map((row) => compact({
      id: id(row.id),
      name: plain(row.name),
      stone: id(row.stone),
      kind: plain(row.kind),
      cost: int(row.cost),
      range: cell(row.range) === undefined ? undefined : int(row.range),
      base: cell(row.base) === undefined ? undefined : int(row.base),
      type: cell(row.type) === undefined ? undefined : plain(row.type),
      ticks: cell(row.ticks) === undefined ? undefined : int(row.ticks),
      suffix: plain(row.suffix),
      summon: cell(row.summon) === undefined ? undefined : id(row.summon),
    })),
  );
}

/**
 * items.md § Draughts: what a draught does when drunk (25 § Draughts). "`mend`, `heal_rate` 200"
 * -> [{ kind: 'mend', value: 1 }, { kind: 'heal_rate', value: 200 }]; "—" -> [].
 */
export function exportDraughts() {
  const tables = readTables(join(CONTENT_DIR, 'items.md'));
  return byId(
    asObjects(findTable(tables, 'Draughts', 'trigger')).map((row) => ({
      id: id(row.id),
      effects: Array.from(String(row.effects ?? '').matchAll(/`([a-z_]+)`\s*(\d+)?/g), (m) => ({ kind: m[1], value: m[2] === undefined ? 1 : Number(m[2]) })),
      trigger: id(row.trigger),
    })),
  );
}

export function exportAmmo() {
  const tables = readTables(join(CONTENT_DIR, 'weapons-and-armor.md'));
  return byId(
    asObjects(findTable(tables, 'Ammunition', 'per craft')).map((row) => {
      const craft = plain(row['per craft']);
      const per = (what) => {
        const m = new RegExp(`(\\d+)\\s*per\\s*${what}`).exec(craft);
        return m === null ? 0 : Number(m[1]);
      };
      return compact({
        id: plain(row.id),
        name: plain(row.name),
        damageType: plain(row.type),
        damage: int(row.damage),
        stack: int(row.stack, 1),
        perBar: per('bar'),
        perLog: per('log'),
        perBone: per('bone'),
        mult: fixed(row.mult, 1000),
        materials: materials(row.materials),
      });
    }),
  );
}

const SLOT_EXPANSION = {
  head: ['head'],
  torso: ['torso'],
  arms: ['left_arm', 'right_arm'],
  legs: ['left_leg', 'right_leg'],
};

/** "torso 100, arms 40" -> [{ part, coverage }] with arms and legs expanded to both sides. */
export function parseCovers(cell) {
  if (isBlank(cell)) return [];
  const out = [];
  for (const part of plain(cell).split(',')) {
    const m = /([a-z_]+)\s+(\d+)/.exec(part.trim());
    if (m === null) continue;
    const parts = SLOT_EXPANSION[m[1]] ?? [m[1]];
    for (const p of parts) out.push({ part: p, coverage: Number(m[2]) });
  }
  return out;
}

export function exportArmor() {
  const tables = readTables(join(CONTENT_DIR, 'weapons-and-armor.md'));
  return byId(
    asObjects(findTable(tables, 'Armor', 'covers')).map((row) => {
      const barsCell = plain(row.bars);
      const leather = /(\d+)\s*leather/.exec(barsCell);
      const cloth = /(\d+)\s*cloth/.exec(barsCell);
      const plainBars = /^(\d+)(\s|$)/.exec(barsCell);
      const alt = /or\s*(\d+)\s*bars?/.exec(barsCell);
      return compact({
        id: plain(row.id),
        name: plain(row.name),
        armorSlot: plain(row.slot),
        covers: parseCovers(row.covers),
        layer: isBlank(row.layer) ? 'none' : plain(row.layer),
        armor: /block only/i.test(plain(row.armor)) ? 0 : int(row.armor),
        weight: int(row.weight),
        bars:
          leather !== null || cloth !== null
            ? undefined
            : alt !== null
              ? Number(alt[1])
              : plainBars !== null
                ? Number(plainBars[1])
                : /bar/.test(barsCell)
                  ? 1
                  : undefined,
        leather: leather === null ? undefined : Number(leather[1]),
        cloth: cloth === null ? undefined : Number(cloth[1]),
        mult: fixed(row.mult, 1000),
        materials: materials(row.materials),
        rune: runeProperty(row.rune),
      });
    }),
  );
}

/** weapons-and-armor.md § Armor `rune`: "regen ×1.5" -> { regenPercent: 150 }; "max +10" -> { maxBonus: 10 }. */
function runeProperty(cell) {
  if (isBlank(cell)) return undefined;
  const text = plain(cell);
  const regen = /regen\s*[×x]\s*([\d.]+)/.exec(text);
  const max = /max\s*\+\s*(\d+)/.exec(text);
  if (regen === null && max === null) throw new Error(`weapons-and-armor.md: unreadable rune property "${text}"`);
  return compact({
    regenPercent: regen === null ? undefined : Math.round(Number(regen[1]) * 100),
    maxBonus: max === null ? undefined : Number(max[1]),
  });
}

const ENCHANT_SLOTS = new Set(['weapon', 'armor', 'ammo']);
const ENCHANT_SCALES = new Set(['value', 'ticks', 'none']);

/**
 * weapons-and-armor.md § Enchantments `effects`: "`slow` 30 for 200 ticks; `flee` 1, 25% for 200 ticks"
 * -> [{ kind, value, type?, chance?, ticks?, scales }].
 */
function enchantEffects(cell, scales) {
  const out = [];
  for (const part of String(cell ?? '').split(';')) {
    const text = part.trim();
    if (text.length === 0) continue;
    const m = /^`([a-z_]+)`\s+([+−-]?\d+)(?:\s+([a-z]+))?(?:,\s*(\d+)%)?(?:\s+for\s+(\d+)\s+ticks)?$/.exec(text);
    if (m === null) throw new Error(`weapons-and-armor.md: unreadable enchantment effect "${text}"`);
    out.push(compact({
      kind: m[1],
      value: Number(m[2].replace('−', '-')),
      type: m[3],
      chance: m[4] === undefined ? undefined : Number(m[4]),
      ticks: m[5] === undefined ? undefined : Number(m[5]),
      scales,
    }));
  }
  return out;
}

/** weapons-and-armor.md § Enchantments. */
export function exportEnchants() {
  const tables = readTables(join(CONTENT_DIR, 'weapons-and-armor.md'));
  return byId(
    asObjects(findTable(tables, 'Enchantments', 'vials')).map((row) => {
      const slot = plain(row.slot);
      const scales = plain(row.scales);
      if (!ENCHANT_SLOTS.has(slot)) throw new Error(`weapons-and-armor.md: enchantment slot "${slot}"`);
      if (!ENCHANT_SCALES.has(scales)) throw new Error(`weapons-and-armor.md: enchantment scales "${scales}"`);
      return compact({
        id: id(row.id),
        slot,
        stone: id(row.stone),
        vials: int(row.vials),
        suffix: plain(row.suffix),
        effects: enchantEffects(row.effects, scales),
        only: isBlank(row.only) ? undefined : plain(row.only),
      });
    }),
  );
}

export function exportDamageVsLayer() {
  const tables = readTables(join(CONTENT_DIR, 'weapons-and-armor.md'));
  const table = findTable(tables, 'Damage type versus layer', 'padding');
  return asObjects(table).map((row) => ({
    type: plain(row['Type \\ Layer']),
    padding: fixed(row.padding),
    leather: fixed(row.leather),
    mail: fixed(row.mail),
    plate: fixed(row.plate),
    ward: fixed(row.ward),
  }));
}

export { words };
