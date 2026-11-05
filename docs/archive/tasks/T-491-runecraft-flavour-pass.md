# T-491 — Runecraft flavour pass: small fun rules brought back

**Closed:** 2026-11-04, in 36c2d042.

**Source:** [flavour report](../../../reports/audits/2026-11-03-flavour-left-out.md) (items 4, 5, 6, 9, 10, 14, 15, 16), the owner on 2026-11-04 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner asked for the fun magic features cut for cost to come back where they add little complexity. Each is a small rule on a seam that now exists. Each is a fun feature: removable if it breaks game logic ([`docs/fun-features.md`](../../fun-features.md)).

## What to do

Each item is its own rule in 25, with a test. None may draw on an existing stream or move anything with no runecraft in play.

1. **`rune_sick`** (item 4): a caster with no rune left, a hostile adjacent and three vials drunk today may drink a fourth. It gives half a vial's rune and the thought "Too much rune. My teeth hum." (−4, 24 h).
2. **`dosed_again`** (item 5): the medic waits only the ordinary 3-day draught rest for a calming draught, not 7 days. A second calming draught within 7 days eases less (half) and gives "Another draught. I am tired of draughts." (−4, 72 h). The mood floor of 20 holds.
3. **`blaze` lights the tile** (item 6): a hit from a `blaze` weapon has a 2% chance to light the target's tile through 05's ordinary ignition, if it can burn. One draw on stream 25, only for a blaze hit. The tile may be your own wooden floor.
4. **`saw_wisp`** (item 9): on a wisp appearing (`wisp_loose` or a wisp called), fortress dwarves within 8 tiles with line of sight get "Saw a light that was not a lamp." (+2, 24 h), at most once a day. Event-based, no scan.
5. **The firebloom's flash** (item 10): its 3×3 shows in `ember_orange` for one frame when it blooms. Render only, no state.
6. **A turned shade hides** (item 14): a deep shade that comes through turned arrives stealthed, like a hollow stalker, until it is spotted.
7. **`lab_stink`** (item 15): a spoiled batch gives fortress dwarves who pass within 3 tiles of that laboratory the rest of the day "The laboratory stinks." (−1, 12 h). Event plus a short-lived marker, no 13 rot pass.
8. **The Wildwood and staffs** (item 16): a staff or wand offered to the Wildwood counts as a wooden item for their offence (−2 reputation each, low value), as a wand already does.

## Done

- Each rule has a test, and its row and text are in 25 and `03-content`.
- With no runecraft in play nothing moves: the six no-channel digests, `pp_defence` and the annual instrument are unchanged.
- Each is listed in `docs/fun-features.md` § In the game, with where it lives.
