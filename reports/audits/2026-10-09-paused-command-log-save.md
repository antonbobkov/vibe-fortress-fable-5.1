# A refused malformed command can make the next save fail

Measured in the worktree based on `84dcbce`, with the deferred-terrain save fix applied, while adding paused command continuation coverage. The
initial catalog probe submitted rejected boundary cases before its first accepted
command. Saving then threw `SerializationError: non-finite number in state: NaN`
from `gameSections` while serializing the command log, before its queues section.
This differs from the missing deferred terrain batch addressed by the current fix.

A small reproduction, using the public paused command path:

```ts
const game = new HeadlessGame({ seed: 'malformed-log-save', world: 'flat-test', embark: 'default' });
game.world.submit({ type: 'SetPopulationCap', n: NaN });
game.world.commandPhase(true); // refused: bad_setting
roundTrip(game); // throws: non-finite number in state: NaN
```

`World.commandPhase` appends the original command and its rejection to the log.
The command handler leaves valid simulation state, but the logged payload still
contains `NaN`. `serializeValue` correctly refuses a non-finite saved number. The
same problem can affect deliberately malformed extra fields and other refused
commands; those variants have not been measured here.

Filed as T-133. The catalog continuation suite searches for an accepted command
without logging malformed candidates, then submits that accepted command through
the paused command phase in a fresh copy of its synthetic fortress. It still
compares the unsaved and loaded hash after every resumed tick.
