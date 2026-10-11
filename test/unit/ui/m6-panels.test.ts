import { computeLayout } from '@render/cellbuffer';
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { MilitaryPanel, SQUAD_PRESET_NAMES } from '@ui/panels/military';
import { deepQuote, drawThreatsPanel, ThreatsPanel, visibleThreatParties } from '@ui/panels/threats';
import type { ThreatsReader } from '@systems/threats';
import type { BuildingsReader } from '@systems/buildings';
import type { Party } from '@core/components';
import { drawZonesPanel, ZoneTool } from '@ui/panels/zones';
import { drawLookPanel } from '@ui/panels/look';
import { drawLogPanel, filterLines } from '@ui/panels/log';
import { AnnouncementLog, focusOf, type LogLine } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';
import { surface, keymap, strings } from './ui-fixture';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import type { PanelContext } from '@ui/panels/context';
import { statusFields } from '@ui/status';

describe('T-M6-16 Military, threats, health panels; combat log', () => {
  describe('Military panel', () => {
    it('creates new squad, manages members and modes', () => {
      const w = new TestWorld({ seed: 'm6-military-unit', world: 'flat-test', embark: 'none' });
      const dwarf1 = w.spawnDwarf({ at: w.index(40, 40, 32) });
      w.spawnDwarf({ at: w.index(41, 40, 32) });

      const panel = new MilitaryPanel();
      const ctx: PanelContext = {
        readers: w.readers,
        registry: w.game.registry,
        strings,
        submit: (cmd) => w.submit(cmd),
        focusOn: () => {},
        look: () => {},
        openPanel: () => {},
        shiftClick: () => false,
      };

      // Initially no squads
      expect(panel.squads(ctx)).toHaveLength(0);

      // Create new squad
      const createCmd = panel.newSquad(ctx);
      expect(createCmd).toEqual({ type: 'CreateSquad', name: SQUAD_PRESET_NAMES[0] });
      if (createCmd) w.submit(createCmd);
      w.step(1);

      expect(panel.squads(ctx)).toHaveLength(1);
      const squad = panel.selectedSquad(ctx)!;
      expect(squad.name).toBe(SQUAD_PRESET_NAMES[0]);
      expect(squad.mode).toBe('off');

      // Add members
      const add1 = panel.addMember(ctx);
      expect(add1).toBeDefined();
      if (add1) w.submit(add1);
      w.step(1);
      expect(panel.selectedSquad(ctx)!.members).toContain(dwarf1);

      // Cycle mode
      const cycleModeCmd = panel.cycleMode(ctx);
      expect(cycleModeCmd).toEqual({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' });
      if (cycleModeCmd) w.submit(cycleModeCmd);
      w.step(1);
      expect(panel.selectedSquad(ctx)!.mode).toBe('train');

      // Cycle weapon
      const cycleWeap = panel.cycleWeapon(ctx);
      expect(cycleWeap).toBeDefined();
      if (cycleWeap) w.submit(cycleWeap);
      w.step(1);
      expect(panel.selectedSquad(ctx)!.equipment.weaponClass).toBe('axe');

      // Cycle armor
      const cycleArm = panel.cycleArmor(ctx);
      expect(cycleArm).toBeDefined();
      if (cycleArm) w.submit(cycleArm);
      w.step(1);
      expect(panel.selectedSquad(ctx)!.equipment.armor).toBe('metal');

      // Toggle ranged
      const toggleR = panel.toggleRanged(ctx);
      expect(toggleR).toBeDefined();
      if (toggleR) w.submit(toggleR);
      w.step(1);
      expect(panel.selectedSquad(ctx)!.equipment.ranged).toBe(true);

      // Set station
      const stationTile = w.index(45, 45, 32);
      panel.setStation(ctx, stationTile);
      w.step(1);
      expect(panel.selectedSquad(ctx)!.station).toBe(stationTile);

      // Clear station
      const clearSt = panel.clearStation(ctx);
      expect(clearSt).toBeDefined();
      if (clearSt) w.submit(clearSt);
      w.step(1);
      expect(panel.selectedSquad(ctx)!.station).toBeNull();
    });

    it('disband squad confirmation callback', () => {
      const w = new TestWorld({ seed: 'm6-military-disband', world: 'flat-test', embark: 'none' });
      const panel = new MilitaryPanel();
      const ctx: PanelContext = {
        readers: w.readers,
        registry: w.game.registry,
        strings,
        submit: (cmd) => w.submit(cmd),
        focusOn: () => {},
        look: () => {},
        openPanel: () => {},
        shiftClick: () => false,
      };

      w.submit({ type: 'CreateSquad', name: 'Alpha' });
      w.step(1);
      expect(panel.squads(ctx)).toHaveLength(1);

      let confirmId = '';
      const mockHost: Partial<FortressHost> = {
        submit: (cmd) => w.submit(cmd),
        confirm: (id, _params, answer) => {
          confirmId = id;
          answer(true);
        },
      };

      panel.disbandSquad(ctx, mockHost as FortressHost);
      expect(confirmId).toBe('c_disband_squad');
      w.step(1);
      expect(panel.squads(ctx)).toHaveLength(0);
    });

    it('key handling handles alert setting and squad commands', () => {
      const w = new TestWorld({ seed: 'm6-military-keys', world: 'flat-test', embark: 'none' });
      const panel = new MilitaryPanel();
      const ctx: PanelContext = {
        readers: w.readers,
        registry: w.game.registry,
        strings,
        submit: (cmd) => w.submit(cmd),
        focusOn: () => {},
        look: () => {},
        openPanel: () => {},
        shiftClick: () => false,
      };

      // Press 3 sets alert hearth
      const handledAlert = panel.key(ctx, { key: '3', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
      expect(handledAlert).toBe(true);
      w.step(1);
      expect((w.readers.of('16') as import('@systems/combat').CombatReader).alert()).toBe('hearth');

      // Press 1 sets alert calm
      panel.key(ctx, { key: '1', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
      w.step(1);
      expect((w.readers.of('16') as import('@systems/combat').CombatReader).alert()).toBe('calm');

      // U-03 (D-U2): `s` opens Stocks, so it is not the panel's; `[S-s]` enters settingStation mode.
      expect(panel.key(ctx, { key: 's', repeat: false, shift: false, ctrl: false, alt: false, meta: false })).toBe(false);
      expect(panel.settingStation).toBe(false);
      panel.key(ctx, { key: 'S', repeat: false, shift: true, ctrl: false, alt: false, meta: false });
      expect(panel.settingStation).toBe(true);
      panel.cancel();
      expect(panel.settingStation).toBe(false);
    });
  });

  describe('Threats panel', () => {
    it('keeps an unspotted stealthed party and caravans out of active threats', () => {
      const reader: Pick<ThreatsReader, 'activeParties' | 'party' | 'isStealthed' | 'isSpotted'> = {
        activeParties: () => [1, 2, 3],
        party: (id) => ({ purpose: id === 3 ? 'caravan' : 'raid', members: [id + 10] }) as Party,
        isStealthed: (id) => id === 11,
        isSpotted: () => false,
      };
      expect(visibleThreatParties(reader)).toEqual([2]);
    });
    it('deep quotes match level specification', () => {
      expect(deepQuote(0)).toContain('not yet noticed');
      expect(deepQuote(1)).toContain('pale metal');
      expect(deepQuote(2)).toContain('hunters');
      expect(deepQuote(3)).toContain('wyrm');
      expect(deepQuote(4)).toContain('opens its mouth');
    });

    it('renders threats panel with peril, renown, and caverns', () => {
      const w = new TestWorld({ seed: 'm6-threats-render', world: 'flat-test', embark: 'none' });
      const panel = new ThreatsPanel();
      const ctx: PanelContext = {
        readers: w.readers,
        registry: w.game.registry,
        strings,
        submit: (cmd) => w.submit(cmd),
        focusOn: () => {},
        look: () => {},
        openPanel: () => {},
        shiftClick: () => false,
      };
      const s = surface(36, 32);
      drawThreatsPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, panel, ctx);
      const text = s.lines().join('\n');
      expect(text).toContain('Peril');
      expect(text).toContain('Renown');
      expect(text).toContain('Active: none');
      expect(text).toContain('Caverns');
    });

    it('D-175: discovery persists and unlocks the Deep gauge at zero pressure', () => {
      const w = new TestWorld({ seed: 'm6-deep-gauge', world: 'flat-test', embark: 'none' });
      const ui = defaultUiState(32);
      ui.deepFound = true;
      const restored = defaultUiState(32);
      fromSaved(restored, toSaved(ui, []));
      expect(restored.deepFound).toBe(true);
      const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
        submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
      const s = surface(36, 32);
      drawThreatsPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, new ThreatsPanel(), ctx, restored.deepFound);
      expect(s.lines().join('\n')).toContain('The Deep');
    });
  });

  describe('Hospital zone settings', () => {
    it('shows patient and hostile counts in the status bar only when present', () => {
      const w = new TestWorld({ seed: 'm6-status', world: 'flat-test', embark: 'none' });
      const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
      const hostile = w.spawnCreature('trollkin', w.index(11, 10, 32), 'hostile:gloam');
      w.game.world.entities.add(dwarf, C.Patient, { hospitalZoneId: 0, bedId: 0, needs: ['stop_bleeding'], admittedTick: 0 });
      w.game.world.entities.add(hostile, C.Hostile, { partyId: 0, role: 'raider', behaviorState: 'attack', stealthed: false, spotted: true, breakingDoorId: 0, breakingSince: 0 });
      const fields = statusFields(w.readers, strings, 32, 1);
      expect(fields).toContain('+1');
      expect(fields).toContain('!1');
      const hostileComponent = w.game.world.entities.get(hostile, C.Hostile)!;
      hostileComponent.stealthed = true;
      hostileComponent.spotted = false;
      expect(statusFields(w.readers, strings, 32, 1)).not.toContain('!1');
    });
    it('renders beds, traction benches, chests, supplies, and patients', () => {
      const w = new TestWorld({ seed: 'm6-hospital-zone', world: 'flat-test', embark: 'none' });
      const t1 = w.index(10, 10, 32);
      const t2 = w.index(11, 10, 32);
      const t3 = w.index(12, 10, 32);
      const zoneId = w.zone('hospital', [t1, t2, t3]);

      w.build('bed', t1, 'pine');
      w.build('chest', t2, 'granite');
      w.step(1);

      const tool = new ZoneTool();
      tool.selected = zoneId;

      const ctx: PanelContext = {
        readers: w.readers,
        registry: w.game.registry,
        strings,
        submit: (cmd) => w.submit(cmd),
        focusOn: () => {},
        look: () => {},
        openPanel: () => {},
        shiftClick: () => false,
      };

      const s = surface(36, 32);
      drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, tool, ctx);
      const text = s.lines().join('\n');

      expect(text).toContain('Beds: 1');
      expect(text).toContain('Chests: 1');
      expect(text).toContain('Cloth: 0/10');
      expect(text).toContain('Thread: 0/5');
      expect(text).toContain('Patients:');
      expect(text).toContain('None');
    });
  });

  describe('Look panel & diagnosis rule', () => {
    it('undiagnosed patient displays only "Health: Wounded, bleeding" or "Health: Wounded"', () => {
      const w = new TestWorld({ seed: 'm6-look-undiagnosed', world: 'flat-test', embark: 'none' });
      const tile = w.index(10, 10, 32);
      const id = w.spawnDwarf({ at: tile });

      // Add wound with bleeding
      const body = w.game.world.entities.get(id, C.Body)!;
      body.parts[2]!.wounds.push({
        type: 'cut',
        severity: 'serious',
        bleed: 3,
        pain: 15,
        healRemaining: 1000,
        damage: 10,
        bandaged: false,
        sutured: false,
        splinted: false,
        cleaned: false,
        dressed: false,
        infected: false,
        infectedSince: 0,
        createdTick: 0,
      });
      body.diagnosed = false;
      // Mark as patient
      w.game.world.entities.add(id, C.Patient, { hospitalZoneId: 1, bedId: 0, needs: ['stop_bleeding'], admittedTick: 0 });

      const s = surface(36, 32);
      drawLookPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, w.readers, w.game.registry, strings, tile, 2);
      const text = s.lines().join('\n');

      expect(text).toContain('Health: Wounded, bleeding');
      expect(text).not.toContain('hp');
      expect(text).not.toContain('serious cut');

      // Now diagnose patient
      body.diagnosed = true;
      const s2 = surface(36, 32);
      drawLookPanel(s2, { col: 0, row: 0, cols: 36, rows: 32 }, w.readers, w.game.registry, strings, tile, 2);
      const text2 = s2.lines().join('\n');

      expect(text2).toContain('Blood');
      expect(text2).toContain('Pain');
      expect(text2).toContain('serious cut');
    });
  });

  describe('Combat log tab', () => {
    it('centers an ambush danger line on a visible party member', () => {
      const w = new TestWorld({ seed: 'm6-ambush-focus', world: 'flat-test', embark: 'none' });
      const tile = w.index(12, 10, 32);
      const member = w.spawnCreature('trollkin', tile, 'hostile:gloam');
      const partyId = w.game.world.entities.create('party');
      w.game.world.entities.add(partyId, C.Party, { purpose: 'ambush', members: [member] } as Party);
      expect(focusOf({ type: 'AmbushSprung', partyId }, w.readers)).toBe(tile);
    });
    it('T-217: centers a workshop announcement on the workshop first footprint tile', () => {
      const w = new TestWorld({ seed: 'm6-workshop-focus', world: 'flat-test', embark: 'none' });
      const still = w.build('still', w.index(15, 15, 32));
      const building = w.readers.of<BuildingsReader>('14').get(still);
      expect(building).toBeDefined();
      const log = new AnnouncementLog(strings, w.game.registry);
      log.register(w.game.world.registrations.announcements);
      const event = { type: 'WorkshopBlocked', workshopId: still, reason: 'no_empty_container', container: 'barrel' } as const;
      expect(focusOf(event, w.readers)).toBe(building!.footprint[0]);
      const announced = log.announce(event, w.readers, 1);
      expect(announced?.focus).toBe(building!.footprint[0]);
    });
    it('D-178: death and raid outcome severities interrupt only for the named danger', () => {
      const w = new TestWorld({ seed: 'm6-announcement-severity', world: 'flat-test', embark: 'none' });
      const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
      const animal = w.spawnCreature('wolf', w.index(11, 10, 32), 'wild');
      const log = new AnnouncementLog(strings, w.game.registry);
      log.register(w.game.world.registrations.announcements);
      expect(log.announce({ type: 'CreatureDied', id: animal, name: 'wolf', cause: 'wounds' }, w.readers, 1)?.severity).toBe('note');
      expect(log.announce({ type: 'CreatureDied', id: dwarf, name: 'Ketil', cause: 'wounds' }, w.readers, 2)?.severity).toBe('danger');
      expect(log.announce({ type: 'RaidEnded', partyId: 1, outcome: 'repelled' }, w.readers, 3)?.severity).toBe('note');
      expect(log.announce({ type: 'RaidEnded', partyId: 2, outcome: 'looted' }, w.readers, 4)?.severity).toBe('alert');
      expect(log.announce({ type: 'MonsterSpawned', id: animal, cavern: 1 }, w.readers, 5)?.severity).toBe('note');
    });
    it('D-176: only the first attack of a pair alerts; combat category survives save', () => {
      const w = new TestWorld({ seed: 'm6-combat-log', world: 'flat-test', embark: 'none' });
      const attackerId = w.spawnDwarf({ at: w.index(10, 10, 32) });
      const defenderId = w.spawnDwarf({ at: w.index(11, 10, 32) });
      const log = new AnnouncementLog(strings, w.game.registry);
      log.register(w.game.world.registrations.announcements);
      const attack = { type: 'AttackResolved', attackerId, defenderId, part: 'torso', damageType: 'blunt', amount: 1, outcome: 'hit' } as const;
      expect(log.announce(attack, w.readers, 1)?.severity).toBe('alert');
      expect(log.lines[0]?.text).toContain(': 1 blunt.');
      expect(log.announce(attack, w.readers, 2)?.severity).toBe('note');
      const saved = toSaved(defaultUiState(32), log.lines);
      const restored = fromSaved(defaultUiState(32), saved);
      expect(filterLines(restored, 2)).toHaveLength(2);
    });
    it('filters lines by category combat', () => {
      const lines: LogLine[] = [
        { text: 'A wild boar appeared', severity: 'note', tick: 1, count: 1 },
        { text: 'Ketil swings at Goblin!', severity: 'note', tick: 2, category: 'combat', count: 1 },
        { text: 'Raid arrived!!', severity: 'danger', tick: 3, count: 1 },
      ];

      expect(filterLines(lines, 0)).toHaveLength(3);
      expect(filterLines(lines, 1)).toHaveLength(1);
      const combatLines = filterLines(lines, 2);
      expect(combatLines).toHaveLength(1);
      expect(combatLines[0]?.text).toBe('Ketil swings at Goblin!');
    });

    it('renders header tabs [1] All  [2] Alerts  [3] Combat', () => {
      const s = surface(36, 32);
      drawLogPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, [], 0, strings, () => {});
      expect(s.lines()[0]).toContain('[1] All  [2] Alerts  [3] Combat');
    });
  });

  describe('Deepsilver confirmation dialog gate', () => {
    it('commit gates designate on c_deepsilver dialog when unconfirmed deepsilver is in rect', () => {
      const w = new TestWorld({ seed: 'm6-deepsilver-gate', world: 'flat-test', embark: 'none' });
      const deepsilver = w.game.registry.table('materials').index('deepsilver_ore');

      const t1 = w.index(10, 10, 31);
      w.game.world.services.terrain.setKind(t1, TileKind.Wall, deepsilver);
      w.game.world.services.terrain.setFlag(t1, TileFlag.Discovered, true);

      let confirmTriggered = false;
      let answerYes = false;
      const host: FortressHost = {
        readers: w.readers,
        registry: w.game.registry,
        ui: defaultUiState(31),
        submit: (cmd) => w.submit(cmd),
        speed: () => 1,
        setSpeed: () => {},
        pan: () => {},
        changeZ: () => {},
        centerOn: () => {},
        home: () => {},
        zoom: () => {},
        layout: () => computeLayout(80, 42, false),
        precondition: () => true,
        registeredPanels: () => w.game.world.registrations.panels,
        announcements: () => w.game.world.registrations.announcements,
        now: () => 1000,
        confirm: (id, _params, answer) => {
          if (id === 'c_deepsilver') {
            confirmTriggered = true;
            answer(answerYes);
          }
        },
      };

      const screen = new FortressScreen(host, keymap, strings);
      screen.tool.choose('d');
      screen.onEvents([{ type: 'VeinFound', material: 'deepsilver_ore', tile: t1, finderId: 0 }]);
      expect(screen.ui.deepFound).toBe(true);

      expect(w.readers.fortress.state.deepsilverConfirmed).toBe(false);

      // Commit over deepsilver tile
      screen.commit({ x: 10, y: 10, z: 31 }, { x: 10, y: 10, z: 31 });

      expect(confirmTriggered).toBe(true);
      w.step(1);
      expect(w.readers.fortress.state.deepsilverConfirmed).toBe(false);
      expect(w.readers.map.designationAt(t1)).toBe(0);
      answerYes = true;
      screen.commit({ x: 10, y: 10, z: 31 }, { x: 10, y: 10, z: 31 });
      w.step(1);
      expect(w.readers.fortress.state.deepsilverConfirmed).toBe(true);
      expect(w.readers.map.designationAt(t1)).toBeDefined();
    });
  });
});
