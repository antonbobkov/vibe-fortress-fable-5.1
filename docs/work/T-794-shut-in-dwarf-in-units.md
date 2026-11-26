# T-794 — The Units list and a dwarf's view say when a dwarf is shut in

**Source:** T-784-trapped-dwarf-says-so (playtest 7, [report](../../reports/data/2026-11-26-playtest-7.md), finding 1) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-784 made the starving line say where a dwarf is shut in ("Lida Crageye is starving, shut in at (10,13,z14) with no way to food.") and the starving hint say "Food is in the stockpiles, but 1 dwarf cannot reach it: [u] lists them." The Units list does not mark such a dwarf, so "[u] lists them" means the player reads every row for the starving one. A dwarf's view still reads "-13 I am thirsty. Helps: drink they can reach; see Stocks [s]" (playtest 7, 22-thirsty-ranulf.png), which points at the stocks rather than at the wall.

## What to do

Decisions taken here:

- A dwarf for which `shutAway` (`ui/shut-in.ts`) holds for hunger or thirst, at its critical mark, shows "shut in" in the Units list's activity column, in the alert colour, and the list's `[w]`-style filter for the hurt gains a "shut in" case, or the list sorts such dwarves first.
- The dwarf's view's Helps line for hunger or thirst reads "Helps: a way out: food is stored but none is on this dwarf's side (a wall, a coffin or a locked door)" while it holds, and its Activity line keeps what 10 says.
- The check is the same one the starving line uses; it runs when the panel draws, for the dwarves at a critical hunger or thirst only.

## Done

- [ ] The Units mark and the view's Helps line; a test with a dwarf walled into a pocket and food on the surface.
- [ ] `ui-screens/panels.md` § Units and the creature view describe it.
