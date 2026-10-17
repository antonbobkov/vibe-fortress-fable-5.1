# T-371 — The balance model's wild-animals section states two results

**Closed:** 2026-10-17, in 74d8bc5.

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) § Contradictions found · **Size:** S · **Needs:** — · **Status:** open

## Why

`docs/03-content/balance.md` § Wild animals has a paragraph on the measured annual survival over twelve maps that says "median 13 living, minimum 0, eight years without a wildlife dwarf death, one extinction … Forest seed 3 goes extinct". The table of § Many-seed annual survival and its closing paragraph give the later rows: minimum 9, second-worst 10, no extinct fortress, every seed at or above 8. The first paragraph is a superseded measurement left in place, and a reader cannot tell which is current. The same section also carries several paragraphs of measurement history (the T-261 and T-361 rows, the trial of patient admission) that `agent-workflow.md` § Reports and audits keeps in reports and `balance-status.md`, not in the spec.

## What to do

Make § Wild animals and § Many-seed annual survival state the current figures once, as `balance-status.md` has them, and leave the history to the reports they link. Change no target and no guard.

## Done

- The section states one result, the current one; the guards and targets are unchanged.
