# T-NEW — The calming draught's second dose never happens in play

**Source:** T-474 (its commit; [25 Runecraft](../02-systems/25-runecraft.md) § Draughts) · **Size:** S · **Needs:** — · **Status:** open

## What was found

A calming draught is drunk only through `give_draught`, and the medic gives one only when both rests allow: the three-day rest of any draught and the seven-day rest of the calming one (`CALM_REST_DAYS`). So no dwarf is ever given a second calming draught within seven days, and the thought `dosed_again` cannot happen in play. The rule that gives it is built and pinned by a test that has a dwarf drink twice directly (`test/unit/runecraft/t474-draughts.test.ts`). T-474 kept the spec's "the longer rest allows", as the conservative reading: no automatic loop gives a Miserable dwarf a −4 thought every three days.

## What to do

Decide whether a medic waits the calming rest or only the three-day rest, and make the spec say it.

## Decisions

- If the medic waits the calming rest (as now), `dosed_again` and the `again` field of `DraughtDrunk` are dead content. The thought's row stays (a row named in `row-order.md` must exist), so say in 25 that it is never given, or give it a use.
- If the medic waits only the three-day rest, measure first: a dwarf who stays Miserable then gets +8 and −4 by turns every three days. Keep it only if mood still rises.

## Done

- The spec says which, and a test pins it.
