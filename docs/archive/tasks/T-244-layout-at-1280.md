# T-244 — Layout at 1280×800: embark, trade session and the status bar

Closed by `T-244: eighty-column screens preserve complete labels and numbers`.

**Source:** T-111 and its report, [`../../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../../reports/audits/2026-10-10-ui-audit-follow-up.md) (Issue 10, §5.1, 7.1, new finding N5) · **Size:** M · **Needs:** — · **Status:** open

## Why

At the audit's 1280×800 (80 columns) several screens still cut or run text together where no tooltip helps: the embark header and footer, the trade session's column headers, and the hotkey strip. The status bar also lacks the `$` caravan field the spec has.

## Reproduction

Seed `audit-1`, hilliest region, at 1280×800:
- Embark: the header ends `[3] Animals    [p]` with no "Presets"; the reroll line reads `[r] reroll (25 ☼`; on Supplies with both picks removed the footer reads `Left 23` for 236 (report shots 04, 04f).
- Fortress: status row 2 ends `[s] stocks`; Military, Labors and Orders are not in the strip (shot 05). With the tile summary shown it ends `[j] jobs  [s]` (shot 18d).
- Trade (the trade e2e fixture: `?start=flat-test&embark=default`, a depot, run to a caravan, a broker): the header row reads `Their goods    priOur goods at the depot    their valua` and the title ends `· Reputation` ([`trade-header.png`](../../../reports/screenshots/t-111/trade-header.png); shot 18f). With the caravan at the depot, status row 1 has no `$` (shot 18d).

## What the spec says

- [`embark.md`](../../04-implementation/ui-screens/embark.md): the header has `[p] Presets`; the reroll shows `[r] reroll (25 ☼)`; the footer shows `Budget … Spent … Left …`.
- [`trade-session.md`](../../04-implementation/ui-screens/trade-session.md): headers `Their goods … price` and `Our goods at the depot … value`, with "their valuation" explained in the notes.
- [`fortress-screen.md`](../../04-implementation/ui-screens/fortress-screen.md) § Status row 1: "`$` caravan present (hidden otherwise)"; § Status row 2: "the hotkey strip for the most used panels"; its wireframe strip ends with `[m] military`.

## What to do

**Decisions.**
- Every screen fits 80 columns. Where a wireframe is wider, the screen shortens spacing first, then labels, and never cuts a number. Embark: tabs closer together so `[p] Presets` fits; `[r] reroll 25 ☼`; the footer right-aligns `Spent` and `Left` so the digits always show.
- Trade: each column header is clipped to its own column with one blank before the next, and a clipped header registers a tooltip. The right header reads "their value" when "their valuation" does not fit.
- Status row 2's strip shows, in this order, as many as fit whole: `[d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look`. An entry that does not fit whole is left out, never cut. The tile summary keeps its place at the left.
- Status row 1 shows `$` while a caravan is on the map (arriving, at the depot or leaving), from 20's reader.

1. Amend `embark.md`, `trade-session.md` and `fortress-screen.md` where the wording or the strip order changes.
2. Implement in `src/ui/screens/embark.ts`, `src/ui/screens/trade_session.ts`, `src/ui/status.ts`.
3. Tests, `describe('T-244 …')`: text-buffer checks at 80 columns for the embark header and footer (with `Left` three digits), the trade header, the hotkey strip, and `$` with a caravan present. Render goldens will move; regenerate them with a `golden:` paragraph.

## Done

- At 1280×800 nothing in the reproduction is cut or run together, and `$` shows with a caravan.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
