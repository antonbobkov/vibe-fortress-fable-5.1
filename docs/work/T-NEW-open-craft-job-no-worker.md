# T-NEW — A workshop's open craft job waits for months while its laborers are idle

**Source:** [T-522's report](../../reports/audits/2026-11-07-t522-defence-repel-rate.md) § After the fix · **Size:** S · **Needs:** — · **Status:** open

On `defence-year-7` (`defence_year`, cadence 20, T-522's branch `16fbba04`, with the door rule and the cage order) the carpenter's current job, a `craft` of `make_bed` (order 1), is `open` with no worker and no blocked reason from day 60 to at least day 120, while four dwarves with the carpentry labor are mostly idle (the journal prints them every ten days). A workshop holds one job at a time, so its other orders wait behind it: the cage order at the head of the list (maintain 2, one cage short after the cage trap caught a bandit) is never run, the trap is never rearmed, and the raid of day 122 loots. On the same seed the mechanic's first `make_mechanism` job waited 60 days with no worker holding the mechanics labor.

## Decisions

- Journal the job from creation: who could take it, and why each idle carpenter passes it over (its input search, its work tile, a failed walk, the labor's priority, or the job board's claim order).
- Fix the game if an open job with an idle, able worker is passed over; fix the script if it never gave the labor where the work is.

## Done

- The cause is named, and on `defence-year-7` the carpenter's open job is taken within a day while a carpenter is idle.
