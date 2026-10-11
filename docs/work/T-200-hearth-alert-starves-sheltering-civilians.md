# T-200 — A hearth alert held for days starves the civilians who shelter

**Source:** T-221 (the answer to wildlife in `test/e2e/full-year.spec.ts`; see the commit `894a0fc` message for the variants tried) · **Size:** S · **Needs:** — · **Status:** open (decision first)

## Why

Under a `hearth` alert a civilian goes to the hearth hall and stays there until the alert ends, and nothing in that state sends it to eat or drink. A fortress that keeps the alert up while a pack of wolves stays near therefore starves, with food and drink in stock.

Seen in the deterministic `full-year` playthrough (world `e2e-year`, the Balanced embark, wolves near the wagon from day 60), while the playthrough was being written:

- Alert set to `hearth` when a wolf bit a dwarf (day 61) and kept there until no predator was near: from day 62 `Starving` fired for every dwarf, and every dwarf of the fortress was dead of starvation on days 78 and 79, with 100 drinks and 25 meals in stock. Without any alert, the same year ended with no `Starving` event.
- Alert alternating between `hearth` for 600 ticks and `watchful` for 600 ticks: 8 `Starving` events between days 62 and 79 (no starvation death). With `hearth` for 300 ticks and `watchful` for 1,500, none.

Thirst rises 1.6 an hour and reaches its maximum in about two and a half days, so a hall that is sealed in by an alert for that long has no way out for a dwarf that is thirsty.

## What the spec says

`10-dwarves.md` § Behavior selection: step 2, `retreat`, "path to the hearth hall … stay until the alert ends", comes before step 4, `need` (critical), "satisfy the most critical need. Always applies to soldiers on duty as well as civilians". Step 1, `flee`, says in so many words that "critical needs override this avoidance"; step 2 does not. `16-combat.md` § Alerts: "There is no automatic alert change". Nothing in the spec says how long a player may keep `hearth` up.

## What to do

Decide, then write it into `10` § Behavior selection and `24` where the alert is explained:

1. **A critical need overrides the retreat**, as it overrides `flee`: a dwarf at its critical hunger or thirst leaves the hall to eat or drink, and returns when the need is served while the alert lasts. This is the smaller change and keeps `hearth` from being a trap.
2. Or leave the rule and say so in the alert's help text and the manual: `hearth` is for minutes, and food and drink must be stored in the hall.

Whichever is chosen, a test: a fortress with food and drink in stock under `hearth` for five days has no `Starving` event (rule 1), or the help text says what rule 2 promises.

## Done

- The rule is in the spec, and a regression test pins it.
- `full-year` may then hold `hearth` for as long as a predator is near, if its owner wants that response.
