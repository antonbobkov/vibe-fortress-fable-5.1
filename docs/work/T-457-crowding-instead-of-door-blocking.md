# T-457 — Crowding slows creatures; a door no longer blocks

**Source:** the owner, 2026-10-31 · **Size:** M · **Needs:** T-455 · **Status:** open

## Why

The owner wants any number of creatures to share a tile, doors included, with a crowded tile slowing movement and actions. A standing creature on a door tile stops every walker today (22 § Movement helper). That rule has caused jobs to stick behind someone in a doorway (T-406, T-409), and it is the only rule left that keeps creatures apart. A slowdown keeps some of its value: a packed doorway is still a poor place to be, but nothing is ever blocked for good.

## Decisions

1. **The door rule goes.**
   - `blockedByCreature` no longer stops a walker at a door. Remove the check and its callers if nothing else uses it.
   - Remove the job board's crowded wait (`crowdedAt`, the `crowdedTile` unclaim and 11's retry rule for it), and T-406's move off a door tile if it has no other use.
   - A door still does not lock or close on a creature in it (14). Locked doors, walls and hatches still stop walkers as before.
2. **Crowding counts creatures on one tile.** A tile's crowd is the number of standing creatures on it, the mover or worker included. A creature lying down does not count (T-409's `liesDown`). Hostile and friendly count alike.
3. **Movement slows.** A step onto a tile takes longer with its crowd: `CROWD_FREE` creatures cost nothing (start at 2), and each one beyond that adds `CROWD_STEP_PERCENT` to the step's time (start at 25%), up to `CROWD_MAX_PERCENT` (start at 100%, twice the time).
4. **Actions slow by the same factor.** Job work, eating, drinking, treating and attack timing on a crowded tile take longer, by the crowd of the tile the actor stands on. Use one shared helper, so the rule is stated once. Whether combat uses the same factor is measured: if it moves the duel figures of T-404 in the open (a duel is two or three creatures on separate tiles, so it should not), report it.
5. **Cost.** The count comes from the spatial index, which the mover already reads. It must stay cheap, so confirm it with the per-system timing tests.
6. **Display.** A tile with several creatures shows a count or cycles its occupants, so a crowd can be seen. The Look panel already lists them. Crowds are drawn by the renderer only.
7. **Spec first:** 22 § Movement helper, 11 § Blocking, 10 and 16 (timing), and the display in 23. All three constants are marked unmeasured.

## Done

- **Unit tests:**
  - walkers pass a standing creature in a doorway;
  - a step and a job take longer at each crowd size, up to the cap;
  - a creature lying down adds nothing;
  - a locked door still stops walkers.
- **Measured:** the annual instrument by the T-308 rule, pp_defence, and the whole twenty-seed file by the set rule. Report the rows against the current ones, plus how long crowds last at doors and the hearth hall. A raid's timing through a gate may move, so report party deaths.
- The six static checks, `npm test`, e2e and the per-system timing tests pass.
