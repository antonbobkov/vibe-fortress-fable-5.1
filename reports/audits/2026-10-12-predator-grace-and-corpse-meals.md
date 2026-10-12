# Predator perception grace and corpse meals

Measured 2026-10-12 on codex-a at `8a26cbb` plus the T-213 patch. The accepted before run is the [discharged-treatment measurement](2026-10-12-treatment-retries-after-discharge.md); its runtime is unchanged at the baseline commit except for documentation. Raw [before](../data/2026-10-12-t262-after-wildlife.json) and [after](../data/2026-10-12-t213-after-wildlife.json) rows retain events, spawns, deaths and hashes.

## Rules and regressions

System 08 owns a saved, consecutive 50-tick loss-of-perception grace for an attack. Seeing the target resets it; defending-ground limits and current quarry eligibility still take precedence. System 16 no longer drops an animal's attack at its generic distance limit. Hunger still ends on a kill; the killer now waits for the ordinary corpse notification, walks to the ground corpse and consumes it after 300 ticks there. A carried, missing or unreachable corpse is abandoned. A consumed dwarf corpse cannot be buried and gives no burial relief.

The initial stepped regression run failed six of seven cases against the old runtime; the immediate defended-ground break-off control passed. Eleven cases now cover exact grace, sight resets, combat integration, physical meals, all relevant save/load stages, exact meal deadlines, burial, carried corpses and externally removed corpses. Existing assertions change only the tuning-table count (26 to 27, for the named grace constant) and exact wild state list (eight to nine, for `eat`). No fixture, balance constant or golden is changed.

## Twelve-seed year

Command: `npx vitest run --config vitest.perf.config.ts test/perf/wildlife_year.test.ts`, with `WILDLIFE_YEAR_OUT` selecting the after JSON. Twelve cases passed in 563.29 seconds. Identical generated maps, Balanced embark, orders, squad and response policy were used; no supplies or capacity were added.

| Figure | Before | After | Guard |
|---|---:|---:|---|
| Median living | 13 | 13 | At least 12 |
| Second-worst living | 9 | 8 | At least 8 |
| Minimum living (reported) | 0 | 0 | Not guarded |
| Wildlife-free years | 8 | 8 | At least 6 |
| Extinctions | 1 | 1 | At most 1 |
| Hunger/thirst deaths | 0 | 0 | At most 1 |

Only the second-worst figure worsens; no bound is exceeded, so the current policy accepts the change. The latest actual reference becomes 13/8/0/8/1/0 (median/second-worst/minimum/wildlife-free/extinctions/need deaths); best measurements and their bounds remain unchanged. Forest median/minimum is 9/0, taiga 12.5/8, grassland 14.5/14. The general minimum-survival target is still unmet. No seed changes between surviving and extinct.

| Seed | Before living | After living | Before hash | After hash |
|---|---:|---:|---|---|
| wildlife-temperate_forest-1 | 10 | 8 | f283bf718824d1fe | a768a2304c7a2cfb |
| wildlife-temperate_forest-2 | 10 | 10 | 33219acf7e82d844 | 33219acf7e82d844 |
| wildlife-temperate_forest-3 | 0 | 0 | e18c38044c28ff6f | e18c38044c28ff6f |
| wildlife-temperate_forest-4 | 13 | 13 | 3bfa873760a197f1 | 9a24dda78cbd01de |
| wildlife-taiga-1 | 13 | 13 | 27fca263c8872410 | 27fca263c8872410 |
| wildlife-taiga-2 | 12 | 12 | da23f5960d18bc77 | da23f5960d18bc77 |
| wildlife-taiga-3 | 13 | 13 | a11df5efc361241e | a11df5efc361241e |
| wildlife-taiga-4 | 9 | 8 | 7420e338609debc6 | 7b794bdb155ae5b0 |
| wildlife-temperate_grassland-1 | 15 | 15 | 99c7cdcab8764933 | 99c7cdcab8764933 |
| wildlife-temperate_grassland-2 | 14 | 14 | f2db1e9cd1e340e9 | f2db1e9cd1e340e9 |
| wildlife-temperate_grassland-3 | 15 | 15 | d97039e3ddd76ce6 | d97039e3ddd76ce6 |
| wildlife-temperate_grassland-4 | 14 | 14 | e4aca96c8403d490 | e4aca96c8403d490 |

## Browser year

The full browser suite passed all 25 tests in 4.0 minutes; screenshots were restored. The same opening and commands now leave six rather than seven dwarves alive. All six deaths are caused by wolves (five bleeding out, one killed), with no hunger or thirst death; the survival and need-death assertions pass. No playthrough edit was made.

Before:

```text
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}
```

After:

```text
full-year end state: {"livingCount":6,"wealth":2547,"stocks":{"drink":100,"meal":56,"plantFood":84,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":3,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":85840,"level":"watchful"},{"tick":87340,"level":"hearth"},{"tick":91960,"level":"watchful"},{"tick":91980,"level":"calm"},{"tick":92060,"level":"watchful"},{"tick":93460,"level":"hearth"},{"tick":93760,"level":"watchful"},{"tick":93920,"level":"calm"},{"tick":94120,"level":"watchful"},{"tick":95180,"level":"calm"},{"tick":95400,"level":"watchful"},{"tick":96140,"level":"calm"},{"tick":96500,"level":"watchful"},{"tick":101160,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":67,"tick":80072,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":""},{"day":70,"tick":83561,"kind":"dwarf","name":"Estrid Emberstone","cause":"killed","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":71,"tick":84132,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"idle"},{"day":74,"tick":88532,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":78,"tick":92472,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"008a55e9dabe420b"}
```

## Verification

All six static checks pass: 50 content tables / 1624 rows, 1140 string keys, 24 interface documents with no difference, and 326 linked documents with no broken link. `npm test`: 280 files and 2462 tests passed in 482.20 seconds. The full browser suite and twelve annual cases passed as recorded above. No golden or long-fixture edit.
