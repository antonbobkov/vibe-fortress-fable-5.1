# T-798 — Glowcap has a source the player can count on, and the sanctum says where it is

**Closed:** 2026-11-26, in 1553b00f.

**Source:** playtest 8 ([report](../../../reports/data/2026-11-26-playtest-8.md), findings 3 and 4); playtest 7 finding 7 · **Size:** M · **Needs:** — · **Status:** done

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

Decided in the work (ambiguity protocol):

- **Why the "high" request brought nothing.** A request was matched to the first list entry of its item (the ordinary cave seeds) and drawn from the request share, and the requests are served in turn, each drawing until the share is spent: the "high" glowstone request ahead of it took the whole share (10 glowstones). Now a request is matched to the entry whose pool holds its material (else the first entry of its item, as before), and a request that names an extra entry raises the roll and spends nothing of the share. Requests that name an ordinary entry draw exactly as before; no script asks for glowcap or rune vials, so the scripted worlds do not move.
- **"Available"** is 13's available stock of the `glowcap` item. **"A glow plot growing it"** is a glowcap crop standing on any plot (07's crops); then the line stays "Glowcap in stock: N".
- **The earlier hint** keeps one row, `hint_glowcap`, whose text now says where glowcap comes from, so it reads true whichever trigger shows it; the patch has its own row, `hint_glowcap_patch`, shown on the first `TilesDiscovered` of a tile whose plant is `glowcap_patch`.
- **The caravan and the raid: (a), as a pause.** The stay's clock waits while a raid, a siege or bandits are warned of and still to come, or on the map (`RAIDING`), so the caravan has its whole stay after the raid. An attack still sends it away (20 § Movement step 5): the raid's own blows end the visit, as before. Measured with T-800's final rules (the session stays open, a stand-in for an away Broker, the retry; branch `t798-caravan-glowcap`, commit `84dfbe37`): twenty-seed sweep run 45928227287, pooled living 1154.5, deaths 122.25, extinct 0.25 (p4-2 at shift 50, day 307), verdict pass, against master's about 1167 / 115 and the bounds ≥ 1046.63 / ≤ 132.5, so deaths are within 8 of master and the pause is adopted; `defence_seeds` run 45928230109 passes (7.50 raids turned back, 6.50 soldier kills). One seed job (p2-4, shift 150) failed its own invariant, a dig job blocked as unreachable beside a reachable tile; filed as `T-811-dig-blocked-beside-reachable.md`.

## Done

- [x] Requested extra goods honoured; a test that a "high" glowcap request always brings seeds and that a world without one draws as before.
- [x] The sanctum's glowcap line; the earlier `hint_glowcap`; the picker with Wits and profession; UI tests.
- [x] 25 § Trade and value, § Player-facing behavior; `caravan-goods.md` § Extra goods; `ui-keymap-and-screens.md` § Hints; `panels.md` § Zones updated (also 20 § Party, § Requests, § Movement step 4).
- [x] The caravan-and-raid decision recorded, and built if (a).

## Measured again in T-814

T-798..T-800 merged (`1ebabe1d`, run 45959693912) paired with the master before them (`7f37335f`, run 46103268570): deaths 121.75 against 109.5 (+12.25, noise ± 9.3), living 1093.75 against 1157.25. Every timeline moves; deaths rose in 23 seed-shifts and fell in 19. The glowcap roll does not touch the scripted worlds (no script asks for an extra good). The raid pause swept off on master `ddbff0d0` (`t814-tmp-nopause`, run 46112657410) and paired with it (run 46111413549): deaths 119.5 against 117.25 (+2.25, noise ± 8.9), living 1157 against 1143.5. Taking the pause out does not take the deaths back, and no dwarf of the 465 that died in the master sweep was trading or hauling to the depot when first hit, so the pause stays ([T-814](../../work/T-814-master-drift-t795-t798.md)).
