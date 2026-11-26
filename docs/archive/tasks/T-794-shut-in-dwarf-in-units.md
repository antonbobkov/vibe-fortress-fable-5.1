# T-794 — The Units list and a dwarf's view say when a dwarf is shut in

**Closed:** 2026-11-26, in 3c1d4eab.

**Source:** T-784-trapped-dwarf-says-so (playtest 7, [report](../../../reports/data/2026-11-26-playtest-7.md), finding 1) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-784 made the starving line say where a dwarf is shut in ("Lida Crageye is starving, shut in at (10,13,z14) with no way to food.") and the starving hint say "Food is in the stockpiles, but 1 dwarf cannot reach it: [u] lists them." The Units list does not mark such a dwarf, so "[u] lists them" means the player reads every row for the starving one. A dwarf's view still reads "-13 I am thirsty. Helps: drink they can reach; see Stocks [s]" (playtest 7, 22-thirsty-ranulf.png), which points at the stocks rather than at the wall.

## What to do

Decisions taken here:

- A dwarf for which `shutAway` (`ui/shut-in.ts`) holds for hunger or thirst, at its critical mark, shows "shut in" in the Units list's activity column, in the alert colour, and the list's `[w]`-style filter for the hurt gains a "shut in" case, or the list sorts such dwarves first.
- The dwarf's view's Helps line for hunger or thirst reads "Helps: a way out: food is stored but none is on this dwarf's side (a wall, a coffin or a locked door)" while it holds, and its Activity line keeps what 10 says.
- The check is the same one the starving line uses; it runs when the panel draws, for the dwarves at a critical hunger or thirst only.

## Decisions made in the work

- **Both, not either.** The Units list shows "Shut in" (`ui.units.shut_in`) in the alert colour in place of the activity, and puts such dwarves first on the Dwarves tab, before the `[w]` wounded order; no new filter key. The All tab gives a dwarf's activity as the Dwarves tab does, so it reads "Shut in" there too, in the alert colour, without the reordering. A dwarf that is down reads as down.
- **The check** (`shutInNeed`, `shutInFrom` in `ui/shut-in.ts`) is `shutAway` for hunger or thirst at 10's critical mark, skipping a dwarf whose brain is on its way to serve that need (a brook or a well on its side serves thirst without a stored drink). It runs as the panels draw, and calls the reach search only for a dwarf at a critical mark.
- **The Helps line** is per need: under `hungry` "a way out: food is stored but none is on this dwarf's side (a wall, a coffin or a locked door)", under `thirsty` the same with drink. It shows in the creature view and in the Mood panel's per-dwarf rows (both are "a dwarf's view"); the Mood summary, which speaks for many dwarves, keeps the stocks text. The view's Activity line is unchanged.

## Done

- [x] The Units mark and the view's Helps line; a test with a dwarf walled into a pocket and food on the surface (`test/unit/ui/t794-shut-in-units.test.ts`).
- [x] `ui-screens/panels.md` § Units and § Mood, and `fortress-screen.md` § Sidebar open and the creature view, describe it.
