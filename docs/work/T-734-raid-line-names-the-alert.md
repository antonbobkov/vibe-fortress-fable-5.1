# T-734 — A raid's danger line says nothing of the alert, and a Calm fortress of 52 loses 42 in two days

**Source:** playtest 2026-11-25 (mid game) ([report](../../reports/data/2026-11-25-playtest-3.md), finding 1) · **Size:** S · **Needs:** — · **Status:** open

## Why

A Balanced fortress of 52 dwarves (seed `playtest-1125-p2`, peril 2, the three-year script's fortress played to Summer 9 of Year 3, save `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin`) met a Gloam raid of 17 from the north on Summer 12. The alert was Calm and the 6-dwarf Gate Guard was `off`, as the fortress had been between raids for a season. The danger line read only "!! A Gloam raid has come from the north!" (`39-raid-arrives.png`). Left at Calm, the raiders shot the dwarves at work in the fields and on the stairs: two days later 10 dwarves were alive (a second try: 13), with 20 "has bled to death" lines in the log (`37-d265-log.png`, `51-no-response-population.png`). The same moment with `[m]` `[3]` (Hearth) and every squad set to Active cost 6 dwarves (`40-hearth-alert-active.png`); the three-year script, which raises the alert and keeps the gate walls, lost none to that raid.

The game pauses on the line (24 § Announcements, danger), and `hint_alert` taught the Hearth alert once, at the first `ThreatWarning` of Year 1 (`03-content/ui-keymap-and-screens.md` § Hints). Two years later, the hint long gone from the log and the squad stood down between raids, the line that pauses the game is the one place that can say what to do, and it does not.

Reproduce: load the save above (Load, then Import, or write it into the `saves` store), run about 3,650 ticks to the raid, then 2,400 more at Calm, and count the dwarves (`readers.of('10').list().length`).

## What to do

Decisions:

- **While the alert is Calm, the danger lines of `RaidArrived` and `AmbushSprung` end with what the alert does and its keys**: "A Gloam raid has come from the north! The alert is Calm: [m] [3] sends the civilians to shelter." Under Watch or Hearth they read as now. The tail is a string of its own (`announce.raid_calm_tail`), added by the announcer from 16's alert at the moment of the line, so the line in the log keeps what was true then.
- **While no squad with members is Active, the tail also names the squads**: "… [m] [3] sends the civilians to shelter; Active [v] sends the squads." With no squad at all it says "[m] [+] makes a squad."
- The status strip and the log show the whole line (it wraps in the log; the strip's `»` and tooltip rule holds).

Spec: 18 § Registrations (the `RaidArrived` and `AmbushSprung` lines), 24 § Announcements and the log.

## Done

- [ ] Tests (`describe` with the task id): a raid arriving under Calm with every squad off gives the line with both tails; under Hearth, the plain line; an ambush springing under Calm with an Active squad gives only the alert tail; no squads gives the "[+]" tail.
- [ ] `strings:check` passes with the new keys. UI only: no world hash moves.
