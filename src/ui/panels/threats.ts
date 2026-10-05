/**
 * Threats panel: active threats, schedule preview, caverns, and the Deep gauge (`ui-screens/panels.md` § Threats).
 * Spec: 18 § Player-facing behavior, § Renown, § Schedule, § The Deep.
 */

import type { Rect } from '@render/cellbuffer';
import type { ThreatsReader } from '@systems/threats';
import type { TerrainReader } from '@systems/terrain';
import type { Surface } from '../surface';
import { label, separator } from '../widgets';
import type { PanelContext } from './context';
import type { KeyPress } from '@platform/input';
import { visibleHostiles } from '../status';

export function deepQuote(level: number): string {
  switch (level) {
    case 0:
      return 'Something below has not yet noticed.';
    case 1:
      return 'The Deep stirs. Something has noticed the pale metal being taken.';
    case 2:
      return 'The rock cracks below. The Hollow sends its hunters.';
    case 3:
      return 'Fire moves in the deep. A wyrm has come up.';
    case 4:
      return 'The Hollow opens its mouth.';
    default:
      return 'The Hollow does not forget.';
  }
}

function shortSchedule(value: string): string {
  return value.replace('possible from ', 'from ').replace('Year ', 'Y');
}

export class ThreatsPanel {
  key(_ctx: PanelContext, _press: KeyPress): boolean {
    return false;
  }
}

/** A party is known once at least one of its members can be seen. */
export function visibleThreatParties(reader: Pick<ThreatsReader, 'activeParties' | 'party' | 'isStealthed' | 'isSpotted'>): readonly number[] {
  return reader.activeParties().filter((id) => {
    const party = reader.party(id);
    return party !== undefined && party.purpose !== 'caravan' &&
      party.members.some((member) => !reader.isStealthed(member) || reader.isSpotted(member));
  });
}

export function drawThreatsPanel(
  s: Surface,
  rect: Rect,
  _panel: ThreatsPanel,
  ctx: PanelContext,
  deepFound = false,
): void {
  const t = s.theme;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  let row = rect.row;

  const threats = ctx.readers.has('18') ? ctx.readers.of<ThreatsReader>('18') : null;
  const terrain = ctx.readers.has('03') ? ctx.readers.of<TerrainReader>('03') : null;

  const peril = terrain?.spec()?.peril ?? 0;
  const renown = threats ? threats.renown() : 0;
  label(s, col, row, `Peril ${peril} · Renown ${renown.toFixed(1)}`, { fg: t.value, width });
  row += 1;
  label(s, col, row, 'Wealth and population draw attention.', { fg: t.dim, width });
  row += 1;

  // Active threats
  const active = threats ? visibleThreatParties(threats) : [];
  // D-U8: the status bar's `!n` and this line agree: hostiles in view without a party (a cavern
  // monster come up, a wild predator) are counted here too.
  const seen = visibleHostiles(ctx.readers);
  if (active.length === 0) {
    label(s, col, row, seen > 0 ? `Active: ${seen} hostile creature${seen === 1 ? '' : 's'}` : 'Active: none', { fg: seen > 0 ? t.bad : t.text, width });
    row += 1;
  } else {
    for (const pId of active) {
      if (row >= rect.row + rect.rows) break;
      const p = threats?.party(pId);
      if (p) {
        label(s, col, row, `Active: ${p.purpose} (${p.members.length}, ${p.state})`, { fg: t.bad, width });
        row += 1;
      }
    }
  }

  // Schedule preview
  const preview = threats ? threats.schedulePreview() : {};
  if (preview['raid'] !== undefined && preview['raid'] !== 'never') {
    label(s, col, row, `Raids ${shortSchedule(preview['raid'])}`, { width });
    row += 1;
  }
  if (preview['ambush'] !== undefined && preview['ambush'] !== 'never') {
    label(s, col, row, `Ambushes ${shortSchedule(preview['ambush'])}`, { width });
    row += 1;
  }
  label(s, col, row, `Thieves ${shortSchedule(preview['thief'] ?? 'unknown')}`, { width });
  row += 1;

  // Caverns
  separator(s, col, row, width, 'Caverns');
  row += 1;
  for (let c = 1; c <= 3; c += 1) {
    if (row >= rect.row + rect.rows) break;
    const breached = terrain ? terrain.cavernBreached(c) : false;
    if (breached) {
      const monsterCount = threats ? threats.monstersInCavern(c) : 0;
      label(s, col, row, `${c}: breached · monsters ${monsterCount}`, { width });
    } else {
      label(s, col, row, `${c}: sealed`, { fg: t.dim, width });
    }
    row += 1;
  }

  // The Deep
  const deepsilverFound = deepFound || (threats !== null && (threats.deepPressure() > 0 || threats.deepLevel() > 0));

  if (deepsilverFound) {
    separator(s, col, row, width, 'The Deep');
    row += 1;
    const pressure = threats ? threats.deepPressure() : 0;
    const level = threats ? threats.deepLevel() : 0;
    const nextThresh = threats ? threats.deepNextThreshold() : 50;

    const filled = Math.min(10, Math.max(0, Math.floor((pressure / Math.max(1, nextThresh)) * 10)));
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
    label(s, col, row, `Pressure ${bar} ${pressure} / ${nextThresh} (lvl ${level})`, { width });
    row += 1;

    const quote = `"${deepQuote(level)}"`;
    if (quote.length <= width) {
      label(s, col, row, quote, { fg: t.dim, width });
      row += 1;
    } else {
      const words = quote.split(' ');
      let line1 = '';
      let line2 = '';
      for (const w of words) {
        if ((line1 + ' ' + w).trim().length <= width) {
          line1 = (line1 + ' ' + w).trim();
        } else {
          line2 = (line2 + ' ' + w).trim();
        }
      }
      label(s, col, row, line1, { fg: t.dim, width });
      row += 1;
      if (line2.length > 0 && row < rect.row + rect.rows) {
        label(s, col, row, ` ${line2}`, { fg: t.dim, width });
        row += 1;
      }
    }
  }
}
