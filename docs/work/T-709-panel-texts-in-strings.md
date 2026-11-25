# T-709 — Panels draw player-facing text that is not in the strings table

**Source:** [T-703](../archive/tasks/T-703-sidebar-cut-off-facts.md), found while wrapping the panels' cut lines · **Size:** M · **Needs:** — · **Status:** open

## Why

`content-pipeline.md` § Strings: "All player-facing text is in `strings.json` keyed by a `StringKey`". Several panels still write their text in the code, so `strings:check` cannot see it, a translation or a wording pass cannot reach it, and the sidebar-fit rule (24 § Input model, the `»` line) is checked only through the drawn panel. Found in passing:

- Population (`src/ui/panels/population.ts`): `eligibilityText` (`Eligible: no · hall spirit below Content`, …), `Hall spirit: …`, `Next evaluation: …`, `Last wave: …`, `Waves so far: …`, `Last skip: …`, `{n} dwarves ({m} children)`, `Cap [-] {n} [+]`.
- Threats (`src/ui/panels/threats.ts`): `Peril {p} · Renown {r}`, `Wealth and population draw attention.`, `Raids …`, `Ambushes …`, `Thieves …`, `Pressure … (lvl n)`.
- Zones (`src/ui/panels/zones.ts`): the hospital's `Beds: … Traction: … Chests: …`, `Supplies (current / wanted):`, `Patients:`, `None`.
- Military (`src/ui/panels/military.ts`): `Squads`, `No squads yet: [+] makes one.`, `Leader …`, `Mode: …`, `Members …`, `Station …`.
- Civilizations, Depot, Mood, Overlays, Build: `Last brought: …`, `Requests [+]`, `Reputation log`, `No built trade depot.`, `Hall spirit ♥ …`, `Debug:`, `Size: w × h  [width] [height]`.

## What to do

Move each text into `UI_STRINGS` (`src/ui/strings.ts`) under a `ui.<panel>.*` key with its placeholders, as the rest of each panel already does, and draw it through `strings.get`. Keep the words as they are (the wireframes in `ui-screens/panels.md` already give them); a word that changes is a separate decision. The T-703 width scan (`test/unit/ui/t703-sidebar-fit.test.ts`) must stay green.

## Done

- [ ] No `label(…)` in `src/ui/panels/` draws a capitalised English literal or template; a test greps for it, or `strings:check` is taught to.
- [ ] The panels' existing tests pass unchanged.
