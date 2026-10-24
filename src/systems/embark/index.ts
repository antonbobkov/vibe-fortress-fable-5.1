/**
 * 02 Embark & loadout. `02-systems/02-embark-and-loadout.md`.
 *
 * Embark runs before the world exists: the session holds the party, the supplies, the preset and
 * the fortress name, and answers the embark-session commands of `02` § Interfaces (app-level,
 * `command-catalog.md`: not simulation commands, not logged). On `ConfirmEmbark` the app generates
 * the local map from {@link localMapSpec} and calls {@link arrive}.
 */

import { EMBARK_SKILL_MAX_PER_SKILL } from '@core/constants';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { DwarfRecord } from '@systems/dwarves/rules/make-dwarf';
import { EMBARK_REROLL_COST } from './constants';
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

export * from './constants';
export * from './spec';
export * from './party';
export * from './arrival';
export * from './site';

/** The embark-session commands (`02` § Interfaces § Commands). */
export type EmbarkCommand =
  | { type: 'SetSkill'; dwarf: number; skill: string; level: number }
  | { type: 'RerollDwarf'; dwarf: number }
  | { type: 'RenameDwarf'; dwarf: number; name: string }
  | { type: 'SetSupply'; entry: string; count: number }
  | { type: 'ApplyPreset'; preset: string }
  | { type: 'SetFortressName'; name: string }
  | { type: 'ConfirmEmbark' };

export interface EmbarkCommandResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * The embark screen's state (`02` § State: `budget`, `party[]`, `supplies[]`, `preset`,
 * `fortressName`). Rerolls cost `EMBARK_REROLL_COST` marks, taken from the budget.
 */
export class EmbarkSession {
  readonly party: DwarfRecord[];
  supplies: SupplyLine[] = [];
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

  /** Marks available: the peril budget less what rerolls have cost. */
  budget(): number {
    return embarkBudget(this.peril) - this.rerollSpend;
  }

  total(): number {
    return suppliesTotal(this.registry, this.supplies);
  }

  canEmbark(): { ok: boolean; reason: string | null } {
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
        if (!this.registry.table('skills').has(cmd.skill)) return { ok: false, reason: 'not_found' };
        if (!Number.isInteger(cmd.level) || cmd.level < 0 || cmd.level > EMBARK_SKILL_MAX_PER_SKILL) {
          return { ok: false, reason: 'invalid' };
        }
        if (cmd.level === 0) delete d.skills[cmd.skill];
        else d.skills[cmd.skill] = cmd.level;
        return { ok: true };
      }
      case 'RerollDwarf': {
        if (this.party[cmd.dwarf] === undefined) return { ok: false, reason: 'not_found' };
        if (this.total() + EMBARK_REROLL_COST > this.budget()) return { ok: false, reason: 'over_budget' };
        this.rerollSpend += EMBARK_REROLL_COST;
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
        if (!Number.isInteger(cmd.count) || cmd.count < 0 || cmd.count > entry.max) return { ok: false, reason: 'invalid' };
        const rest = this.supplies.filter((l) => l.entry !== cmd.entry);
        this.supplies = cmd.count === 0 ? rest : [...rest, { entry: cmd.entry, count: cmd.count }];
        return { ok: true };
      }
      case 'ApplyPreset': {
        if (!this.registry.table('embarkPresets').has(cmd.preset)) return { ok: false, reason: 'not_found' };
        this.supplies = applyPreset(this.registry, this.party, cmd.preset);
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
      default:
        return { ok: false, reason: 'not_found' };
    }
  }
}
