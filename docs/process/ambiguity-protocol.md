# Ambiguity Protocol

**Owner:** implementation · **Depends on:** [agent-workflow.md](agent-workflow.md), [testing-strategy.md](testing-strategy.md)

A task sometimes needs a decision the specification does not make: a rounding rule, a tie-break, an order of operations, a case the text never mentions. Agents do not make design decisions. This protocol turns such a gap into the smallest safe choice, and puts the choice where the next reader will find it: in the spec.

## When the spec is silent

1. **Search again.** Search all of `docs/00-` … `docs/04-` for the terms involved. Most questions are answered in a table somewhere. Then search the decision log ([`../05-plan/DECISIONS.md`](../05-plan/DECISIONS.md)): until its triage is finished, a row there is still in force.
2. **Read the work file again.** If it decided the point, that decision stands.
3. **If it is still undecided, choose the reading that**
   1. changes the least state;
   2. is the simplest to test;
   3. matches the nearest worked example in `03-content/balance.md` or the acceptance tests.
4. **Write the choice into the spec section it governs**, as plain spec text, in the same commit as the code. No id and no date: the section should read as if it had always said so.
5. **Pin it with a test** whose name says what is pinned.
6. **List it in the commit body** under `Spec edits:`, marked as a gap that was filled: `gap: 04-fluids.md § Evaporation: which tile dries first when two are level`.

Add a row to the decision log only when the choice is **pending**: it is big enough that the owner should confirm it (it changes how the game plays, not only how a corner case resolves), or a rejected alternative is worth remembering in one line. Give it the next free `D-nnn` and say what is awaited. The row is deleted when the owner confirms and the spec text stands.

## When the spec contradicts itself

A spec test and a spec rule, or two spec rules, cannot both hold.

1. Never change a constant's value or a formula to make a test pass.
2. Implement the **rule**.
3. Record the contradiction in the decision log's § Contradictions as the next free `C-nnn`: the rule, the test, what was measured, and what an owner resolution would need.
4. Mark as `it.todo` only the assertion that the contradiction makes impossible, with the `C-` id in its name. Keep every other assertion of the test running, with a functional bound where the contradicted one was a timing.
5. Add a row to [`../backlog.md`](../backlog.md) with the `C-` id, so that the open contradiction is visible as open work.

When the owner resolves it, the resolving task edits the spec, removes the `it.todo`, deletes the log row and the backlog row.

## When a spec rule and the code disagree

The code is wrong, unless the work file says the spec is. If the task is not about that rule, do not fix it in passing and do not pick a side: add a backlog row that names both the spec section and the code, and go on.

## What this protocol never allows

- Loosening a bound, or skipping a test, without a recorded contradiction.
- A choice that lives only in code, in a test name or in a commit message.
- An `Implementation note:` line, or any other note pinned beside the spec text in place of an edit to it.
