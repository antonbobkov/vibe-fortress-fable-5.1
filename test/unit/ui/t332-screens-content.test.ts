/**
 * T-332: what each outside screen and modal dialog says for a fixed state. They were stored cell
 * buffers (T-M8-04, still kept as layout smoke goldens in `test/golden/render/m8-screens.test.ts`);
 * each assertion below names what a row means. The states are those of `screen-fixtures.ts`.
 */

import { describe, expect, it } from 'vitest';
import { renderScreen, type ScreenName } from './screen-fixtures';

function rows(name: ScreenName): string[] {
  return renderScreen(name).text.map((line) => line.trim());
}

describe('T-332 screens: what each outside screen says', () => {
  it('the main menu names the game, offers the six entries each with its key, and puts the cursor on New world', () => {
    const r = rows('main_menu');
    expect(r[4]).toBe('D E E P H O L M');
    expect(r[5]).toBe('a hall beneath the world');
    expect(r.slice(7, 13)).toEqual([
      '► [n] New world',
      '[c] Continue   (Emberhall · Year 2)',
      '[l] Load',
      '[g] Legends',
      '[o] Settings',
      '[a] About',
    ]);
  });

  it('the world generator asks for a seed and a size, marks the standard size chosen, and shows the generated map in a frame', () => {
    const r = rows('world_gen');
    expect(r[0]).toBe('New world');
    expect(r[1]).toMatch(/^Seed {2}\[ coldmere-4471_+ \] \[r\] random$/);
    expect(r[2]).toBe('Size  ( ) small 32   (•) standard 64   ( ) large 96');
    expect(r[3]).toBe('[g] Generate');
    expect(r[4]).toMatch(/^┌─+┐$/);
    expect(r[22]).toMatch(/^└─+┘$/);
    const inside = r.slice(5, 22).join('');
    expect(inside).toContain('≈');
    expect(inside).toMatch(/[♣▲∩]/);
    expect(r[23]).toBe('[Enter] Continue to the map        [Esc] Back');
  });

  it('the world map shows the world, the region under the cursor with its ratings and trait, the neighbours, and the keys', () => {
    const text = renderScreen('world_map').text;
    const map = text.map((line) => line.slice(0, 32)).join('\n');
    expect(map).toContain('☺');
    expect(map).toContain('≈');
    const panel = text.map((line) => line.slice(line.indexOf('│') + 1).trim()).filter((line) => line !== '');
    expect(panel[0]).toBe('Oldfield');
    expect(panel[1]).toBe('Forest');
    expect(panel[2]).toMatch(/^Wealth +[▓░]{5} \d$/);
    expect(panel[3]).toMatch(/^Peril +[▓░]{5} \d$/);
    expect(panel[4]).toBe('Peril counts raiders. Wild beasts');
    expect(panel[5]).toBe('live everywhere.');
    expect(panel[6]).toMatch(/^Temper +[▓░]{5} \d$/);
    expect(panel[7]).toBe('Trait: Beastwood');
    expect(panel.slice(8, 12)).toEqual(['Mountainhome 17 regions (S)', 'Gloam 45 regions (S)', 'Hillfolk 0 regions (N)', 'Wildwood 2048 regions (S)']);
    expect(panel[12]).toBe('[f] filter  [?] legend');
    expect(panel[13]).toBe('[Enter] Embark here');
  });

  it('the Dwarves tab lists the seven dwarves with the cursor on the first, and details that dwarf: name, age, attributes, traits and skills', () => {
    const r = rows('embark_dwarves');
    expect(r[0]).toMatch(/^Embark at Greenhollow +\[1\] Dwarves +\[2\] Supplies +\[3\] Animals +\[p\] Presets$/);
    const names = r.slice(2, 9).map((row) => row.split('│')[0]!.trim());
    expect(names[0]).toMatch(/^► Kolbein Bronzehelm +10\/10$/);
    for (const name of names.slice(1)) expect(name).toMatch(/^\S+ \S+ +10\/10$/);
    expect(r[2]).toMatch(/│ Kolbein Bronzehelm +\[n\] rename$/);
    expect(r[3]).toMatch(/│ (Male|Female) · \d+ years +\[r\] reroll 25 ☼$/);
    expect(r[4]).toMatch(/│ Str [▓░]{5} \d+ Agi [▓░]{5} \d+ Tou [▓░]{5} \d+ End/);
    expect(r[5]).toMatch(/│ Wil [▓░]{5} \d+ Wit [▓░]{5} \d+ Cha [▓░]{5} \d+$/);
    expect(r[6]).toMatch(/│ \w+ · \w+ · \w+$/);
    expect(r[7]).toMatch(/│ ─+ Skills \(points left: 0\) ─+/);
    expect(r[8]).toMatch(/│ ► Animal care +\[-\] 0 \[\+\]$/);
    expect(r[12]).toMatch(/│ {3}Axe +\[-\] 2 \[\+\]/);
    expect(r[15]).toMatch(/│ {3}Building +\[-\] 3 \[\+\]/);
  });

  it('the Supplies tab lists the items with price and count, shows the cost of each chosen line, and gives the hint', () => {
    const r = rows('embark_supplies');
    expect(r[2]).toMatch(/^\/filter: \[ _+ \] +Tools │ Food │ Drink │ Seeds │ Materials │ Furniture/);
    expect(r[3]).toMatch(/^► Iron anvil +270 ☼ +\[-\] +0 \[\+\]$/);
    const chosen = r.slice(3, 23).filter((row) => row.includes('='));
    expect(chosen.length).toBeGreaterThan(3);
    for (const row of chosen) {
      const m = /(\d+) ☼ +\[-\] +(\d+) \[\+\] += +(\d+)$/.exec(row);
      expect(m, row).not.toBeNull();
      // The figure after "=" is the price times the count.
      expect(Number(m![1]) * Number(m![2])).toBe(Number(m![3]));
    }
    expect(r[8]).toMatch(/^Bucket +5 ☼ +\[-\] +2 \[\+\] += +10$/);
    expect(r[29]).toBe('Hint: two picks and one axe are the minimum for a working start.');
  });

  it('the Animals tab lists the animals that can come with their price, and the chosen ones with their cost', () => {
    const r = rows('embark_animals');
    expect(r[2]).toMatch(/^► Bull +72 ☼ +\[-\] +0 \[\+\]$/);
    expect(r[3]).toMatch(/^Cat +12 ☼ +\[-\] +1 \[\+\] += +12$/);
    expect(r[6]).toMatch(/^Dog +36 ☼ +\[-\] +2 \[\+\] += +72$/);
    expect(r.slice(2, 13).map((row) => row.replace(/^► /, '').replace(/ +\d+ ☼.*$/, ''))).toEqual([
      'Bull', 'Cat', '3 chickens and a rooster', 'Cow', 'Dog', 'Goat', 'Mule', 'Pig', 'Sheep', 'War dog', 'Yak',
    ]);
  });

  it('every Embark tab ends with the fortress name, a budget that adds up, and the keys', () => {
    for (const name of ['embark_dwarves', 'embark_supplies', 'embark_animals'] as const) {
      const r = rows(name);
      expect(r[32], name).toMatch(/^Fortress name \[ Oakhold_+ \] +Budget ([\d,]+) ☼ +Spent ([\d,]+) +Left ([\d,]+)$/);
      const m = /Budget ([\d,]+) ☼ +Spent ([\d,]+) +Left ([\d,]+)$/.exec(r[32]!)!;
      const [budget, spent, left] = [m[1]!, m[2]!, m[3]!].map((n) => Number(n.replace(/,/g, '')));
      expect(spent! + left!, name).toBe(budget);
      expect(r[33], name).toMatch(/^\[Enter\] Embark +\[Esc\] Back$/);
    }
  });

  it('Load groups the saves under Manual, Autosaves, Snapshots and Finished, each with its date, population and wealth, and the cursor on the first', () => {
    const r = rows('load');
    expect(r[1]).toBe('Load');
    expect(r[2]).toBe('Manual');
    expect(r[3]).toBe('► Emberhall · Day 21 of Spring, Year 1 · 23 dwarves · 18,450 ☼');
    expect(r[4]).toBe('Autosaves');
    expect(r[5]).toBe('Emberhall · Spring, Year 1 (auto) · 20 dwarves · 15,200 ☼');
    expect(r[6]).toBe('Snapshots');
    expect(r[7]).toBe('Emberhall · Day 9 of Spring, Year 1 · 14 dwarves · 8,900 ☼');
    expect(r[8]).toBe('Finished');
    expect(r[9]).toBe('Coldvein Hold · Day 13 of Summer, Year 1 · 0 dwarves · 52,300 ☼');
    expect(r[24]).toBe('[Enter] Load  [x] Delete  [e] Export  [i] Import  [Esc] Back');
  });

  it('Settings lists each option with its current value, explains the Zoom option, and offers reset and back', () => {
    const r = rows('settings');
    expect(r[1]).toBe('Settings');
    expect(r.slice(3, 15)).toEqual([
      '► Auto-pause on danger        [on]',
      'Auto-pause on alert         [off]',
      'Hints                       [on]',
      'Colorblind palette          [off]',
      'Zoom                        [Auto]',
      'Edge scrolling              [off]',
      'Autosave each season        [on]',
      'Snapshots kept              [4]',
      'Combat log                  [hits only]',
      'Keybindings ►',
      'Music volume                [50%]',
      'Music                       [on]',
    ]);
    expect(r[15]).toBe('Auto: a larger cell on a large window. A fixed zoom keeps the old look.');
    expect(r[17]).toBe('[d] Reset to defaults    [Esc] Back');
  });

  it('the keybindings list gives the action and key of every binding under its context heading, in the order of the keymap, and how to rebind and reset', () => {
    const r = rows('settings_keybindings');
    expect(r[1]).toBe('Settings · Keybindings');
    expect(r[2]).toMatch(/^Action +Key$/);
    // T-424: the bindings are grouped under the screen or panel they act in; Esc is fixed.
    expect(r[3]).toBe('Global');
    expect(r[4]).toMatch(/^► cancel tool → close panel → game menu +Esc {2}fixed$/);
    expect(r[5]).toMatch(/^pause \/ resume +Space$/);
    expect(r[9]).toMatch(/^quick save +F5$/);
    expect(r[16]).toMatch(/^calendar panel +\[S-y\]$/);
    expect(r[17]).toMatch(/^music on \/ off +Ctrl\+M$/);
    expect(r[18]).toBe('Map');
    expect(r[19]).toMatch(/^pan or move the map cursor \(Shift: 10\) +←$/);
    for (const row of [...r.slice(5, 18), ...r.slice(19, 22)]) expect(row).toMatch(/^\S.* {2,}\S+$/);
    expect(r[23]).toBe('[Enter] rebind  [Del] default  [d] all defaults  [Esc] Back');
  });

  it('the Legends screen tells the fortress record: founding, fall, totals, milestones, notable deeds and last words', () => {
    const r = rows('legend');
    expect(r[1]).toBe('Legend');
    expect(r[3]).toBe('Coldvein Hold');
    expect(r[4]).toBe('Founded Spring, Year 1 at Ashfell (mountain, wealth 3, peril 3)');
    expect(r[5]).toMatch(/^Fell on Day 4 of Winter, Year 4\. The last dwarf, Solveig Deephand, died of h/);
    expect(r[6]).toBe('Years 3 · Days 336 · Peak population 41 · Deepest level 6 · Wealth 52,300 ☼');
    expect(r[7]).toBe('Milestones');
    expect(r.slice(8, 11)).toEqual(['Spring 1  The hearth was lit.', 'Summer 1  The first bar was smelted.', 'Autumn 2  The first cavern was breached.']);
    expect(r[11]).toBe('Notable');
    expect(r.slice(12, 14)).toEqual(['Orm Ashbrow slew 14 enemies.', 'Gnashvein the captain returned twice.']);
    expect(r[14]).toBe('Last words (log)');
    expect(r.slice(15, 17)).toEqual(['!! The Hollow opens its mouth.', '!  Brynja Coldhammer has bled to death.']);
    expect(r[24]).toBe('[Esc] Back');
  });

  it('the game menu names the fortress and offers resume, save, load, settings, rename, retire and the main menu, each with its key', () => {
    const r = rows('game_menu');
    expect(r[7]).toBe('Deepholm · Emberhall');
    expect(r.slice(9, 16)).toEqual([
      '► [r] Resume', '[s] Save', '[l] Load', '[o] Settings', '[n] Rename fortress', '[x] Retire fortress', '[m] Main menu',
    ]);
  });

  it('the retire dialog names the fortress, says what happens to it, and offers Yes and No', () => {
    const r = rows('confirm');
    expect(r[10]).toBe('Retire Emberhall? The hall will be recorded in the');
    expect(r[11]).toBe('Legends and cannot be resumed.');
    expect(r[13]).toBe('[y] Yes  [n] No');
  });
});
