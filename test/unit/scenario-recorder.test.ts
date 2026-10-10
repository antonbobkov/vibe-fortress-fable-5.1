import { describe, expect, it } from 'vitest';
import { recordWorlds } from '../scenarios/recorder';
import { TestWorld } from '../scenarios/test-world';

function play() {
  const w = new TestWorld({ seed: 't157-recorder', world: 'flat-test', embark: 'none' });
  expect(w.game.world.applyCommand({ type: 'RenameFortress', name: 'Recorded' }).ok).toBe(true);
  expect(w.game.world.applyCommand({ type: 'ReleaseCage', cageBuildingId: 0 }).ok).toBe(false);
  w.build('bed', w.index(20, 20, 32), 'oak');
  return w;
}

describe('T-157 scenario recorder', () => {
  it('records accepted commands and delivered events without changing the world hash', () => {
    const plain = play();
    plain.step(20);
    const recorder = recordWorlds();
    try {
      const recorded = play();
      expect(recorder.coverage.commands.has('ReleaseCage')).toBe(false);
      expect(recorder.coverage.commands.has('RenameFortress')).toBe(true);
      expect(recorder.coverage.events.has('BuildingCompleted')).toBe(false);
      recorded.step(20);
      expect(recorder.coverage.events.has('BuildingCompleted')).toBe(true);
      expect(recorder.coverage.buildings.has('bed')).toBe(true);
      expect(recorded.hash()).toBe(plain.hash());
    } finally {
      recorder.dispose();
    }
    const before = [...recorder.coverage.commands];
    const later = new TestWorld({ seed: 't157-after-dispose', world: 'flat-test', embark: 'none' });
    later.game.world.applyCommand({ type: 'CreateSquad', name: 'Unrecorded' });
    later.step(1);
    expect([...recorder.coverage.commands]).toEqual(before);
  });
});
