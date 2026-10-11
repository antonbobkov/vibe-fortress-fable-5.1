/**
 * E2E `embark-custom` (T-155): on the embark screen, change a skill, reroll and rename a dwarf,
 * change a supply count and an animal count, rename the fortress, embark; assert the arrived party
 * and stock through the readers.
 */

import { test, expect } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface CustomEmbarkHook extends Hook {
  readers: {
    fortress: { state: { name: string } };
    items: { count(id: string): number };
    of<T>(id: string): T;
  };
  host: {
    world: {
      entities: {
        componentTypes(): readonly { id: number; name: string }[];
        get<T>(id: number, type: { id: number; name: string }): T | undefined;
      };
    };
  };
}

interface DwarvesReader {
  list(): number[];
  population(): number;
  skill(id: number, skillId: string): number;
}

interface AnimalsReader {
  bySpecies(species: number | string, wild?: boolean): number[];
}

test('embark-custom', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-custom');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');

  // 1. Change a skill on dwarf 0:
  // Tab to skills list.
  await page.keyboard.press('Tab');
  // Move down to 'Axe'.
  while (!(await textOf(page)).includes('► Axe')) {
    await page.keyboard.press('ArrowDown');
  }
  // Reduce Axe skill by 1 (2 -> 1).
  await page.keyboard.press('-');

  // Move back up to 'Animal care' and increase by 1 (0 -> 1).
  while (!(await textOf(page)).includes('► Animal care')) {
    await page.keyboard.press('ArrowUp');
  }
  await page.keyboard.press('+');

  // 2. Reroll and rename a dwarf:
  // Move focus back to the party list.
  await page.keyboard.press('Shift+Tab');
  // Select dwarf 1.
  await page.keyboard.press('ArrowDown');
  // Reroll dwarf 1 with 'r'.
  await page.keyboard.press('r');
  // Rename dwarf 1 with 'n'.
  await page.keyboard.press('n');
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('Urist Custom');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Urist Custom');

  // 3. Change a supply count:
  // Switch to tab 2 (Supplies).
  await page.keyboard.press('2');
  while (!(await textOf(page)).includes('► Iron pick')) {
    await page.keyboard.press('ArrowDown');
  }
  // Reduce iron pick count from 2 to 1 with '-'.
  await page.keyboard.press('-');

  // 4. Change an animal count:
  // Switch to tab 3 (Animals).
  await page.keyboard.press('3');
  while (!(await textOf(page)).includes('► Cat')) {
    await page.keyboard.press('ArrowDown');
  }
  // Increase Cat count from 1 to 2 with '+'.
  await page.keyboard.press('+');

  // 5. Rename the fortress:
  // From the items list on tab 3, Tab moves to the fortress name field.
  await page.keyboard.press('Tab');
  for (let i = 0; i < 35; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('Customhold');
  await page.keyboard.press('Enter');

  // 6. Embark:
  // Focus returns to items list; Enter embarks.
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  // Screenshot.
  const path = await page.evaluate(
    () => (window as unknown as { __deepholm: CustomEmbarkHook }).__deepholm.screenshotName('embark-custom'),
  );
  await page.screenshot({ path });

  // 7. Assert arrived party and stock through the readers:
  const fortressName = await page.evaluate(
    () => (window as unknown as { __deepholm: CustomEmbarkHook }).__deepholm.readers.fortress.state.name,
  );
  expect(fortressName).toBe('Customhold');

  const arrived = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: CustomEmbarkHook }).__deepholm;
    const dwarves = h.readers.of<DwarvesReader>('10');
    const animals = h.readers.of<AnimalsReader>('08');
    const ids = dwarves.list();
    const creatureType = h.host.world.entities.componentTypes().find((t) => t.name === 'Creature');
    if (!creatureType) throw new Error('Creature component type not found');

    const dwarf0Axe = dwarves.skill(ids[0] ?? 0, 'axe');
    const dwarf0AnimalCare = dwarves.skill(ids[0] ?? 0, 'animal_care');
    const dwarf1 = h.host.world.entities.get<{ name: string }>(ids[1] ?? 0, creatureType);

    return {
      population: dwarves.population(),
      dwarf0Axe,
      dwarf0AnimalCare,
      dwarf1Name: dwarf1?.name ?? '',
      picks: h.readers.items.count('pick'),
      cats: animals.bySpecies('cat', false).length,
    };
  });

  expect(arrived.population).toBe(7);
  expect(arrived.dwarf0Axe).toBe(1);
  expect(arrived.dwarf0AnimalCare).toBe(1);
  expect(arrived.dwarf1Name).toBe('Urist Custom');
  expect(arrived.picks).toBe(1);
  expect(arrived.cats).toBe(2);

  expect(errors).toEqual([]);
});
