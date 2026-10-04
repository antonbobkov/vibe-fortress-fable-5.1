import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M8-08 ToolDropped at the next stockpile', () => {
  it('keeps a pick until both labors are off and drops it only on reaching a stockpile', () => {
    const w = new TestWorld({ world: 'flat-test', embark: 'none', seed: 'interface-tool' });
    const at = w.index(4, 4, 32);
    const dwarf = w.spawnDwarf({ at });
    const pick = w.spawnItem('pick', 'copper', at);
    w.items.attachToCarrier(pick, dwarf);
    w.game.world.entities.add(dwarf, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
    const equipment = w.game.world.entities.get(dwarf, C.Equipment)!;
    w.game.world.entities.add(dwarf, C.Equipment, { ...equipment, weapon: pick });
    w.setLabor(dwarf, 'mining', false);
    w.setLabor(dwarf, 'woodcutting', true);
    w.step(1);
    expect(w.readers.entities.get(pick, C.Item)?.carriedBy).toBe(dwarf);
    w.setLabor(dwarf, 'woodcutting', false);
    w.step(1);
    expect(w.events('ToolDropped')).toHaveLength(0);
    const position = w.readers.entities.get(dwarf, C.Position)!;
    const tile = w.index(position.x, position.y, position.z);
    w.zone('stockpile', [tile]);
    w.step(1);
    expect(w.readers.entities.get(pick, C.Item)?.carriedBy).toBe(0);
    expect(w.readers.entities.get(dwarf, C.Worker)?.toolId).toBe(0);
    expect(w.readers.entities.get(dwarf, C.Equipment)?.weapon).toBe(0);
    expect(w.events('ToolDropped')).toEqual([{ type: 'ToolDropped', itemId: pick }]);
    w.step(2);
    expect(w.events('ToolDropped')).toHaveLength(1);
  });
});
