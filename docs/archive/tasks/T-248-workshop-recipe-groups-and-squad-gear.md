# T-248 — Workshop recipes grouped by output; squad gear chosen from a list

Closed by `T-248: group workshop recipes and choose squad gear from lists`.

**Source:** T-111 and its report, [`../../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../../reports/audits/2026-10-10-ui-audit-follow-up.md) (7.6, 7.9) · **Size:** S · **Needs:** — · **Status:** open

## Why

Two panels still differ from their wireframes. The workshop panel lists all its recipes in one flat list (27 at a carpenter's), while the order picker already groups them. The squad's weapon and armor cycle through values one key press at a time instead of opening a list.

## Reproduction

Seed `audit-1`, default embark. Place a carpenter's workshop, run until it is built, click it: `─── Recipes ───` then 27 rows from Archery target to Wooden blocks (report shot 10a); `Shift+N` shows the same recipes grouped under Ammo, Armor, Container, Furniture … (shot 10b). Military: `+`, the squad shows `Gear [w] weapon any  [g] armor any` (shot 13a); code: `src/ui/panels/military.ts:144-150` cycles a fixed list.

## What the spec says

- [`12-workshops-and-professions.md`](../../02-systems/12-workshops-and-professions.md) § Player-facing behavior: the workshop recipe list is grouped by output category.
- [`panels.md`](../../04-implementation/ui-screens/panels.md) § Military: `Gear    weapon [axe ▾] armor [metal▾]`; single-choice lists for the leader and barracks already exist in that panel.

## What to do

**Decisions.**
- The workshop panel's recipe list uses the picker's grouping (the same function, the same category order and headings). A click on a recipe still opens "Add order" on it.
- `[w] weapon` and `[g] armor` open a single-choice list in place of the squad's details, like `[S-b]` barracks: every value the command accepts, the current one marked, `Enter` sends `SetSquadEquipment`, `Esc` cancels. The wireframe's `▾` marks stay.

1. Amend `panels.md` § Workshop and § Military if the captions change.
2. Implement in `src/ui/panels/orders.ts` (workshop panel) and `src/ui/panels/military.ts`.
3. Tests, `describe('T-248 …')`.

## Done

- The workshop panel shows grouped recipes, and squad gear is chosen from a list.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
