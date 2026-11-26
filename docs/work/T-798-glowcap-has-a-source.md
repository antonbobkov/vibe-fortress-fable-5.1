# T-798 — Glowcap has a source the player can count on, and the sanctum says where it is

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), findings 3 and 4); playtest 7 finding 7 · **Size:** M · **Needs:** — · **Status:** open

## Why

A runecaster needs glowcap: an apprentice eats one per session, two a day (25 § The sanctum). Playtest 8 took two fortresses from the same Year 4 save. Neither held a single glowcap in a year and a half.

- **The caravan.** Fortress B asked the Mountainhome for "seed: glowcap high" and "rough gem: glowstone high". Its caravan brought 10 glowstones and 3 cut emeralds, but no seeds. Fortress A's caravan a year later had 40 seeds unasked. Glowcap seeds are an extra good with a 700‰ roll on stream 25, and a request does not raise it (`caravan-goods.md` § Extra goods: "A request can still name one" only lets it be named). There is one Mountainhome caravan a year.
- **The caverns.** The map held glowcap patches: one in cavern 1, inside the pocket sealed with its 13 monsters, and six in cavern 3, across the lake. All were out of reach: "Gather plants: 1 designated · no dwarf can reach it yet", and "Gather x745 · no path".
- **The screen.** The sanctum, built and staffed, read "Requirements met · Glowcap in stock: 0". Its two apprentices showed "2 sessions left today" for months. Nothing said what glowcap is, or that it grows from seeds sold in spring or gathered in the caverns. `hint_glowcap` fires only once seeds are in stock. The apprentice picker lists names only: no Wits, which drives attunement, and no profession. The sanctum's lines are cut: "Mishaps, new apprentice: one ses»".
- **The raid.** In both years the Mountainhome reached the depot one day before a raid's warning (d352 and d353; d465 and d473). One caravan, attacked, left two days after it came: "Sp 18 The Mountainhome caravan has departed."

## What to do

Decisions taken here:

- **A request is honoured for an extra good.** A Mountainhome extra good named in the requests is drawn at 1000‰ at "high" priority and at its permille plus half the rest at "medium". It still needs its reputation. The seeds come in their usual 2–4 bags. This spends stream 25 as before (one draw per extra good), so worlds without the request are unchanged.
- **The sanctum says what it lacks.** With no glowcap available: "No glowcap: apprentices wait. Glowcap grows in the dark under a glowstone lamp, from seeds the Mountainhome sells in spring or a glowcap patch in the caverns." In the alert color, it replaces "Requirements met". With glowcap but no glow plot growing it: "N glowcap: enough for N sessions."
- **The hint comes earlier.** `hint_glowcap` also fires when a sanctum zone is first made, or a rune circle placed, with no glowcap seeds in stock. It also fires the first time a glowcap patch is discovered ("A glowcap patch: gather it [d g] for glowcap and, sometimes, its seed.").
- **The apprentice picker shows Wits** and the dwarf's profession ("Kolbein Frosthelm · Mason · Wits 61"), sorted by Wits. The sanctum's lines wrap.
- **The caravan and the raid: a decision for the owner.** Two options: (a) a caravan at the depot when a raid is announced stays until the raid ends plus `CARAVAN_WAIT_DAYS`; (b) leave it, as a trade-off. Recommendation (a): the spring caravan is runecraft's one supply, and at peril 2 it met a raid in two years of two.

## Done

- [ ] Requested extra goods honoured; a test that a "high" glowcap request always brings seeds and that a world without one draws as before.
- [ ] The sanctum's glowcap line; the earlier `hint_glowcap`; the picker with Wits and profession; UI tests.
- [ ] 25 § Trade and value, § Player-facing behavior; `caravan-goods.md` § Extra goods; `ui-keymap-and-screens.md` § Hints; `panels.md` § Zones updated.
- [ ] The caravan-and-raid decision recorded, and built if (a).
