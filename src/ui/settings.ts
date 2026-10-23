/** Presentation preferences stored outside fortress saves (24 § State, T-M7-07). */
import { DEFAULT_USER_SETTINGS, SETTINGS_COMBAT_LOG_OPTIONS, SETTINGS_SNAPSHOT_OPTIONS, SETTINGS_VOLUME_STEP, SETTINGS_ZOOM_OPTIONS } from './constants';

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
  /** Music on or off (24 § Music; the mute key toggles it). */
  music: boolean;
  /** Music volume, 0 to 100 in steps of {@link SETTINGS_VOLUME_STEP}. */
  musicVolume: number;
  /** Reserved for sound effects, which the game does not have yet; saved, not shown. */
  soundVolume: number;
}

/** A stored volume: a step of 0 to 100, or the default. */
function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 && value % SETTINGS_VOLUME_STEP === 0 ? value : fallback;
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
    music: bool('music'),
    musicVolume: volume(row['musicVolume'], DEFAULT_USER_SETTINGS.musicVolume),
    soundVolume: volume(row['soundVolume'], DEFAULT_USER_SETTINGS.soundVolume),
  };
}
