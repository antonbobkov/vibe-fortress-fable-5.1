# T-133 - A refused malformed command cannot poison the next save

Closed by `T-133: malformed command history stays saveable`.

**Source:** T-184 and [the command-log reproduction](../../../reports/audits/2026-10-09-paused-command-log-save.md) | **Size:** S | **Needs:** none | **Status:** open (resolution proposed)

## Why and reproduction

The public paused command phase records `SetPopulationCap { n: NaN }` and its
`bad_setting` rejection. The next `roundTrip` throws because the season command
log contains `NaN`. The handler rejected the command correctly; its diagnostic
history makes the valid fortress unsavable.

## Proposed resolution

Make command-log persistence handle malformed command payloads without loosening
the general ban on non-finite simulation state. Preserve the refusal and usable
command history; valid commands and their replay remain byte-identical. Specify
how unsupported command payload values are represented or omitted in the log,
and ensure a rejected command cannot make saving throw. Do not silently change a
valid command's effects or the rejection reason. Confirm the log representation
before implementation.

## Decision

The owner accepted the proposed resolution on 2026-10-11. Unsupported values in
command history use tagged `$invalid` diagnostic records, including ignored extra
fields; finite command data, handler results and valid replay remain unchanged.
Pending refusal events carry the same diagnostic command so the queues section
cannot retain the rejected unsupported value. Markers remain plain data on load.

## Tests and spec

Failing regression first: the minimal paused refusal above, plus non-finite or
unsupported extra fields, must still allow saving and subsequent deterministic
play. Pin valid log/replay behavior. Update simulation-core.md's command-log rule
and save-format.md's commandLog encoding. All six checks, npm test and full e2e
apply to the runtime change.
