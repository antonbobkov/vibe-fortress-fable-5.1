# T-764 — A build waiting for its trees is invisible outside its own panel

**Source:** T-756 (a building placed over grown trees waits for them to be felled) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-756 a building placed over grown trees marks them for chopping, and its build job is not made until the last tree falls (14 § Placement step 4). The building's own panel says "Waiting for 2 trees on its site to be felled". Nothing else does:

- The Jobs panel lists jobs, and the build has none yet, so the waiting workshop is not in the list at all. Only its `chop` jobs are.
- The Orders panel's note for a recipe whose workshop is placed and not built ("· kiln not built yet", or "… waiting 41 days for a builder" from the build job, panels.md § Orders) has no build job to read, so it says only "not built yet".
- The inputs are not hauled while the trees stand, since there is no job to haul them for.

On a forest site the first workshop now often waits for the one woodcutter with the fortress's one axe. A newcomer who looks at Jobs or Orders sees no reason.

## What to do

Decisions:

- **The Orders note names the trees**: "· carpenter's workshop not built: 2 trees to fell first", read from the planned building's footprint as the building panel does.
- **The Jobs panel does not list buildings without jobs.** The `chop` jobs it lists are the visible part. No change there.
- Hauling inputs early stays out: the build is made when the trees are down, as now.

Spec: `ui-screens/panels.md` § Orders (the not-built note).

## Done

- [x] Tests (`describe` with the task id): an order for a carpenter's recipe, with a carpenter's workshop planned over two trees, shows the note with "2 trees to fell first"; after both fall, the note is the usual one. Test: `test/unit/ui/t764-orders-tree-wait.test.ts`.
