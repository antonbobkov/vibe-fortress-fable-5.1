# T-608 — Long log lines and hints can be read in full

**Source:** [T-605's audit](../../reports/audits/2026-11-18-t605-first-hour-ux.md), finding 2 · **Size:** M · **Needs:** — · **Status:** open

## Why

The log panel cuts every line at the sidebar's width with `»`, and the tooltip that should give the whole text is one row, cut again at the window's edge ("☼ Wild beasts will come. Dig a hall into rock, put a door on it, click the doo»"). The log strip wraps the newest line, but a line is cut as soon as another arrives. 18 of the 41 hints are longer than a line of 78 cells, the first-season ones among them (`hint_shelter` 206 characters, `hint_alert` 231, `hint_winter` 187, `hint_predator` 169). A new player cannot read the advice the first season depends on.

## Decisions

- **The log panel wraps.** Each entry wraps under its own text (the date column stays clear), as Help's start page wraps; a selected or clicked entry is the whole entry. Scrolling counts entries, not rows, so `PageUp` `PageDown` keep their meaning.
- **The tooltip box wraps.** A tooltip longer than the window is drawn over as many rows as it needs (at most the map view's height), above the hovered cell when there is room and below it otherwise; the status row copy stays one line.
- **The log strip** keeps its three rows and stays as it is.

## Spec sections

`02-systems/24-ui-and-input.md` § Mouse (the tooltip), § Announcements and the log; `04-implementation/ui-screens/panels.md` § Log (the wireframe and its paragraph).

## Done

A unit test draws the log panel with `hint_shelter` and finds its last word; a unit test hovers a clipped 200-character label and finds every word in the tooltip box. The e2e suite passes.
