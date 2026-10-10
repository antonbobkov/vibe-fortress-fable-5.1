# T-252 — Two first-minute traps left by declined proposals: no axe warning, and the second `d`

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (Q1, §5.3) · **Size:** S · **Needs:** — · **Status:** open

## Why

Two parts of the first audit were declined by the U decisions and are still traps for a new player:
- **Q1.** D-U3 warns at embark only for a missing pick, food or drink. The Supplies tab itself says "two picks and one axe are the minimum for a working start", but a party without an axe embarks with no question, and without an axe there are no logs beyond the embark load: no beds, barrels or more workshops.
- **§5.3.** D-U2 keeps "pressing an open panel's own key closes it". A player who types `d` `d` for "designate, dig" (the habit the first audit described: "dig takes two presses of the same key") closes Designate with the second press. The next drag then makes an item selection that offers `[S-d] dump`, and nothing says why no dig appeared.

## Reproduction

- Q1: seed `audit-1`, embark, Supplies (`2`), set Iron axe to 0, `Enter`: the game embarks without asking (report shots 21a, 21b). Code: `src/ui/screens/embark.ts:256` checks pick, food and drink only.
- §5.3: at arrival, `d` `d`, drag over floor: "Selection 4x3 (12 tiles)  [Del] clear  [S-f] forbid  [S-d] dump  [S-t] to depot" (report shots 06b, 06c).

## What the spec says

- [`embark.md`](../04-implementation/ui-screens/embark.md) § notes: "Embarking with no pick, or with no food or no drink, asks first … default No"; [`02-embark-and-loadout.md`](../02-systems/02-embark-and-loadout.md) § Player-facing behavior.
- [`ui-keymap-and-screens.md`](../03-content/ui-keymap-and-screens.md) § Panels: "pressing an open panel's own key closes it."

## What to do

**Decisions.**
- Embark also asks "Embark without an axe?" (`c_embark_no_axe`, default No), after the pick question and before the food and drink one. This revises D-U3; the reason is the Supplies hint and the logs an axe brings.
- The toggle stays (D-U2). When a panel's own key closes it while one of its tools was armed, the status row says "Designate closed · [d] opens it again" (the panel's name and current key), so the player sees why the next drag does something else. The same applies to Build and Zones.

1. Amend `embark.md` and 02 § Player-facing behavior (the axe question), `ui-keymap-and-screens.md` § Confirmations (the new row) and § Panels (the notice).
2. Implement in `src/ui/screens/embark.ts`, `src/content/confirmations.json` (through `npm run content:export`) and `src/ui/screens/fortress.ts`.
3. Tests, `describe('T-252 …')`: the axe question and its default; the close notice.

## Done

- Both reproductions now ask or explain.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
