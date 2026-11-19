# T-614 — The log panel's filter field

**Source:** T-608 (the log panel wraps; `04-implementation/ui-screens/panels.md` § Log) · **Size:** S · **Needs:** — · **Status:** open

## Why

The Log wireframe has a `/filter: ____` row under the tabs, but the panel draws a blank row there and `/` does nothing in it. Now that a hint takes up to nine rows of the panel, a player looking for one old line (a caravan, a death) has to page through every entry; jobs and stocks already have a filter field.

## Decisions

- **The log panel gets the filter field the wireframe shows**, the shared one of jobs and stocks: `/` focuses it, letters are text while it has focus, and it is cleared when the panel closes (24 § Input model). It keeps the entries whose text contains the typed text, ignoring case, within the chosen tab.
- **Typing selects the newest matching entry**, unmarked, as choosing another tab does.

## Spec sections

`02-systems/24-ui-and-input.md` § Panels (the filter field list: units, jobs, stocks, log) and § Announcements and the log; `04-implementation/ui-screens/panels.md` § Log; `03-content/ui-keymap-and-screens.md` § Log panel.

## Done

A unit test types a word into the log panel's filter and finds only the entries that contain it; `Esc` and closing the panel clear it. The e2e suite passes.
