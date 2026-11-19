# T-NEW — The first key after a danger acts, and combat does not drown the Alerts tab

**Source:** [T-635's mid-game audit](../../reports/audits/2026-11-19-t635-midgame-ux.md), findings 2, 7 and 8 · **Size:** M · **Needs:** — · **Status:** open

## Why

- **The key after a danger is lost.** A danger line ("!! A raid has arrived!", a death) pins itself to the log strip "until dismissed by any key" (24 § Announcements), and `FortressScreen.key` returns at once after unpinning: the key does nothing else. In the audit, `m` pressed to raise the alert after a raid, and `a`, `u`, `s` after a death, each did nothing the first time; a player in the middle of a raid presses the key again and does not know why the first was ignored.
- **Combat floods the alerts.** The first blow between each attacker and defender is an alert (16 § Combat log). A raid of ten with four dogs and the caravan's guards made 30 alert lines in the first minute ("! A gloam archer hits a mule: 13 pierce.", "! Dog hits gloam_captain: 0 edge."); the Alerts tab, which a player opens to see what needs them, held nothing else, and the raid's own line was a screen down.
- **The same death is told twice**: "A hillfolk bandit has slain Halvar Ironfell." (`KillRecorded`, a note) under "!! Halvar Ironfell has been killed by a hillfolk bandit." (`CreatureDied`, a danger). A blow that does no damage is a line of its own ("0 edge").

## What to do

1. A key that dismisses a pinned danger line also does what it does, except `Space` and `Esc`, which only dismiss (a player who presses Space to read the line should not unpause the game by it). Spec: 24 § Announcements ("the strip shows the line until dismissed by any key; the key then acts, but Space and Esc only dismiss").
2. Combat lines go to the Combat tab only, as notes; the Alerts tab keeps one line per engagement of the fortress ("! The Gate Guard is fighting 9 gloam at the north gate." or "! Gloam raiders are fighting dwarves near (31,4,z32)."), refreshed rather than repeated. The danger lines (a death, the raid's arrival) stay.
3. `KillRecorded` of a fortress dwarf killed is not a separate line when its `CreatureDied` line names the killer.
4. A hit of 0 damage reads "… hits … but does no harm." or is folded into the blocked lines.

Spec: 16 § Combat log, 24 § Announcements.

## Done

Tests: a danger pinned, then `m` opens Military; `Space` only dismisses. A raid of several pairs makes one Alerts line and many Combat lines. A dwarf's death by a raider is one line.
