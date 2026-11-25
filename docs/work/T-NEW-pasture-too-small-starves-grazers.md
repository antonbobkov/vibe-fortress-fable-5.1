# T-NEW — A pasture too small for its grazers starves them, and nothing says so

**Source:** playtest 2026-11-24 ([report](../../reports/data/2026-11-24-playtest.md), finding 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

On day 4 of a Farmstead embark (world `deep-522-1`, region 42,30) I drew a 51-tile pasture over forest floor and put the cows, goats and sheep on it with the Animals panel's `[p]`. Before that they grazed about the wagon and were only "hungry". The pasture held 35 grass; `GRASS_PER_GRAZER` is 48, so it fed none of the six, and by day 8 the log read "! An animal is starving." five times, with "Capacity: 0 grass / 6 grazers (0»" on the zone (`reports/data/2026-11-24-playtest/44-animals-starving.png`, `45-pasture-settings.png`). The forest all round was lush grass. Taking the cows off the pasture fed them again within three days.

Nothing told the player, at any step:

- The zone's capacity line is cut at the sidebar's width before the number that matters: "Capacity: 35 grass / 0 grazers (»" hides "(0 supported)" (`37-pasture.png`).
- The pasture's settings say nothing about how to put animals on it (it is the Animals panel's `[p]`).
- `[p]` in Animals moves a group onto a pasture that feeds none of it without a word.
- The alert is "An animal is starving." (`announce.animal_starving`), where 08 § Player-facing behavior says "The cow is starving": it names neither the animal nor the pasture, and it has no place to go to.
- The Animals panel's summary line reads "2 sheeps" (`pluralName` adds `s` to a species whose plural is the same word: sheep, deer).

## What to do

Decisions (UI and text only; the grazing rule stays as it is, a too-small pasture is the player's choice):

- **The capacity line fits** in 36 columns and leads with the verdict: "Feeds 0 of 6 grazers (35 grass; 48 a grazer)", in the alert colour when the grazers are more than it feeds; a second dim line under it, "Put animals here: Animals [n], [p].", while none is assigned.
- **`[p]` says what it did** on the status row: "2 cows to Pasture #1: it feeds 0 of 6 grazers." in the alert colour when it is over, "2 cows to Pasture #1." otherwise, "2 cows off the pasture." for none.
- **The starving alert names the animal and why** as 08 says: "The cow is starving." and, for a grazer on a pasture whose grass feeds fewer than it holds, "The cow is starving: Pasture #1 feeds 0 of 6 grazers." Its focus is the animal (`[v]` opens it). The once-per-animal-per-season rule stays.
- **Species plurals:** a creature row may carry a plural (`sheep`, `deer`, …) as items do (`items.json` has `plural`), and `pluralName` is used only when there is none; fill it for every creature whose plural is not the regular one.

Spec: `ui-screens/panels.md` (zone inspector, pasture; Animals tame tab), 08 § Player-facing behavior (the alert text), `creatures.md` (the plural column), `ui-keymap-and-screens.md` if a string row is listed there.

## Done

- [ ] Tests: the capacity line of a 35-grass pasture with six grazers reads "Feeds 0 of 6 grazers" in the alert colour and fits the sidebar; `[p]` onto it says so; the starving alert of a cow on that pasture names it and the pasture; "2 sheep", "3 deer" in the Animals summary.
- [ ] Content check passes with the new plural column; no world hash moves.
