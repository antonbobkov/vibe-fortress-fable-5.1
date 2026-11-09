/**
 * 02 Embark & loadout. `02-systems/02-embark-and-loadout.md`.
 *
 * Embark runs before the world exists: the session holds the party, the supplies, the preset and
 * the fortress name, and answers the embark-session commands of `02` § Interfaces (app-level,
 * `command-catalog.md`: not simulation commands, not logged). On `ConfirmEmbark` the app generates
 * the local map from {@link localMapSpec} and calls {@link arrive}.
 */

import { EMBARK_DWARF_COUNT, EMBARK_SKILL_MAX_PER_SKILL, SKILL_MAX_LEVEL } from '@core/constants';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import { makeDwarf, type DwarfRecord } from '@systems/dwarves/rules/make-dwarf';
import { EMBARK_REROLL_COST, EMBARK_TESTING_MAX_COUNT, EMBARK_TESTING_MAX_DWARVES } from './constants';
import {
  applyPreset,
  canEmbark,
  defaultFortressName,
  embarkBudget,
  generateParty,
  partyStream,
  rerollDwarf,
  suppliesTotal,
  type EmbarkEntryRow,
  type SupplyLine,
} from './party';
import { TESTING_PRESET, TESTING_PRESET_ID, testingItemProblem, type TestingItemLine } from './testing';

export * from './constants';
export * from './spec';
export * from './party';
export * from './arrival';
export * from './site';
export * from './loadout';
export * from './testing';

/** `normal` play, or the testing start of `02` § Testing mode. */
export type EmbarkMode = 'normal' | 'testing';

/** The embark-session commands (`02` § Interfaces § Commands). */
export type EmbarkCommand =
  | { type: 'SetSkill'; dwarf: number; skill: string; level: number }
  | { type: 'RerollDwarf'; dwarf: number }
  | { type: 'RenameDwarf'; dwarf: number; name: string }
  | { type: 'SetSupply'; entry: string; count: number }
  | { type: 'ApplyPreset'; preset: string }
  | { type: 'SetFortressName'; name: string }
  | { type: 'ConfirmEmbark' }
  | { type: 'SetEmbarkMode'; mode: EmbarkMode }
  | { type: 'AddDwarf' }
  | { type: 'RemoveDwarf'; dwarf: number }
  | { type: 'SetSkillAll'; skill: string; level: number }
  | { type: 'AddItem'; line: TestingItemLine }
  | { type: 'SetItemCount'; index: number; count: number };

export interface EmbarkCommandResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * The embark screen's state (`02` § State: `budget`, `party[]`, `supplies[]`, `preset`,
 * `fortressName`, `mode`, `items[]`). Rerolls cost `EMBARK_REROLL_COST` marks, taken from the
 * budget. In testing mode (`02` § Testing mode) there is no budget and no limit but the testing
 * caps: the party grows and shrinks, every skill goes to `SKILL_MAX_LEVEL`, a catalog line to
 * `EMBARK_TESTING_MAX_COUNT`, and free item lines (`items`) bring anything else.
 */
export class EmbarkSession {
  readonly party: DwarfRecord[];
  supplies: SupplyLine[] = [];
  /** Free item lines of a testing loadout (`02` § Testing mode); always empty in normal mode. */
  items: TestingItemLine[] = [];
  mode: EmbarkMode = 'normal';
  preset: string | null = null;
  fortressName: string;
  confirmed = false;
  private rerollSpend = 0;
  private readonly rng: RngStream;

  constructor(
    private readonly registry: Registry,
    worldSeed: string,
    readonly peril: number,
  ) {
    this.rng = partyStream(worldSeed);
    this.party = generateParty(this.rng, registry);
    this.fortressName = defaultFortressName(this.rng, registry);
  }

  get testing(): boolean {
    return this.mode === 'testing';
  }

  /** Marks available: the peril budget less what rerolls have cost; unlimited in testing mode. */
  budget(): number {
    return this.testing ? Infinity : embarkBudget(this.peril) - this.rerollSpend;
  }

  total(): number {
    return suppliesTotal(this.registry, this.supplies);
  }

  canEmbark(): { ok: boolean; reason: string | null } {
    if (this.testing) return this.party.length > 0 ? { ok: true, reason: null } : { ok: false, reason: 'invalid' };
    const base = canEmbark(this.registry, this.party, this.supplies, this.peril);
    if (base.ok && this.total() > this.budget()) return { ok: false, reason: 'over_budget' };
    return base;
  }

  apply(cmd: EmbarkCommand): EmbarkCommandResult {
    if (this.confirmed) return { ok: false, reason: 'embarked' };
    switch (cmd.type) {
      case 'SetSkill': {
        const d = this.party[cmd.dwarf];
        if (d === undefined) return { ok: false, reason: 'not_found' };
        const refused = this.skillRefusal(cmd.skill, cmd.level);
        if (refused !== null) return { ok: false, reason: refused };
        setLevel(d, cmd.skill, cmd.level);
        return { ok: true };
      }
      case 'RerollDwarf': {
        if (this.party[cmd.dwarf] === undefined) return { ok: false, reason: 'not_found' };
        if (!this.testing && this.total() + EMBARK_REROLL_COST > this.budget()) return { ok: false, reason: 'over_budget' };
        if (!this.testing) this.rerollSpend += EMBARK_REROLL_COST;
        rerollDwarf(this.rng, this.registry, this.party, cmd.dwarf);
        return { ok: true };
      }
      case 'RenameDwarf': {
        const d = this.party[cmd.dwarf];
        if (d === undefined) return { ok: false, reason: 'not_found' };
        const name = cmd.name.trim();
        if (name.length === 0) return { ok: false, reason: 'invalid' };
        if (this.party.some((o, i) => i !== cmd.dwarf && o.name === name)) return { ok: false, reason: 'invalid' };
        d.name = name;
        return { ok: true };
      }
      case 'SetSupply': {
        const entry = this.registry.table<EmbarkEntryRow>('embarkCatalog').byId(cmd.entry);
        if (entry === undefined) return { ok: false, reason: 'not_found' };
        const max = this.testing ? EMBARK_TESTING_MAX_COUNT : entry.max;
        if (!Number.isInteger(cmd.count) || cmd.count < 0 || cmd.count > max) return { ok: false, reason: 'invalid' };
        const rest = this.supplies.filter((l) => l.entry !== cmd.entry);
        this.supplies = cmd.count === 0 ? rest : [...rest, { entry: cmd.entry, count: cmd.count }];
        return { ok: true };
      }
      case 'ApplyPreset': {
        if (cmd.preset === TESTING_PRESET_ID) {
          this.applyTestingPreset();
          return { ok: true };
        }
        if (!this.registry.table('embarkPresets').has(cmd.preset)) return { ok: false, reason: 'not_found' };
        this.supplies = applyPreset(this.registry, this.party, cmd.preset);
        this.items = [];
        this.preset = cmd.preset;
        return { ok: true };
      }
      case 'SetFortressName': {
        const name = cmd.name.trim();
        if (name.length === 0) return { ok: false, reason: 'invalid' };
        this.fortressName = name;
        return { ok: true };
      }
      case 'ConfirmEmbark': {
        const check = this.canEmbark();
        if (!check.ok) return { ok: false, reason: check.reason ?? 'invalid' };
        this.confirmed = true;
        return { ok: true };
      }
      case 'SetEmbarkMode': {
        if (cmd.mode !== 'normal' && cmd.mode !== 'testing') return { ok: false, reason: 'invalid' };
        if (cmd.mode === this.mode) return { ok: true };
        this.mode = cmd.mode;
        // Back to normal play: seven dwarves with no skills and nothing bought; the screen then
        // applies its default preset. Into testing: everything is kept, only the limits lift.
        if (cmd.mode === 'normal') {
          this.resizeParty(EMBARK_DWARF_COUNT);
          for (const d of this.party) d.skills = {};
          this.supplies = [];
          this.items = [];
          this.preset = null;
        }
        return { ok: true };
      }
      case 'AddDwarf': {
        if (!this.testing) return { ok: false, reason: 'not_testing' };
        if (this.party.length >= EMBARK_TESTING_MAX_DWARVES) return { ok: false, reason: 'member_limit' };
        this.resizeParty(this.party.length + 1);
        return { ok: true };
      }
      case 'RemoveDwarf': {
        if (!this.testing) return { ok: false, reason: 'not_testing' };
        if (this.party[cmd.dwarf] === undefined) return { ok: false, reason: 'not_found' };
        if (this.party.length <= 1) return { ok: false, reason: 'invalid' };
        this.party.splice(cmd.dwarf, 1);
        return { ok: true };
      }
      case 'SetSkillAll': {
        if (!this.testing) return { ok: false, reason: 'not_testing' };
        const refused = this.skillRefusal(cmd.skill, cmd.level);
        if (refused !== null) return { ok: false, reason: refused };
        for (const d of this.party) setLevel(d, cmd.skill, cmd.level);
        return { ok: true };
      }
      case 'AddItem': {
        if (!this.testing) return { ok: false, reason: 'not_testing' };
        const problem = testingItemProblem(this.registry, cmd.line, EMBARK_TESTING_MAX_COUNT);
        if (problem !== null) return { ok: false, reason: problem };
        // A line of the same item, material, quality, stone and enchantment adds to that line.
        const same = this.items.findIndex((l) => sameKind(l, cmd.line));
        if (same >= 0) {
          const line = this.items[same] as TestingItemLine;
          this.items[same] = { ...line, count: Math.min(EMBARK_TESTING_MAX_COUNT, line.count + cmd.line.count) };
        } else this.items.push(copyLine(cmd.line));
        return { ok: true };
      }
      case 'SetItemCount': {
        if (!this.testing) return { ok: false, reason: 'not_testing' };
        const line = this.items[cmd.index];
        if (line === undefined) return { ok: false, reason: 'not_found' };
        if (!Number.isInteger(cmd.count) || cmd.count < 0 || cmd.count > EMBARK_TESTING_MAX_COUNT) return { ok: false, reason: 'invalid' };
        if (cmd.count === 0) this.items.splice(cmd.index, 1);
        else this.items[cmd.index] = { ...line, count: cmd.count };
        return { ok: true };
      }
      default:
        return { ok: false, reason: 'not_found' };
    }
  }

  /**
   * Why a skill level is refused: `not_found` for no such skill, or, in normal mode, one with
   * `embark: no`; `invalid` for a level outside `0..EMBARK_SKILL_MAX_PER_SKILL`
   * (`0..SKILL_MAX_LEVEL` in testing mode).
   */
  private skillRefusal(skill: string, level: number): string | null {
    const skills = this.registry.table<{ id: string; embark?: boolean }>('skills');
    if (!skills.has(skill) || (!this.testing && skills.byId(skill)?.embark === false)) return 'not_found';
    const max = this.testing ? SKILL_MAX_LEVEL : EMBARK_SKILL_MAX_PER_SKILL;
    if (!Number.isInteger(level) || level < 0 || level > max) return 'invalid';
    return null;
  }

  /** Grow the party from the party stream (new dwarves have no skills), or drop dwarves from its end. */
  private resizeParty(size: number): void {
    if (this.party.length > size) this.party.splice(size);
    while (this.party.length < size) {
      const taken = new Set(this.party.map((d) => d.name));
      this.party.push(makeDwarf(this.rng, this.registry, { taken }));
    }
  }

  /** The testing preset (`02` § Testing mode): testing mode, its party size, skills, supplies and items. */
  private applyTestingPreset(): void {
    const preset = TESTING_PRESET;
    this.mode = 'testing';
    this.resizeParty(preset.dwarves);
    for (const d of this.party) d.skills = {};
    const skills = this.registry.table('skills');
    for (const s of preset.skills) {
      const d = this.party[s.dwarf];
      if (d !== undefined && skills.has(s.skill)) d.skills[s.skill] = s.level;
    }
    const catalog = this.registry.table('embarkCatalog');
    this.supplies = preset.supplies.filter((l) => catalog.has(l.entry)).map((l) => ({ entry: l.entry, count: l.count }));
    this.items = preset.items.filter((l) => testingItemProblem(this.registry, l, EMBARK_TESTING_MAX_COUNT) === null).map(copyLine);
    this.preset = preset.id;
  }
}

function setLevel(d: DwarfRecord, skill: string, level: number): void {
  if (level === 0) delete d.skills[skill];
  else d.skills[skill] = level;
}

/** Two free lines of the same kind: item, material, quality, stone and enchantment. */
function sameKind(a: TestingItemLine, b: TestingItemLine): boolean {
  return a.item === b.item && a.material === b.material && (a.quality ?? 1) === (b.quality ?? 1) && a.stone === b.stone && a.enchant === b.enchant;
}

function copyLine(l: TestingItemLine): TestingItemLine {
  return {
    item: l.item,
    material: l.material,
    count: l.count,
    ...(l.quality === undefined ? {} : { quality: l.quality }),
    ...(l.stone === undefined ? {} : { stone: l.stone }),
    ...(l.enchant === undefined ? {} : { enchant: l.enchant }),
  };
}
