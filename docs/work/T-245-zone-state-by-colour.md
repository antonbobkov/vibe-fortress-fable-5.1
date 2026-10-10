# T-245 — Zone qualification and a room's open border are not shown by colour alone

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (§5.2, 7.15) · **Size:** S · **Needs:** — · **Status:** open

## Why

D-U10 and 24 § Accessibility say no information is conveyed by colour alone. Ghosts now differ by glyph, but a zone drag still shows qualifying tiles green and the others red with the glyph unchanged, and a room's open border is a red background only.

## Reproduction

Seed `audit-1`, default embark. `z`, `Shift+B`, drag over the rock face (all red) and over floor (all green); then select the bedroom: its border is red background (report shots 12a, 12c, 12e; [`zone-colour-only.png`](../../reports/screenshots/t-111/zone-colour-only.png)). Code: `src/ui/screens/fortress.ts:482-500` sets only the background.

## What the spec says

- [`24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Rules (accessibility): "No information is conveyed by color alone: state glyphs differ or the inspector states it in words."
- [`fortress-screen.md`](../04-implementation/ui-screens/fortress-screen.md) § Build tool: ghosts use `▒` where valid and `x` where blocked.

## What to do

**Decision.** Zone previews use the ghost convention: a qualifying tile is drawn `▒` on the green background, a tile that does not qualify `x` on the red one. A room's open-border tiles are drawn `x` on red as well, and the room panel's "Not enclosed: N open border tiles" already says it in words. The colorblind palette uses the same glyphs.

1. Amend `fortress-screen.md` (zone tool and room border) and the zones panel's help line ("tiles that qualify show green" becomes "qualifying tiles show ▒, others x").
2. Implement in `src/ui/screens/fortress.ts`.
3. Tests, `describe('T-245 …')`: the cell buffer under a zone drag and under a selected room's border has the glyphs. Render goldens that show a zone drag move; regenerate with a `golden:` paragraph.

## Done

- The reproduction shows `▒` and `x` as well as the colours.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
