# T-302 — Items lose their place in the economy fixture at perils 2 and 4

**Source:** T-145 and [`../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md`](../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md) (§ The sweep) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

The 20-seed sweep asserts the T-176 invariants at perils 2 and 4. On the branch `t-145` at `ac88f56`, ten of its thirteen seeds at those perils stop on `item.nowhere`: an item with no position, container, carrier or wearer. The main scenario (peril 0, the same script) runs 336 days with the same watch and no finding.

## Reproduction

`npm exec -- vitest run -c vitest.perf.config.ts test/perf/three_years_seeds.test.ts -t p2-1` at `ac88f56`. The first finding of each seed:

| Seed | Tick (day) | Items |
|---|---|---|
| `three-years-p2-1` | 84,000 (70) | brightleaf ×5 (16777265), seed ×6, seed ×1, seed ×1 |
| `three-years-p2-2` | 75,600 (63) | brightleaf ×5 (16777266), drink ×1, drink ×12 |
| `three-years-p2-3` | 86,400 (72) | brightleaf ×5, three single seeds |
| `three-years-p2-4` | 148,800 (124) | brightleaf ×5, four single seeds |
| `three-years-p2-6` | 81,600 (68) | brightleaf ×5, seed ×5, three single seeds |
| `three-years-p2-7` | 72,000 (60) | brightleaf ×5, two single seeds |
| `three-years-p4-1` | 70,800 (59) | brightleaf ×5 |
| `three-years-p4-3` | 73,200 (61) | brightleaf ×5 |
| `three-years-p4-4` | 75,600 (63) | brightleaf ×5 |
| `three-years-p4-6` | 80,400 (67) | brightleaf ×5 |

Every sample has `flags=0`. The brightleaf is the wagon's (an embark item id). The full samples are in the sweep's console output; the per-seed journal is [`2026-10-12-economy-fixture-sweep.json`](../../reports/data/2026-10-12-economy-fixture-sweep.json).

## What the spec says

The invariant `item.nowhere` of `test/scenarios/invariants.ts` (T-176): an item that is not installed has a position, a container, a carrier or a wearer. The sections of `13` and `18` that govern a held or looted item are to be read when the holder is known.

## What to do

1. Find what the brightleaf's last holder was (the watch of `test/scenarios/invariants.ts` with the item id, one tick before the finding). The first hostile arrivals of these perils fall in the same weeks, so a raider's or a thief's loot is the first suspect; the hospital's supply haul (brightleaf is a hospital supply) is the second.
2. Fix the fault with a failing test first.
3. Run the thirteen seeds again.

## Done

- No `item.nowhere` finding in the thirteen seeds, or the invariant says why such an item is allowed.
