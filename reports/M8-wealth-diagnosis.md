# T-M8-06 wealth investigation

The peril-4 totals in `M8-mood-diagnosis.md` §15.3 are an ownership accounting
bug. `13-items-and-storage.md` §Value adds items created for the fortress and
hostile loot when recovered. `balance.md` §Wealth curve sums item and building
value; it does not make every item anywhere on the local map a fortress asset.
Merchant goods already obey separate ownership transitions under 20 §Trading.

## Original-code measurements

Replayed the unchanged three-year setup and seeds against the source at
`68b51f9`, using an isolated Vite SSR source override, without modifying the
main checkout or its worktree. Probes forward every spawn, split, pickup and
strip-job completion unchanged. They track hostile origins and actual fortress
recovery outside simulation state, then classify the surviving item records.
Both reported wealth totals and extinction days reproduced exactly.

| Contribution, marks | p4-6, day 187 | p4-3, day 322 |
|---|---:|---:|
| Fortress goods and recovered loot | 3,846 | 2,538 |
| Buildings | 164 | 181 |
| Equipment of living hostiles | 74,784 | 3,030 |
| Equipment of departed owners | 38,359 | 161,491 |
| Unstripped corpse equipment | 1,728 | 0 |
| Unrecovered dropped hostile gear | 705 | 126 |
| Unrecovered foreign corpses | 12 | 0 |
| Original cached wealth | **119,598** | **167,366** |
| Fortress possessions plus buildings | **4,010** | **2,719** |

These last rows reclassify the original encounters; they are not predictions
of a corrected three-year run, where changed wealth changes renown and later
raid sizes. The authored value and renown formulas remain intact.

## Why the ledger inflated

`ItemCore.counted` excluded only `Merchant`, following early D-068(f).
Hostile equipment is spawned through the item creator, which immediately adds
its value; later setting `carriedBy`, `ownerId` and `Owned` never removed its
wealth contribution. High-tier gear therefore increases fortress wealth on
enemy arrival, before a dwarf recovers anything.

`despawnMember` removes the creature and reports stolen fortress loot, but its
own equipment records remain. In p4-3, 939 departed-owner equipment entities
contribute 161,491 marks, all with edge positions; p4-6 has 318 contributing
38,359, including 317 edge records worth 38,351. For example, a warhammer at
(0,0,32), with both carrier and owner #83886482 already gone, contributes 480.
This is not recovered fortress gear. The mere existence of a position at a
map edge does not establish ownership: p4-6 also has four legitimate fortress
edge items worth 44 marks.

Corpses have the ordinary item formula and are not automatically valueless;
the six unrecovered foreign corpse entities in p4-6 contribute 12 marks.
Their still-worn equipment is a separate contribution. Natural dropping or
rot does not constitute fortress recovery. The large totals mostly come from
foreign equipment, not corpse material or production by the forge.

## Correction and regression coverage

`ItemFlag.Foreign` records provenance through death, departure, splitting,
dropping, projectiles and rot. Incremental stock accounting and its recount
exclude both foreign items and merchant goods. Actual pickup by a fortress
creature clears foreign provenance for the item and its contents, as does a
completed `strip_corpse` job for the equipment it recovers. Repeated pickups
count the same loot once. A non-fortress carrier does not make an already-owned
fortress item foreign: stolen goods remain counted until `ThiefEscaped`.
Pending deaths preserve provenance through saves before the items cadence.

The `T-M8-06 wealth` tests exercise actual hostile equipment, edge departure,
health death/corpse creation, a real stripping job, split ammunition, bin and
corpse pickup, skeleton conversion, merchant ownership, building value and
actual theft escape. Save/load hashes are checked before and after recovery.
Four of the initial five behavior tests failed on the old ledger; the existing
edge/building/trade-value case passed. No setup, value multiplier, budget or
balance constant is adjusted.

Older saves do not record foreign provenance. In particular, equipment whose
owner has already departed cannot be reclassified reliably from its position
or stale owner id. This correction preserves explicit provenance in newly
created gear and corpses; it does not guess ownership for those legacy records.

## Verification

Lint, typecheck and content validation pass (50 tables, 1,585 rows). The full
standard suite passes 173 files / 1,628 tests in 191.04 s; goldens are unchanged.
The full performance suite passes 9 files / 55 tests with the existing C-009
TODO in 2,381.00 s. On the saved 80-dwarf reference, the per-system run averages
3.560 ms/tick (worst 33.772); systems 10, 13, 16 and 18 average 0.488, 0.035,
0.135 and 0.138 ms/tick, all within their unchanged allocations ×2.

With all three corrections present, the unchanged 20-seed sweep reports
peril-4 final wealth of 2,326–3,050 marks. Specifically p4-3 is 2,939 at its
day-186 extinction and p4-6 is 2,326 at the end of year 3 with one survivor.
These are new encounters, unlike the retrospective ledger above. The sweep
still reports combat and survival losses; its deterministic guarantees pass.
