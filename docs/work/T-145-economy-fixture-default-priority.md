# T-145 — The economy fixture plays at default priorities

**Source:** T-123 and its report, [`../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../reports/audits/2026-10-08-economy-at-default-priority.md) (causes 7 to 11, § Not established) · **Size:** M · **Needs:** T-140, T-141, T-142, T-143 · **Status:** open

## Why

F-17 decided that the three-year economy fortress should play as a competent player would. The rewrite on the branch `f-17` (`ffbc723`) does that in part and is not merged. T-123 found that it fails mainly because of the game (T-140 to T-144). It also has faults of its own, which a player would not make.

## Decision

Merge the rewrite once T-140 to T-143 are in, with these changes to the script:

- **Hauling stays on for every dwarf** except the two miners. The rewrite leaves one hauler of seven until day 56.
- **A founder is Broker from day 1.**
- **Beds come before barrels** in the carpenter's order list until every dwarf has a bed. In the kitchen, the lavish order goes first once easy meals have been stocked once.
- **A thief is a threat.** Add `thief` to the purposes that raise the alert and send the squad.
- **The farm grows with the population.** Plots follow the dwarf count.
- **The anvil is bought.** On days 230 to 234 of the urgent-priority run a session was open, the anvil cost about 311 marks, the depot held 524 to 1,841, and the script sent no offer. Find why in the script's `trade` routine and fix it. If the game refused something, that is a new backlog row.
- **The original assertions come back**: every recipe witness above zero, a trade at every visit. Remove `F17_KNOWN_GAPS`.

Before merging, also explain why the **old** script with no urgent jobs stops mining by day 112: every dig job is blocked "unreachable" and nothing is mined. If that is a game fault it gets its own row.

## What to do

1. Rebase the six fixture files of `f-17` onto master.
2. Apply the changes above. Run `npx vitest run test/scenarios/m8.test.ts -t three_years`.
3. Run the 20-seed sweep once and the mood instrument once. Write a dated report and update `balance-status.md`.

Spec touched: none. This is test authoring.

## Done

- The scenario passes at default priorities with its original assertions.
- Peril 0: seven of seven seeds survive with no dwarf death.
- B-008 … B-012 are each read against the new report and closed or re-filed.
