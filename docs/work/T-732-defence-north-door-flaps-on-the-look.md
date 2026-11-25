# T-732 — The defence script and the fortress script's look before the all-clear flap the north door

**Source:** T-724 (`defence_year` on seed `defence-year`, cadence 20, master 847f59dd and the T-724 branch) · **Size:** S · **Needs:** — · **Status:** open

## Why

While the fortress script's watch looks at the gate before an alert comes down (`lookBeforeAllClear`, T-653), it sets the gate's doors open, the second door too, at every look (`checkFortressDefense`, step 2: `wantDoorMode` is `open` while `state.looking` is set). In the defence fortress the second door is the north door at the end of the kill corridor, and `checkDefenceRaid` sets it back to `lock_on_alert` at every look when no sally is on, with the note "north door locks on the alert again". The two scripts undo each other every `WATCH_EVERY` ticks for as long as the look lasts: `defence_year`'s notes carry 90 such lines in one run (days 77, 78, 118, 119, 153 and 158), and the north door opens and locks again each time.

The defence fortress posts no watch at the north door (`northWatch = false`, T-580), so the look has no post there to open it for; the defence script means the door to stand locked unless the squad sallies.

## What to do

Decisions:

- **The look opens only the doors with a watch post**, or the fortress script leaves `gateDoorId2` alone where `northWatch === false`; either way the defence script's relock stops being needed during a look. Pick the one that keeps the three-year runs' timeline (the sweep) unchanged: likely the `northWatch === false` guard, which only the defence fortress sets.
- **`checkDefenceRaid` relocks the north door only after its own sally** (`state.sallying` was true), so it does not fight another rule's door mode.
- Measure with `defence_seeds` (both verdict rules; living and deaths a seed against master's); the sweep if `three_years_fortress.ts` changes.

## Done

- [ ] No "north door locks on the alert again" note without a sally before it in `defence_year`'s notes.
- [ ] `defence_seeds` verdict passes; living and deaths a seed no worse than master's, pooled.
