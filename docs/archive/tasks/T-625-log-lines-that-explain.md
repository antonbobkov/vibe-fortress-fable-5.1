# T-625 — Log lines that say why: deaths, immigrants, miasma, a breach

**Closed:** 2026-11-19, in c76d2d42,e1bb6c54.

**Source:** [T-618's first-year audit](../../../reports/audits/2026-11-18-t618-first-year-ux.md), findings 16–20 · **Size:** M · **Needs:** — · **Status:** open

## Why

The first year's important lines leave out what the player needs next:

- **A death** reads "!! Ivar Coaleye has died." whatever the cause. The event carries it (`bled_out`, `starvation`, `infection`, `frozen`, `bridge_crush`, a killer); 17's own example is "Ketil Ironvein has bled to death", and the legend's last words are a list of "has died".
- **Immigrants** arrive as "! 3 dwarves have come to join the hall." with no names or skills; Units lists them at the end without professions, and Look shows no profession either.
- **"! Miasma spreads." ×9** says nothing of where or why (finding 2 of the food work file names its cause; this one its place).
- **A breach** ("! A cavern has been breached.", Spring 8, two levels below the surface) centres the view on the cavern with nothing marked (T-605 finding 22), and the cavern's creatures are then "!4" on the status row with no line on how they could come in.
- **The Log panel** opened a fortnight later still shows the entry chosen then, at the top, with today's lines above the window; the Mood panel cuts each top thought to ten letters ("+5 Had a fi") with no `»`.

## What to do

1. `CreatureDied` lines by cause: "bled to death", "starved", "died of an infection", "froze", "was crushed by a bridge", "was killed by a boar".
2. The immigrants line names them with their best skill when they fit ("Vigga Pinegate (Farming 5), Ivar Coaleye (Woodcutting 3) and Ottar Brightfist have come to join the hall."), else the count with "[u] lists them".
3. "Miasma spreads." names the tile's room or zone and its focus is a rotting item.
4. A breach puts the map cursor on its tile; Threats' cavern row says "breached at (84,73,z22)".
5. The Log panel opens on the newest entry unless the player chose one since the panel last opened; the Mood panel wraps the top thoughts over two rows as its wireframe does, or marks the cut with `»` and a tooltip.

Spec: 17 § Announcements, 21 § Announcements, 13 § Rot (miasma), 03 § Caverns, 24 § Announcements and the log, `ui-screens/panels.md` § Mood and § Log.

## Done

Tests for each line; the log's reopening rule pinned.
