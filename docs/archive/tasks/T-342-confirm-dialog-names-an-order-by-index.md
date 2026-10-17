# T-342 — A confirmation names a work order by its index, and the game keeps running behind it

**Closed:** 2026-10-16, in 25a8ee8.

**Source:** review of T-278 (Delete in Orders asks first through `confirmThen`, then sends `RemoveWorkOrder { workshopId, index }`) · **Size:** S · **Needs:** — · **Status:** open

## Why

The Orders panel's `x` and `Delete` take the selected order's workshop and queue index when the key is pressed and send `RemoveWorkOrder` with that index when the player answers Yes. A confirmation dialog does not pause the simulation: `Game.confirm` in `src/app/game.ts` pushes the dialog without touching the speed (only the game menu stops the clock), and the frame driver ticks whatever the screen stack. At 2× or 4× an order can finish, or a standing order can fall off the queue, while the dialog is open, so the index then names another order and the wrong one is removed.

## What to do

**Decisions.**
- The removal is addressed by what was asked about, not by a position: the dialog's answer re-finds the order (a global order by its serial; another by workshop, recipe, mode, threshold, priority and material, the nearest to its old place; the count is not compared, because it falls while the order runs) and removes it if it is still there; if it is gone the status row says "That order has finished." and nothing is removed.
- Whether a confirmation should pause the game is not changed here; the check above is the only fix.

1. Amend `panels.md` § Orders with the sentence about a finished order.
2. Implement in `src/ui/panels/orders.ts` (`remove`) and, if needed, a reader that finds a work order by its fields.
3. Tests, `describe('T-342 …')`: ask to remove an order, finish or remove another order ahead of it, answer Yes: the asked order goes, or the line is shown.

## Done

- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
