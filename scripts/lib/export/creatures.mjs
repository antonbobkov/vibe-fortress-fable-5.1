// docs/03-content/creatures.md -> bodyPlans, creatures.

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
  range,
  readTables,
  seasons,
  weighted,
} from '../md-tables.mjs';

const SLOTS = ['head', 'torso', 'left_arm', 'right_arm', 'left_leg', 'right_leg'];
const FUNCTIONS = ['see', 'wield', 'walk'];

/** `hit 10, hp 0.5, see` or `"left foreleg" hit 12, hp 0.5, walk` or `— 0`. */
function parsePart(cell, slot) {
  const raw = String(cell ?? '').trim();
  const quoted = /"([^"]+)"/.exec(raw);
  const hit = /hit\s+(\d+)/.exec(raw);
  const hp = /hp\s+([\d.]+)/.exec(raw);
  return {
    name: quoted === null ? slot.replace(/_/g, ' ') : quoted[1],
    hit: hit === null ? 0 : Number(hit[1]),
    hpFactor: hp === null ? 0 : Math.round(Number(hp[1]) * 1000),
    functions: FUNCTIONS.filter((f) => new RegExp(`(^|[,\\s])${f}([,\\s]|$)`).test(raw)),
  };
}

export function exportBodyPlans() {
  const tables = readTables(join(CONTENT_DIR, 'creatures.md'));
  const table = findTable(tables, 'Body plans', 'left_arm');
  return byId(
    asObjects(table).map((row) => {
      const parts = {};
      for (const slot of SLOTS) parts[slot] = parsePart(row[slot], slot);
      const pid = plain(row.id);
      return { id: pid, name: pid.replace(/_/g, ' '), parts };
    }),
  );
}

const DAMAGE_TYPES = ['edge', 'blunt', 'pierce', 'ember', 'frost', 'burn'];

/** "claw edge 18 size 6; bite edge 16 size 5" -> AttackDef[]. */
export function parseAttacks(cell) {
  if (isBlank(cell)) return [];
  return plain(cell)
    .replace(/\([^)]*\)/g, ' ')
    .split(';')
    .map((part) => part.trim())
    .filter((p) => p.length > 0)
    .map((part) => {
      const typeMatch = new RegExp(`\\b(${DAMAGE_TYPES.join('|')})\\b`).exec(part);
      if (typeMatch === null) return null;
      const name = part.slice(0, typeMatch.index).trim();
      const rest = part.slice(typeMatch.index + typeMatch[0].length);
      const damage = /\s*(\d+)/.exec(rest);
      const size = /size\s+(\d+)/.exec(rest);
      const rng = /ranged\s+(\d+)/.exec(rest);
      return compact({
        name: name.length > 0 ? name : typeMatch[1],
        type: typeMatch[1],
        damage: damage === null ? 0 : Number(damage[1]),
        size: size === null ? 1 : Number(size[1]),
        range: rng === null ? undefined : Number(rng[1]),
      });
    })
    .filter((a) => a !== null);
}

/** creatures.md § Column key: flags S D O M N B T W H. D-170: boar is tameable per acceptance-tests.md. */
function parseFlags(cell, sid) {
  const letters = new Set(
    plain(cell)
      .split(/[\s;,]+/)
      .filter((t) => /^[SDOMNBTWH]$/.test(t)),
  );
  const war = letters.has('W');
  const hunting = letters.has('H');
  // Words beside the letters: `summoned` and `turns` (§ Summons, 25-runecraft.md § Summons).
  const words = new Set(plain(cell).split(/[\s;,]+/));
  return {
    flags: compact({
      summoned: words.has('summoned') ? true : undefined,
      turns: words.has('turns') ? true : undefined,
      stealth: letters.has('S') ? true : undefined,
      breaksDoors: letters.has('D') ? true : undefined,
      opensDoors: letters.has('O') ? true : undefined,
      magmaSafe: letters.has('M') ? true : undefined,
      butcherable: letters.has('B') ? true : undefined,
      tameable: letters.has('T') || sid === 'boar' ? true : undefined,
      trainable: war && hunting ? 'both' : war ? 'war' : hunting ? 'hunting' : 'none',
    }),
    nocturnal: letters.has('N'),
  };
}

/** "milk 5, wool 28" -> [{ kind, intervalDays }]. */
function parseProducts(cell) {
  if (isBlank(cell)) return undefined;
  const out = [];
  for (const part of plain(cell).split(',')) {
    const m = /(milk|wool|eggs)\s+(\d+)/.exec(part);
    if (m !== null) out.push({ kind: m[1], intervalDays: Number(m[2]) });
  }
  return out.length > 0 ? out : undefined;
}

/** "20 / 2–4 / 60" or "egg hatching 12 / 1 / 30" or "— (mules do not breed)". */
function parseBreeding(cell) {
  if (isBlank(cell)) return undefined;
  const s = plain(cell);
  if (s.startsWith('—') || /do not breed/.test(s)) return undefined;
  const parts = s.split('/').map((p) => p.trim());
  if (parts.length < 3) return undefined;
  const gest = /(\d+)/.exec(parts[0]);
  const litter = range(parts[1]) ?? [1, 1];
  const grow = /(\d+)/.exec(parts[2]);
  return compact({
    gestationDays: gest === null ? 0 : Number(gest[1]),
    litter,
    growDays: grow === null ? 0 : Number(grow[1]),
    hatch: /hatch/.test(s) ? true : undefined,
  });
}

/** "1 (40, cap 12)" (fauna) or "1 (2 packs, cap 10, daily 80‰)" (monster). */
export function parseCavern(cell) {
  if (isBlank(cell)) return undefined;
  const s = plain(cell);
  const tier = /^(\d)/.exec(s);
  if (tier === null) return undefined;
  const inner = /\(([^)]*)\)/.exec(s);
  const body = inner === null ? '' : inner[1];
  const cap = /cap\s+(\d+)/.exec(body);
  const respawn = /daily\s+(\d+)/.exec(body);
  const first = /(\d+)/.exec(body);
  const isMonster = /daily|packs|no respawn/.test(body);
  const initial = /initial\s+(\d+)/.exec(body);
  return compact({
    tier: Number(tier[1]),
    weight: isMonster ? 0 : first === null ? 0 : Number(first[1]),
    cap: cap === null ? 0 : Number(cap[1]),
    initial: isMonster ? (first === null ? 0 : Number(first[1])) : initial === null ? 0 : Number(initial[1]),
    respawnPermille: respawn === null ? 0 : Number(respawn[1]),
  });
}

/** 08-animals-and-domestication.md: "Perception is a radius by species (`perception`, default 12)". */
const DEFAULT_PERCEPTION = 12;

const FACTION_BY_SECTION = {
  'Dwarves and traders': (sid) =>
    sid === 'dwarf' ? 'fortress' : sid === 'human' ? 'trader:hillfolk' : 'trader:wildwood',
  'Domestic animals': () => 'fortress',
  'Wild surface animals': () => 'wild',
  'Cavern fauna (non-hostile; owned by 08)': () => 'wild',
  'Cavern monsters (owned by 18)': () => 'wild',
  'Hollow-born (faction `deep`; never flee; never loot)': () => 'deep',
  'Gloam, Hillfolk bandits, the restless dead (owned by 18)': (sid) =>
    sid === 'hillfolk_bandit' ? 'hostile:hillfolk' : sid === 'restless_dead' ? 'wild' : 'hostile:gloam',
  'Summons (owned by 25)': () => 'fortress',
};

const SECTIONS = Object.keys(FACTION_BY_SECTION);

export function exportCreatures() {
  const tables = readTables(join(CONTENT_DIR, 'creatures.md'));
  const out = [];
  for (const section of SECTIONS) {
    const table = findTable(tables, section, 'plan');
    for (const row of asObjects(table)) {
      const sid = plain(row.id);
      const { flags, nocturnal } = parseFlags(row.flags, sid);
      const hideCell = row.hide ?? row['hide/shell'] ?? '';
      const isShell = /shell/.test(plain(hideCell));
      const cavern = parseCavern(row['cavern (weight, cap)'] ?? row['cavern (initial, cap, respawn)']);
      const biomeWeights = weighted(row['biomes (weight)']).map((w) => ({
        biome: w.key,
        weight: w.weight,
      }));
      out.push(
        compact({
          id: sid,
          name: plain(row.name),
          plan: id(row.plan),
          size: int(row.size),
          speed: fixed(row.speed),
          diet: isBlank(row.diet) ? 'none' : plain(row.diet),
          temper: isBlank(row.temper) ? 'neutral' : plain(row.temper),
          movementClass: isBlank(row.class) ? 'walker' : plain(row.class),
          nocturnal,
          products: parseProducts(row.products),
          meatValue: int(row.meat),
          hideValue: int(hideCell),
          shell: isShell ? true : undefined,
          value: int(row.value),
          attacks: parseAttacks(row.attacks ?? row['attacks (unarmed)']),
          naturalArmor: int(row.armor),
          fleeBloodPercent: isBlank(row.flee) ? null : int(row.flee),
          group: range(row.group) ?? [1, 1],
          biomes: biomeWeights.length > 0 ? biomeWeights : undefined,
          cavern,
          season: seasons(row.season) ?? undefined,
          flags,
          breeding: parseBreeding(row['gestation / litter / grow (days)']),
          factionDefault: FACTION_BY_SECTION[section](sid),
          perception: DEFAULT_PERCEPTION,
          gear: isBlank(row['gear (see caravan-goods and threat-schedules)'])
            ? undefined
            : plain(row['gear (see caravan-goods and threat-schedules)']),
          glyph: glyph(row.glyph),
          fg: plain(row.fg) === 'state color' ? 'dwarf_normal' : id(row.fg),
        }),
      );
    }
  }
  return byId(out);
}
