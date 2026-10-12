# Clothing handoff at creature death, 2026-10-11

Runtime: `73dc67c` before the T-139 working change. The reproduction used the
unchanged main three-year fixture and assertions; no scenario was tuned.

## What the trace establishes

[Selected removal records](../data/2026-10-11-t139-removal-trace.json) show the
original reported carrier, Hrolf Stormwall (16777293), destroyed at tick 39177
with a valid Position and three carried clothes. His corpse appeared at 39181.
The [before-run invariant failure](../data/2026-10-11-t139-before-invariants.log)
then catches Brynja Flintheart (16777294) at tick 336000: she died at 335997,
with a valid Position and Equipment, leaving ten carried clothes and pieces
of gear pointing to her destroyed id. System 13 had queued her death for its
next cadence. This is the ordinary event-to-cadence handoff gap, rather than a
missing death event or a missing position.

System 13 now creates the live corpse and transfers its gear while handling
CreatureDied, before presentation listeners receive that batch. Older saved
pending-death records retain their scheduled materialization path.

## Next result of the unchanged main scenario

Command: `npm exec -- vitest run --config vitest.perf.config.ts
 test/perf/three_years_main.test.ts` (one run, 501.68 seconds).

The [after-run invariant result](../data/2026-10-11-t139-after-invariants.log)
stops at the same tick 336000 with **zero item.carrier-dead findings**. Its
only finding is item.reserved-by-missing-job: drink 150995102, one unit,
reservedBy=150995335, in container 50331755. Saga Granitefell died at 335727;
this personal drink reservation survives 273 ticks later. It is the separate
T-263 follow-up, already present in the before run. The three-year instrument
is still red for that fault; its assertion has not been weakened or bypassed.

## Verification

- Seven new T-139 regressions failed before the fix: all five cadence phases,
  immediate save/load and 50 continuation hashes, availability and corpse
  disposal. All 70 focused item/death tests pass.
- Lint, typecheck, content:check, strings:check, interface:check and docs:check
  pass. Content: 50 tables, 1624 rows; strings: 1140; interfaces: 24.
- npm test: 276 files, 2433 tests passed, 428.77 seconds.
- Whole npm run test:e2e: 25 passed, 4.0 minutes. Screenshots restored.
- No golden file, existing assertion, scenario, balance number or death rule
  changed. Full-year survivors, stocks, wildlife, alerts and deaths match;
  only the hash changes with the earlier corpse/rot record creation.

## Browser full-year records

```
Before
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"54f0bf60c7e768c3"}

After
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}
```
