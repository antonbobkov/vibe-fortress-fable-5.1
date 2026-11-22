/**
 * T-627: a dwarf with a skill in every trade has a view longer than the sidebar. Look's `Creatures`
 * tab opens at its top with a mark below; `PageDown` scrolls it to the relations, the mark above
 * says the top lies above, and the wheel over the panel scrolls it back (24 § Inspection).
 */
import { expect, test, type Page } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface SkillsHook extends Hook {
  host: { world: { entities: { componentTypes(): { name: string }[]; get(id: number, type: unknown): { level: Uint8Array } | undefined } } };
  dwarves(): { id: number }[];
  step(n: number): void;
}

/** Whether a row of the screen ends in the mark above or the mark below (the sidebar's right edge). */
async function marks(page: Page): Promise<{ up: boolean; down: boolean }> {
  const rows = (await textOf(page)).split('\n').map((row) => row.trimEnd());
  return { up: rows.some((row) => row.endsWith('▲')), down: rows.some((row) => row.endsWith('▼')) };
}

test('T-627 look-creature-scroll: the dwarf view scrolls to its relations and back', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 'e2e-look-scroll');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  // The first dwarf knows a little of every skill: a long Skills list.
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: SkillsHook }).__deepholm;
    const entities = h.host.world.entities;
    const type = entities.componentTypes().find((t) => t.name === 'Skills');
    const first = h.dwarves()[0];
    const skills = first === undefined ? undefined : entities.get(first.id, type);
    if (skills === undefined) throw new Error('no skills');
    for (let k = 0; k < skills.level.length; k += 1) skills.level[k] = Math.max(skills.level[k] ?? 0, 1);
    h.step(1);
  });

  // Units, then Enter: the first dwarf's view, from its top.
  await page.keyboard.press('u');
  await expect.poll(() => textOf(page)).toContain('Units');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Needs');
  expect(await textOf(page)).not.toContain('Relations ');
  expect(await marks(page)).toEqual({ up: false, down: true });

  for (let k = 0; k < 8 && !(await textOf(page)).includes('Relations '); k += 1) await page.keyboard.press('PageDown');
  expect(await textOf(page)).toContain('Relations ');
  expect(await textOf(page)).not.toContain('Needs');
  expect(await marks(page)).toEqual({ up: true, down: false });

  // The wheel over the sidebar scrolls it back to the top.
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas');
  await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2);
  for (let k = 0; k < 30 && (await marks(page)).up; k += 1) await page.mouse.wheel(0, -100);
  await expect.poll(() => textOf(page)).toContain('Needs');
  expect(await marks(page)).toEqual({ up: false, down: true });

  // T-671: `f` follows the dwarf and status row 2 says so; an arrow pans the map and ends it.
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.keyboard.press('f');
  await expect.poll(() => textOf(page)).toContain('Following ');
  expect(await textOf(page)).toContain('follow ■ on');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => textOf(page)).not.toContain('Following ');
  expect(await textOf(page)).toContain('follow off');
  const path = await page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.screenshotName('look-creature-scroll'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
