# T-762 — Six idle woodcutters and 35 chops waiting: the Jobs reason says "it may need … a tool another dwarf holds" when it knows the only axe is with Dis

**Source:** playtest 2026-11-25 (newcomer) ([report](../../reports/data/2026-11-25-playtest-5.md), finding 8) · **Size:** S · **Needs:** — · **Status:** open

## Why

The Balanced preset brings one axe. On the default embark I marked 42 trees on Day 16 of Spring. A day and a half later, Jobs read "Chop x35 · open 2 days" and "Chop · Dis Hearthborn" (the one woodcutter with the axe, at work). Selecting the waiting row gave: "Nobody takes it yet, though 6 dwarves with the woodcutting labor are free: it may need more skill, a tool another dwarf holds, or a way clear of danger." (`46-jobs-chop-wait.png`). Earlier the same reason stood for 3 days over 18 chops while Dis slept, and Units read "7, 5 idle". A newcomer sees five idle dwarves, 18 trees and a guess. The game knows the answer: the chop needs an axe, there is one, and Dis has it.

`src/ui/job-wait.ts` `toolHeld` (T-661) names the tool's holder only when the holder cannot use it now (on duty, in hospital, hurt, sheltering). A holder who is working, asleep, eating or drinking counts as available, so the check gives up and the vague `not_taken` line follows.

## What to do

Decisions:

- **A job that needs a tool names who has it whenever that is why it waits.** That is when the job's tool is not free in stock and none of the free dwarves with the labor holds one, whatever the holders are doing. One holder gives `ui.job_wait.tool_short.one`: "Nobody takes it yet: the only {tool} is with {name}, {doing}. The other {n} {labor} dwarves have none: make or buy another {tool}." Several give `ui.job_wait.tool_short.many`: "… all {k} {tools} are in use ({name}, {doing}, and others). …".
- `{doing}` is the holder's activity in the Units panel's words, lower case ("chopping", "sleeping", "eating", "making a barrel"). The existing `tool_held` wording (on duty, in hospital, hurt, in shelter) stays for those cases.
- The order of reasons in `jobWait` is unchanged otherwise: this check runs where `toolHeld` runs now, and `ahead`, `busy`, `unreachable`, `needs` and `not_taken` follow it.

Spec: 11 (where T-661's "the only axe is with Urist" sentence is) and `ui-screens/panels.md` § Jobs (j).

## Done

- [ ] Tests (`describe` with the task id): a fortress with one axe held by a dwarf at a chop job and 3 idle woodcutters gives the `tool_short.one` line naming the holder and "chopping". With the holder asleep it says "sleeping". With two axes held by two working dwarves it gives the `many` line. With a free axe in stock it gives no tool line. T-661's hospital case is unchanged.
- [ ] UI only: no world hash moves and no sweep is needed.
