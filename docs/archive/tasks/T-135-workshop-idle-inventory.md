# T-135 - Give workshop idle a dedicated stepped scenario

Closed by `T-157 follow-up: cover workshop idle with a dedicated stepped scenario`.

**Source:** the owner, 2026-10-10, T-157 integration follow-up | **Size:** S | **Needs:** T-157 | **Status:** in progress (codex-a)

## Finding and resolution

After merging the soldier-needs change, the short-scenario inventory has no
delivered `WorkshopIdle`. Identify its previous producer and compare the runs;
check the result against [workshop operation](../../02-systems/12-workshops-and-professions.md).

Cover the workshop's blocked-to-idle transition with a dedicated small stepped
scenario: add an order with missing input, observe one block, remove the order,
observe one idle event, and step further to prove neither event repeats. Do not
change simulation behavior to preserve an incidental producer in another scenario.
Make the transition rule explicit in the workshop specification and name the new
scenario in acceptance tests. Keep long instruments in their own suites rather
than rerunning the new military instruments in the inventory.

## Done

The inventory reaches `WorkshopIdle` through the dedicated scenario, the historical
producer and reason are recorded in the commit body, all six static checks and
`npm test` pass, and goldens are unchanged. This is test/spec coverage only.
