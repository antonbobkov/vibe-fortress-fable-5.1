/**
 * T-789: a tomb keeps its own coffins ready. The burial line says the next step it needs: build
 * coffins while some are in stock, order them (or set a tomb's coffins ready) while none are; the
 * tomb inspector shows its coffins ready with [-]/[+] and the order it keeps; the Orders list names
 * the tomb an order is for.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Command } from '@core/commands';
import { UNBURIED_DAYS } from '@systems/morale/constants';
import { AnnouncementLog, lineText } from '@ui/announcements';
import type { PanelContext } from '@ui/panels/context';
import { tombLines } from '@ui/panels/zones';
import { OrdersPanel } from '@ui/panels/orders';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld, sent: Command[] = []): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); }, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

function twoDead(w: TestWorld): number {
  for (let k = 0; k < 2; k += 1) {
    const dwarf = w.spawnDwarf({ at: w.index(20 + 4 * k, 20, Z) });
    w.step(1);
    const hp = w.game.world.entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === dwarf), 30);
  }
  return w.tick;
}

describe('T-789 the burial line says build or order, and the tomb says what it keeps', () => {
  it('with no coffin in stock the line says to order coffins, naming the tomb to set when there is one', () => {
    const w = world('t789-line');
    const died = twoDead(w);
    const log = new AnnouncementLog(strings, w.game.registry);
    const day = died + UNBURIED_DAYS * TICKS_PER_DAY + 10;
    const noTomb = log.unburiedAlert(w.readers, day);
    expect(lineText(noTomb!.line, strings)).toBe('! 2 dead wait for burial and no coffin is free or in stock: [o] order coffins, and zone a tomb [z] to keep them ready.');
    const tomb = w.zone('tomb', [w.index(40, 40, Z), w.index(41, 40, Z), w.index(42, 40, Z)]);
    expect(tomb).toBeGreaterThan(0);
    const withTomb = log.unburiedAlert(w.readers, day + TICKS_PER_DAY);
    expect(lineText(withTomb!.line, strings)).toBe("! 2 dead wait for burial and no coffin is free or in stock: [o] order coffins, or set Tomb #1's coffins ready [z].");
    w.build('coffin', w.index(44, 44, Z), 'granite');
    const few = log.unburiedAlert(w.readers, day + 2 * TICKS_PER_DAY);
    expect(lineText(few!.line, strings)).toBe('! 2 dead wait for burial, only 1 coffin is free and none in stock: [o] order 1 more.');
    w.spawnItem('coffin', 'granite', w.index(30, 40, Z));
    const build = log.unburiedAlert(w.readers, day + 3 * TICKS_PER_DAY);
    expect(lineText(build!.line, strings)).toBe('! 2 dead wait for burial and only 1 coffin is free: build 1 more [b > Furniture].');
  });

  it('the tomb inspector shows its coffins ready and its order, and the order row names the tomb', () => {
    const w = world('t789-inspector');
    const buildings = w.readers.of<BuildingsReader>('14');
    const mason = w.build('mason', w.index(50, 40, Z), 'granite');
    w.spawnDwarf({ at: w.index(46, 46, Z) });
    const tomb = w.zone('tomb', [w.index(40, 40, Z), w.index(41, 40, Z), w.index(42, 40, Z)]);
    w.step(TICKS_PER_DAY + 20);
    const ctx = ctxOf(w);
    const zone = buildings.zone(tomb)!;
    const view = tombLines(ctx, zone);
    expect(view).toMatchObject({ ready: 0, wanted: 2 });
    expect(strings.get('ui.zone.tomb.coffins_ready', { ready: view.ready, wanted: view.wanted })).toBe('Coffins ready: 0 of 2');
    expect(view.lines[0]).toBe("2 coffins on order at Mason's workshop #1");
    expect(view.lines[1]).toContain("short of stock, Tomb #1 orders them at the mason's or carpenter's");
    // The Orders list: "×2 Coffin for Tomb #1 · waiting for raw stone (0)".
    const order = w.game.world.entities.get(mason, C.Workshop)!.orders[0]!;
    expect(order.forZoneId).toBe(tomb);
    const panel = new OrdersPanel();
    const rows = panel.rows(ctx).map((row) => panel.rowText(ctx, row));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/^×2 Coffin for Tomb #1 · /);
    // Setting 0: no coffins kept, and the help says so.
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: tomb, key: 'coffins ready', value: 0 })).toEqual({ ok: true });
    expect(tombLines(ctx, buildings.zone(tomb)!).lines.at(-1)).toBe('Tomb #1 keeps no coffins ready: place them yourself [b > Furniture], or [+] to keep some.');
  });
});
