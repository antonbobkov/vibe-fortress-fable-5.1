/** The `settings` object store entry of persistence.md (T-M7-07). */
import type { StorageAdapter } from '@platform/storage';
import type { KeyOverride } from '@ui/keymap';
import { readSettings, type UserSettings } from '@ui/settings';

export interface StoredSettings {
  readonly preferences: UserSettings;
  readonly keymapOverrides: readonly KeyOverride[];
}

export class SettingsStore {
  constructor(private readonly storage: StorageAdapter) {}

  async load(): Promise<StoredSettings | null> {
    const raw = await this.storage.get<Partial<StoredSettings>>('settings', 'settings');
    if (!raw) return null;
    return {
      preferences: readSettings(raw.preferences),
      keymapOverrides: Array.isArray(raw.keymapOverrides) ? raw.keymapOverrides : [],
    };
  }

  save(preferences: UserSettings, keymapOverrides: readonly KeyOverride[]): Promise<void> {
    return this.storage.put('settings', 'settings', { preferences: { ...preferences }, keymapOverrides: keymapOverrides.map((entry) => ({ index: entry.index, spec: { ...entry.spec } })) } satisfies StoredSettings);
  }
}
