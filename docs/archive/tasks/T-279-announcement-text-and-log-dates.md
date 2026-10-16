# T-279 — Announcements: missing names, a flood of one line, a log with no dates, doubled words

**Closed:** 2026-10-16, in 8ea0180, e3ae597, 577a1b0, 58e2c1e.

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (issue 9) · **Size:** M · **Needs:** T-251 (it rewrites the rows of `src/ui/screens/trade_session.ts`) · **Status:** open

## Why

The log is how the game talks to the player, and four things in it are broken or noisy. Two lines print with a hole where a name belongs. One event floods the strip. No line carries a date. Trade goods repeat a word.

## Reproduction

The capture's flow 7 (seed `e2e-year`, default embark, a hunter with the hunting labor on).
- Day 8: "Oskar Stonetongue has slain victim." and "Oskar Stonetongue has brought down a ." (7/12). Strings: `announce.kill_recorded` "{killer} has slain {victim}." and `announce.hunt_kill` "{hunter} has brought down a {prey}." (`src/ui/strings.ts:1036`, `:1009`); registered in `src/systems/combat/index.ts:151` and `src/systems/foraging/index.ts:85`.
- Day 52: "Obsidian has formed. x375", "x389", "x50", "x101", "x341", "x75" as six lines (flow 7 table).
- The Log panel: no day on any line (7/34 to 7/45).
- Trade session: "3 wool cloth cloth", "8 meal easy meal" (5/95).
- The hospital hint appeared in the same slice as the hunter's kill, with no dwarf reported hurt (7/12). Its trigger is "first serious wound with no hospital".

## What the spec says

- [`event-catalog.md`](../../04-implementation/event-catalog.md): the fields of `KillRecorded` and `HuntKill`.
- [`ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md) § Announcement strings; [`panels.md`](../../04-implementation/ui-screens/panels.md) § Log; [`24-ui-and-input.md`](../../02-systems/24-ui-and-input.md) § Rules (the log, and merging repeated lines).

## What to do

**Decisions.**
- **Names.** An announcement never prints an empty or raw placeholder. `{victim}` and `{prey}` are filled with the creature's name, or "a deer" (article and species) for an unnamed animal; the name is resolved when the event is emitted, because the creature may be gone when the line is drawn. If the event lacks the field, add it to the event and to `event-catalog.md`. A hunter's kill prints one line, the hunt line ("Oskar Stonetongue has brought down a deer."), not both. A unit test formats every registered announcement with its event's fields and fails on a `{…}` left in the text or on a doubled space before the full stop.
- **Obsidian.** "Obsidian has formed." is announced at most once per day; further events that day only raise the counter of that one line.
- **Merging.** A line identical to one already in the strip within the same day raises that line's counter and does not add a line, even when other lines came between.
- **Dates.** Each Log panel row starts with the day in `text_dim`: "Sp 8" (two letters of the season, the day of the season), with the year added ("Y2 Sp 8") for lines of an earlier year. The strip at the bottom stays without dates.
- **Doubled words.** An item's display name never repeats a word: when the material's name ends with the item type's name, the type is not appended ("3 wool cloth", "8 easy meals"). The rule lives in the one function that builds item names, so Stocks, Look and trade agree.
- **The hospital hint.** `hint_hospital` fires only for a wound to a dwarf of the fortress. If the code already does this, add the test and change nothing.

1. Amend `event-catalog.md` if a field is added, `ui-keymap-and-screens.md` § Announcement strings and § Hints (`hint_hospital`'s condition), `panels.md` § Log, and 24 § Rules for the merging rule.
2. Implement in `src/systems/combat/`, `src/systems/foraging/`, the system that announces obsidian, `src/ui/announcements.ts`, `src/ui/messages.ts`, `src/ui/panels/log.ts`, the item-name function, `src/ui/hints.ts`.
3. Tests, `describe('T-279 …')`: the placeholder test over every announcement; the hunt line; the daily obsidian line; merging across other lines; the Log dates; the item names; the hint's condition. Scenario goldens that record announcements move; say which in a `golden:` paragraph.

## Done

- Flow 7 replayed shows "has brought down a deer.", one obsidian line for day 52, and dates in the Log.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green.
