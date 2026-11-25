# T-717 — On a site with no surface stone, the game never says stone is what is missing

**Closed:** 2026-11-25, in 53987bdf,4926579f,6a0ae7a9,6e3f0d9b,fec1366d.

**Source:** playtest 2026-11-24 (second) ([report](../../../reports/data/2026-11-24-playtest-2.md), finding 4) · **Size:** M · **Needs:** — · **Status:** open

## Why

"Sedgefen" (world `deep-2346-1`, region (11,30)) is a wetland whose soil is four levels deep; the site panel says "This site lacks: stone" (`04-site.png`). The hill the first hall was dug into is silt and peat, so the dig gave soil loads, not stone. The player followed help step 4 ("Build a carpenter's workshop and a still first"), and every stone building then waited with a misleading reason:

- **The still's panel said "Waiting: 1 barrel - order at a carpenter's workshop or a forge"** from Spring 1 to late Summer (`29-still-waiting.png`), while six barrels stood in Stocks (three of them ordered for it). Its job's inputs are an empty barrel and a raw stone; `jobBlockText` (`src/ui/messages.ts`) names the first input not yet delivered, the barrel, whether or not one is to be had, and never the stone. The still was built only after a second shaft reached rock five levels down.
- **The Build list showed "Still 1 barrel+1 stone (3)"**, "Kennel 2 logs+1 chain or rope (5)", "Tannery 2 logs+1 bucket (5)" with no stone, rope or bucket in the fortress: the count is of the first input only (`available` in `src/ui/panels/build.ts`), so a building that cannot be built reads as buildable.
- **Placing a mason's workshop said "0 stone or block in stock: 1 will wait · build a forge, a mason's workshop or a kiln to make blocks"**: each of the three needs stone or blocks itself, so the advice is a circle on a site with no stone.
- **Stocks listed "stone 19"** while the mason had none: the row holds 19 soil loads ("▼ stone / ► soil 19", `28-stocks-stone.png`). The kitchen and the hearth waited for the same stone.

Reproduce: embark any preset on a `wetland` or other site whose `This site lacks:` names stone; dig into the nearest hill; place a still and a mason's workshop.

## What to do

Decisions:

- **A blocked job's waiting line names the input that is short**, not the first undelivered one: the first input whose available count (13's `countAvailable` for its filter) is below what it still needs; the first undelivered one only when every input is to be had (then the wait is hauling, and the line says "waiting for 1 barrel to be brought"). One rule for buildings, workshop orders and the Jobs panel (`jobBlockText`).
- **The Build list's count is the scarcest input's**, shown as that input's units against its need: "Still 1 barrel+1 stone (no stone)" when one input has none, else the smallest number of buildings the stock allows ("(3)" means three can be built). `fortress-screen.md`/`panels.md` say so where the "(14)" is described.
- **When no workshop that makes the missing input can be built from what is in stock, the advice says where the raw material is**: for stone, "dig down to rock: the soil here is N levels deep" (N from 03's site soil depth, which the site panel already shows), or "trade for stone or blocks" when no rock is reachable; never a workshop that needs the same input.
- **Stocks keeps soil out of the stone row**: a top-level "soil" row (peat, clay, silt loads), so "stone" counts only what a mason can cut. 13 § Categories, if it files soil under stone, changes with it.

Spec: 11 or `ui-screens/panels.md` § Jobs (the waiting line), `ui-screens/panels.md` § Build (the count), `ui-screens/fortress-screen.md` (the placement status line), 13's stock categories.

## Done

- [ ] Tests (`describe` with the task id): a still with barrels in stock and no stone says it waits for stone; with both in stock and none delivered it says the barrel is being brought; the Build row reads "(no stone)"; the mason's placement line on a stoneless site says to dig down N levels; Stocks lists soil loads under soil.
- [ ] UI only unless 13's categories change; world hashes unchanged otherwise.
