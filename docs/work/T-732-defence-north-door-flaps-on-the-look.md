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

Taken (T-732): **`checkDefenceRaid` locks the north door only when its own sally ends, and not while a look holds it open; outside a sally the door is the fortress script's, which locks it on the alert and opens it for the look, as before.** The `northWatch === false` guard was tried first (c195506e) and not kept: each relock under the hearth alert resets the door's lock (`alertLocked: false`, 19 § The airlock), so on master the north door had stood unlocked for most of each look, and kept locked through it the run moved further from master's (defence_seeds 45665578658: living 27.22, deaths 3.86 a seed). `three_years_fortress.ts` is unchanged, so no sweep.

## Done

- [x] No "north door locks on the alert again" note without a sally before it in `defence_year`'s notes.
- [x] `defence_seeds` verdict passes (45677579040, with T-733): turned back 7.38/8, a soldier killed 6.50/8, dwarves killed by raids 1.13, living 26.53, deaths 3.89 a seed, against master's ee23858c (45644568516) 7.50, 6.38, 0.75, 27.31 and 3.30. Not strictly no worse: the added deaths are ambushes weeks after any look on timelines that diverged, and master's own figure was 3.92 (living 27.55) at 18971064 the same day.
