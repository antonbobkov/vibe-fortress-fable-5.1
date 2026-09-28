import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';

describe('T-M7-02 reputation announcements', () => {
  it('announces only a negative reputation change and records its reason', () => {
    const game = new HeadlessGame({ seed: 'trade-announcements', world: 'flat-test' });
    const log = new AnnouncementLog(new Strings(game.registry), game.registry);
    log.register(game.world.registrations.announcements);
    expect(log.announce({ type: 'ReputationChanged', civ: 'hillfolk', delta: 2, reason: 'trade' }, game.world.readers, 1)).toBeNull();
    const negative = log.announce({ type: 'ReputationChanged', civ: 'wildwood', delta: -2, reason: 'wood_offered' }, game.world.readers, 2);
    expect(negative?.severity).toBe('note');
    expect(negative?.line.text).toContain('wood_offered');
  });
});
