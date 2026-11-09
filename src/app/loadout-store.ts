/**
 * The saved embark loadouts: `02-systems/02-embark-and-loadout.md` § Loadouts, kept beside the
 * settings in the `settings` object store under the key `loadouts` (`persistence.md` § Storage).
 * The list is read once at boot and held in memory; every change writes the whole list back.
 */
import type { StorageAdapter } from '@platform/storage';
import { readLoadouts, sameLoadoutName, sortLoadouts, type SavedLoadout } from '@systems/embark';

export const LOADOUTS_KEY = 'loadouts';

export class LoadoutStore {
  private loadouts: SavedLoadout[] = [];

  /** Without storage the loadouts last for the session only (the tests and the headless runner). */
  constructor(private readonly storage: StorageAdapter | null) {}

  /** Read the stored list; an unreadable entry reads as no loadouts. */
  async load(): Promise<void> {
    if (this.storage === null) return;
    try {
      this.loadouts = readLoadouts(await this.storage.get<unknown>('settings', LOADOUTS_KEY));
    } catch {
      this.loadouts = [];
    }
  }

  list(): readonly SavedLoadout[] {
    return this.loadouts;
  }

  /** Save, replacing a loadout of the same name (without case). */
  put(loadout: SavedLoadout): Promise<void> {
    const copy: SavedLoadout = {
      name: loadout.name,
      supplies: loadout.supplies.map((line) => ({ entry: line.entry, count: line.count })),
      skills: loadout.skills.map((skills) => ({ ...skills })),
    };
    this.loadouts = sortLoadouts([...this.loadouts.filter((l) => !sameLoadoutName(l.name, loadout.name)), copy]);
    return this.write();
  }

  rename(from: string, to: string): Promise<void> {
    const found = this.loadouts.find((l) => l.name === from);
    if (found === undefined) return Promise.resolve();
    this.loadouts = sortLoadouts([...this.loadouts.filter((l) => l !== found && !sameLoadoutName(l.name, to)), { ...found, name: to }]);
    return this.write();
  }

  remove(name: string): Promise<void> {
    this.loadouts = this.loadouts.filter((l) => l.name !== name);
    return this.write();
  }

  private write(): Promise<void> {
    if (this.storage === null) return Promise.resolve();
    return this.storage.put('settings', LOADOUTS_KEY, this.loadouts.map((l) => ({ name: l.name, supplies: l.supplies, skills: l.skills })));
  }
}
