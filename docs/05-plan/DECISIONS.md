# Decision Log

Ambiguities resolved during implementation, per the protocol in [`../process/agent-workflow.md`](../process/agent-workflow.md) § Ambiguity protocol. Append only. Ids are `D-<nnn>`.

| Id | Date | Task | Question | Choice | Spec consulted | Pinning test |
|---|---|---|---|---|---|---|




























## Contradictions

Spec test versus spec rule conflicts, per the protocol. Append only.

| Id | Date | Task | Rule | Test | Resolution |
|---|---|---|---|---|---|
| C-009 | 2026-10-03 · T-M8-01 | T-M8-01 | `performance-budget.md` gives system 21 a literal 0.00 ms average allocation, described as daily/negligible, while the measurement rule requires real per-system clock measurements over 2,000 ticks. | A real clock and the mandated daily evaluation cost more than zero: measured 0.000342 ms/tick on the unchanged 80-dwarf saved reference (initial pass 0.000649). No finite optimization can meet 2 × 0 ms while retaining execution and truthful measurement. | Keep the zero allocation unchanged and all existing immigration functional/scheduling tests. Only the new system-21 budget assertion is `it.todo("C-009")`; every other allocation is asserted at exactly 2×. Owner resolution would need a positive negligible allocation or a specified exemption for zero allocations. |

