# T-NEW — The way to a glowcap plot is named where the player looks, and the jeweler leaves the lamp's glowstone

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
- The order note's wording for gems at the depot is T-NEW-order-note-says-shortfall.

## Done

- [ ] The hint text and the Statue row / inspector wording; UI tests.
- [ ] The cut-gem order skips a material an open order waits for; a test with a lamp order and a standing cut-gem order.
- [ ] 25 § Player-facing behavior (hints) and 12 § Operation (input choice) updated.
