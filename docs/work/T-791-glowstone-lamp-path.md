# T-791 — The way to a glowcap plot is named where the player looks, and the jeweler leaves the lamp's glowstone

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 7) · **Size:** M · **Needs:** — · **Status:** open

## Why

I tried to start runecraft from the player's side in a Year 4 fortress of 75 that had never touched it. Here is how far a year got.

- **Seeds.** The fortress had no glowcap seeds. They come only as a Mountainhome extra good (700‰, `caravan-goods.md`), and the Year 4 caravan had left during an ambush before I traded. I added "seed: glowcap" to the Mountainhome's requests (17-request-glowcap.png). The next spring's caravan sold "40 glowcap seeds 288", "4 glowstone rough gems 120" and "1 iron anvil 270" (41-trade-glowcap.png).
- **The lamp.** The hint came at once: "☼ Glowcap grows in the dark under a glowstone lamp." Nothing in Build is called a lamp. Furniture has "Statue 1 statue (no statue)" and "Lantern". The lamp is an order, "Glowstone lamp", at a jeweler's (`make_glowstone_lamp`), which I found by typing "lamp" into Add order. That order read "○ Glowstone lamp · no rough gem (from mining)" while the four bought gems stood at the depot.
- **The jeweler took the glowstone.** The fortress's standing "≥30 Cut gem" order at the jeweler's (the three-year script's; a player would keep one to stock staff stones) cut two of the four rough glowstones within the week. Cut glowstone went from 3 to 5, rough from 4 to 1 (44-glowstone-cut-s.png). The last one was reserved, and the lamp order read "x2 Glowstone lamp · waiting for rough gem (0)" for the rest of the season. A cut glowstone is a staff stone (Call), not a lamp, so the jeweler's choice was a real one. Nothing told me it had been made.
- The laboratory and the runeforge (anvil bought) were placed in Spring, Year 5. No glowcap was planted by Summer 5, so no vial, no rune circle and no sanctum.

## What to do

Decisions taken here:

- **The hint names the order and the placing:** "Glowcap grows in the dark under a glowstone lamp: order one at a jeweler's ([o], 'Glowstone lamp'), then place it [b > Furniture > Statue] in the middle of a dark plot." (`hint_glowcap`).
- **Build names the lamp.** The Statue row reads "Statue / lamp" when a glowstone statue is in stock. A built glowstone statue's inspector reads "Glowstone lamp: lights its 3 × 3 for glowcap."
- **A cut-gem order of "any" material leaves glowstone** while an open order wants a rough glowstone. The jeweler never cuts the material another order is waiting for. A cut-gem order that names glowstone still cuts it.
- The trade-off stays: rough glowstone is a lamp, cut glowstone a staff stone. Only the silent choice goes.
- The order note's wording for gems at the depot is T-790-order-note-says-shortfall.

Decisions taken while doing it:

- **The rule is general, not the jeweler's alone** (12 § Materials kept for orders): a recipe input that names one material (`material: <id>`) keeps it from every order whose input of the same item type names no material (no recipe `material`/`materials`, no material property, no order filter on it). Other recipes that name one: `grind_glowstone`, the brews (barley, hops), `make_steel_bone_ash`/`make_steel_shell` (iron bars), `make_cloak` (wool cloth), the knapped obsidian, the kiln's clay, sand and glass. An input of a tag or category keeps nothing.
- **It keeps a count, not the whole stock**, as the cloth rule does: each other standing order of another recipe keeps its input count times its `remaining` (once for a `maintain` order); orders at a suspended workshop keep none. So the third rough glowstone beyond two lamps is cut.
- **An order filter never keeps** (only the recipe's own named material does): a player's "cut garnet" order does not hold garnet from a "cut any" order. This keeps the three-year script's iron-filtered forge orders from changing what the unfiltered ones take.
- **Visible, not announced:** the waiting order's status reads "glowstone kept for Glowstone lamp", its full status "Waiting: the glowstone rough gem is kept for the Glowstone lamp order. Set this order's material to glowstone to take it anyway.", and Add order's note "· glowstone kept for Glowstone lamp". The workshop emits `WorkshopBlocked { material_kept, input }` once, with no log line (like `out_of_reach`): the cut-gem order goes on cutting other stones, so a line in the log would be noise.
- The item filter gains `excludeMaterialIds` (13's search, 11's job input filter), so the job's claim honours the keep.

## Done

- [x] The hint text and the Statue row / inspector wording; UI tests.
- [x] The cut-gem order skips a material an open order waits for; a test with a lamp order and a standing cut-gem order.
- [x] 25 § Player-facing behavior (hints) and 12 § Operation (input choice) updated.
