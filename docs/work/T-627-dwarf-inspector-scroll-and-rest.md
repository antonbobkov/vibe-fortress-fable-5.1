# T-627 — The dwarf inspector scrolls, and its last sections

**Source:** T-622 (the dwarf inspector's identity, needs, skill bars, equipment, relations and title) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-622 gave Look's dwarf view the sections a player most needs, in the wireframe's order: identity, activity, needs (five rows), skills with bars, mood and thoughts, health, equipment, wearing, relations, title. The panel does not scroll: a line past its last row is not drawn. In the 1280×800 window the sidebar holds about 45 rows, and a dwarf with several skills, a handful of thoughts and wounds on two or three parts fills it before `Equipment`, so what a wounded soldier carries, its friends and its title are not seen while it is hurt, the moment they matter.

Three sections that 10 § Registrations lists for `creature › dwarf` are still missing: attributes, personality and productivity. The wireframe used to draw `Title … [t] change` and `Labors [l] edit`; neither key exists in Look (titles are assigned from the units panel, labors in the labor panel), and T-622 dropped them from the wireframe, but the registry order sentence under it still names `labors`.

## What to do

1. **Scroll the creature tab**: `PageUp`/`PageDown` and the wheel over the panel move it by rows, as the log and help panels do (24 § Inspection); a scroll mark on the last row says more lies below. The scroll resets when the inspected creature or the tab changes.
2. **Attributes** on one or two rows (`Str 61 Agi 48 Tou 55 …`), **personality** (the three traits by name) and **productivity** (`Productivity 85%`, 10's `dwarves.productivity`) after the skills.
3. Decide the `[t]` and `[l]` keys: either Look offers them (the title list of the units panel; the labor panel with the dwarf selected) or the registry order sentence drops `labors`.

Spec: `ui-screens/fortress-screen.md` § Inspection panel; 10 § Registrations and § Player-facing behavior; 24 § Inspection.

## Done

Tests that a wounded dwarf's `Title` line is reached by scrolling, and for each new section; the look e2e scrolls the creature tab.
