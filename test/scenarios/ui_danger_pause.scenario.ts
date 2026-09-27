import { computeLayout } from '@render/cellbuffer';
import { expect } from 'vitest';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { Keymap, type KeymapRow } from '@ui/keymap';
import { Strings } from '@ui/strings';
import type { Scenario } from './runner';
import type { Speed } from '@ui/status';

/** Headless acceptance scenario: RaidArrived pauses (speed 0) and centers on edge focus. */
const scenario: Scenario = {
  id: 'ui_danger_pause',
  milestone: 6,
  seed: 'ui-danger-pause',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    let currentSpeed: Speed = 1;
    let centeredOn: { x: number; y: number; z: number } | null = null;
    const ui = defaultUiState(32);
    const host: FortressHost = {
      readers: w.readers,
      registry: w.game.registry,
      ui,
      submit: (cmd) => w.submit(cmd),
      speed: () => currentSpeed,
      setSpeed: (s) => {
        currentSpeed = s;
      },
      pan: () => {},
      changeZ: () => {},
      centerOn: (x, y, z) => {
        centeredOn = { x, y, z };
      },
      home: () => {},
      zoom: () => {},
      layout: () => computeLayout(80, 42, false),
      precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels,
      announcements: () => w.game.world.registrations.announcements,
      now: () => 1000,
    };
    const keymap = Keymap.fromRows(w.game.registry.derived<readonly KeymapRow[]>('keymap'));
    const strings = new Strings(w.game.registry);
    const screen = new FortressScreen(host, keymap, strings);
    w.game.world.onEvents((events) => screen.onEvents(events));

    expect(currentSpeed).toBe(1);

    const edgeTile = w.index(0, 10, 32);
    w.game.world.emit({
      type: 'RaidArrived',
      partyId: 1,
      faction: 'goblin',
      count: 5,
      edge: 'west',
      tile: edgeTile,
    });
    w.step(1);

    expect(currentSpeed).toBe(0);
    expect(centeredOn).toEqual({ x: 0, y: 10, z: 32 });
    expect(screen.pinned).not.toBeNull();
  },
};
export default scenario;
