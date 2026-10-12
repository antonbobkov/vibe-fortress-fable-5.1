/** Presentation preferences stored outside fortress saves (24 § State, T-M7-07). */
import { DEFAULT_USER_SETTINGS, SETTINGS_COMBAT_LOG_OPTIONS, SETTINGS_SNAPSHOT_OPTIONS, SETTINGS_ZOOM_OPTIONS } from './constants';

export { DEFAULT_USER_SETTINGS } from './constants';
export interface UserSettings {
  autoPauseDanger: boolean;
  autoPauseAlert: boolean;
  hints: boolean;
  colorblind: boolean;
  /** The requested zoom: `auto` or a level of `ZOOM_LEVELS` (23 § Canvas and cells). */
  zoom: number | 'auto';
  edgeScrolling: boolean;
  autosave: boolean;
  snapshotsKept: 2 | 4 | 8;
  combatLog: 'all' | 'hits only' | 'off';
}

/** A bad or old store entry falls back field by field, preserving valid preferences. */
export function readSettings(value: unknown): UserSettings {
  const row = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const bool = (key: keyof UserSettings): boolean => typeof row[key] === 'boolean' ? row[key] as boolean : DEFAULT_USER_SETTINGS[key] as boolean;
  return {
    autoPauseDanger: bool('autoPauseDanger'),
    autoPauseAlert: bool('autoPauseAlert'),
    hints: bool('hints'),
    colorblind: bool('colorblind'),
    zoom: SETTINGS_ZOOM_OPTIONS.includes(row['zoom'] as typeof SETTINGS_ZOOM_OPTIONS[number]) ? row['zoom'] as number | 'auto' : DEFAULT_USER_SETTINGS.zoom,
    edgeScrolling: bool('edgeScrolling'),
    autosave: bool('autosave'),
    snapshotsKept: SETTINGS_SNAPSHOT_OPTIONS.includes(row['snapshotsKept'] as typeof SETTINGS_SNAPSHOT_OPTIONS[number]) ? row['snapshotsKept'] as 2 | 4 | 8 : DEFAULT_USER_SETTINGS.snapshotsKept,
    combatLog: SETTINGS_COMBAT_LOG_OPTIONS.includes(row['combatLog'] as typeof SETTINGS_COMBAT_LOG_OPTIONS[number]) ? row['combatLog'] as UserSettings['combatLog'] : DEFAULT_USER_SETTINGS.combatLog,
  };
}
