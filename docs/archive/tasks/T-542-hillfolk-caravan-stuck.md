# T-542 — A hillfolk caravan stuck on its way to the depot

**Closed:** 2026-11-10, in 9212ed7f,f292eb70.

**Source:** T-539's sweep (run 42782003867) · **Size:** S · **Needs:** — · **Status:** open

## Why

In T-539's sweep, seed p2-2 at shifts 100 and 150 failed a caravan invariant: a hillfolk caravan stayed stuck on its way to the depot for 20 days. The verdict passed, since this fails only the seed's own job, and nobody looked at why.

## What to do

Reproduce p2-2 at shift 100 on GitHub (as T-530's and T-536's probes did), find what holds the caravan (a door, an alert, a walled depot, a path the labels join but a walk cannot take), and fix the rule or the script at its root, with a test. Write the rule in the trade spec if it changes.

## Done

- p2-2 at shifts 100 and 150 passes its seed job in the pooled sweep, and the verdict passes.

## Outcome

- **Cause.** The probe ([its source](../../../reports/data/2026-11-10-t542-caravan.probe.ts.txt), [its log](../../../reports/data/2026-11-10-t542-caravan.probe-log.txt); run 42865675914, p2-2 at shifts 100 and 150) found the same thing at both shifts: the day-270 Hillfolk caravan had ten members in place and one mule bound for 10,6,32, a tile of the ring around the depot. A sapling there grew into a tree while the mule walked to it (53 steps, then unreachable), and since each member's place is chosen once and the walk waits for every member, the caravan stood one tile short of the depot for good. Not a door, an alert or the depot: the depot stood, built and reachable, the whole time.
- **Fix (the rule).** 20 § Movement step 3: a member whose walk comes back unreachable and whose place can no longer be stood on or walked to takes another: the nearest place of its kind (inside the depot for a merchant, around it for the others) it can walk to, one no other member is bound for first; else the nearest of the other kind; else where it stands. A place still open keeps the walk as before, so a passing block changes nothing.
- **Test.** `test/unit/trade/t542-blocked-depot-place.test.ts`: trees grown on every guard's and animal's place, and a merchant's place inside the depot blocked; both caravans reach the depot. Both fail without the rule.
- **Gates.** `ci.yml` run 42868825790 (3723 tests, e2e 42 passed). Sweep run 42868820353 on master 50eb2573 (T-540) with the fix: all 80 seed jobs green, p2-2 at every shift among them; pooled 20 / 7 / 0.25 / 938.25 / 143 / 0.5 / 2.75, verdict pass, invariant findings none (before, T-540's sweep 42851630696: 19 / 7 / 0.25 / 879.75 / 142.25 / 2 / 0.75).
