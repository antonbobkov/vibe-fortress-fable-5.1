# T-572 — Beds: a narrow rest band, mood by bed, and a wooden bed that needs bedding stuff

**Source:** the owner, 2026-11-15 · **Size:** M · **Needs:** — · **Status:** open

## The owner's decision

The owner had second thoughts about T-551's floor rest at 50%: "Maybe all I want is to have unhappy/happy thoughts from bed quality but the actual rest not changing by much." Offered options, the owner chose a narrow band with thoughts, and added: "let's make wooden bed +1 and require wood + soft material (pallet equivalent) to build it."

| Sleep on | Rest | Thought |
|---|---|---|
| floor | 85% | `slept_on_the_floor` −2 (new or existing, whichever fits 10) |
| pallet | 90% | `slept_on_a_pallet` −1 |
| stone bed | 95% | none |
| wooden bed | 100% | **+1** (new, for example `slept_in_a_bed`) |
| dressed bed | 110% | `slept_in_a_soft_bed` +3 |
| featherbed | 110% | `slept_in_a_featherbed` +5 |

- **The wooden bed needs soft material.** `make_bed` (or the bed building) takes a log **and** a pallet's materials: 2 cloth or wool, or 3 fiber, straw or reeds. The stone bed already takes stone plus pallet materials. The dressed bed keeps its bedding and pillow.
- All the numbers are *unmeasured*.

## Why

At 50%, a floor sleeper slept about 2.5 times as long. That slowed the early game (T-143's first carpenter took 22 days, against under 10 before). It forced two new rules: a sleeper wakes to eat, and an alert no longer pulls a starving dwarf off food. It is the first suspect in T-571's growth slowdown.

## What to do

1. Change the `rest` values and `FLOOR_REST_PERCENT` / `MADE_UP_REST_PERCENT` in 10 and the bed rows, and add the floor and wooden-bed thoughts.
2. Give the wooden bed its soft input, in the recipe or building row, and in 09, 12 and 14 wherever the bed's inputs are written. Check every place a bed is made or bought: the embark loadout and its presets, the testing preset (T-532), Hillfolk caravans (beds and bedding), and the three-year, defence_year and other scripts. The scripts must still bed their dwarves: the embark carries cloth, and the scripts can lay pallets or order straw. Say how each was handled.
3. Look again at T-551's two rules (wake to eat, stay at food under an alert) and at the relaxed test bounds T-551 made, such as T-143's carpenter at 25 days. Keep a rule if it is still right on its own merits; tighten any bound the new numbers allow back.
4. The substitute check: the stone bed and the pallet stay worse than the wooden bed.
5. Coordinate with T-571 (the growth slowdown), which is measuring now. If T-571 has refreshed the sweep reference by the time you finish, measure against it. If not, report the pooled sweep against the current reference.

## Done

- 10, the content and the code say the table above, with tests. The sleep audit is redone (T-551's method); the sweep, instrument, defence_seeds and ci.yml pass. Report the living and deaths against T-551's and T-571's figures.
