# T-198 — Hunters split the weapons and the bolts between them and none can shoot

**Source:** T-144 and its report, [`../../reports/audits/2026-10-10-wants-without-errands.md`](../../reports/audits/2026-10-10-wants-without-errands.md) (§ What got worse, item 4) · **Size:** M · **Needs:** — · **Status:** open

## Why

In `homestead_year` on the T-144 branch five hunts were open on day 23 and five dwarves claimed one each. Two fetched the bow and the crossbow. The other three fetched a stack of bolts each as their "tool". All five hunts were abandoned with `HuntAbandoned { no_ammo }`, the jobs went to `blocked (no_tool)`, and no hunt was completed in the year. On master the same fixture has two hunt claims all year and both kill.

`findTool('ranged')` returns a free ranged weapon, or a stack of ammunition when no weapon is free (`src/systems/jobs/items-adapter.ts`). `hasTool('ranged')` asks for a weapon and ammunition together. A worker handed ammunition and no weapon can never hunt, and it holds ammunition the armed hunters need.

## Decision

- A hunt is claimed only by a worker that holds, or can reserve at the claim, both a ranged weapon and ammunition. A worker that cannot get both does not take the job and takes neither item.
- A worker that holds a weapon and no ammunition fetches ammunition, not a second weapon.

Write the rule into `11` § Tools (or the section that owns `findTool`) and `09` § Hunting.

## What to do

1. Read `jobs/board.ts` `claim`, `jobs/items-adapter.ts` `findTool` and `hasTool`, and `jobs/steps.ts` (the hunt step).
2. Unit test, written to fail first: five hunts, seven workers with the hunting labor, one bow, one crossbow, three stacks of bolts; two hunts are worked and three stay open; no worker holds ammunition without a weapon.
3. `homestead_year` on the T-144 branch completes a hunt. If it still does not, find out why with a trace and record it here; giving the labor to one hunter and staging a deer in reach did not produce a hunt in T-144's attempts, for a reason not established.

## Done

- The unit test passes, with `describe('T-198 …')`.
- `homestead_year` passes.

## Outcome

Done on branch `t-144` in commit `f715dc2`, with the invariant checker's line for fetched ammunition in `f952eab`.

- A claim reserves a launcher and a stack of that launcher's own ammunition together (at most `AMMO_FETCH`), or fails with `no_tool` and takes nothing. A worker that holds a launcher fetches only its ammunition (`ammoToFetch` in the job's data). `hasTool` asks for ammunition of the launcher's kind, so bolts do not count for a bow. Spec: `11` § Assignment step 5 and § Blocking and retry; `09` § Hunting, hunter equipment; `jobs-and-hauling.md`.
- The unit test `test/unit/jobs/t198-ranged-kit.test.ts` (`describe('T-198 …')`) fails on the code before the change and passes after.
- **`homestead_year` completes hunts**: 4 kills in the 40 days on `cloud/T-144`. Item 3's question (why one hunter and a staged deer produced no hunt in T-144's attempts) was not traced: with the kit rule the unchanged fixture hunts without staging, so it no longer blocks anything. Its cause is not established.
