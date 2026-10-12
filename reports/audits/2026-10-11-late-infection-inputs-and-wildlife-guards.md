# Late infection needs brightleaf: accepted guard measurement

Measured 2026-10-11 on runtime base `ce6269bdd291b951cfbe0911a896d2edabb7879f` plus the T-261 patch. The accepted
orchestrator decision is commit `3b5966a`: guard the second-worst seed, tolerate
one extinction and one need death above the best measurements, and block three
concurrent losses. The earlier [rejected measurement](2026-10-11-t261-blocked-wildlife.md)
is unchanged; this is a new run and report after that decision.

[Before: exclusive bed holds](../data/2026-10-11-bed-holds-wildlife.json).
[After: late-infection input validation](../data/2026-10-11-late-infection-wildlife.json).

| Runtime | Median | Second-worst | Minimum | Wildlife-free | Extinct | Hunger/thirst deaths |
|---|---:|---:|---:|---:|---:|---:|
| Before | 12.5 | 10 | 3 | 7/12 | 0 | 2 |
| After | 12.5 | 10 | 0 | 8/12 | 1 | 2 |

The second-worst before figure is derived from its twelve recorded survivor
counts. The five guarded bounds are median 11.5, second-worst 8, wildlife-free
6/12, extinction cap 1 and need-death cap 3. Only extinction worsens against the
latest accepted row, within its decided tolerance. The single minimum remains
reported. The annual instrument passes 12 cases and its aggregate guard in
558.97 seconds. Every seed record and hash equals the previous rejected run;
no fixture was changed to admit the fix.

Forest median/minimum is 10/10, taiga 11.5/0, grassland 14.5/14. The absolute
survival target remains unmet: the pooled median passes its target, but the
cohort includes one extinction and two need deaths. T-260 remains the need-death
diagnosis. Taiga seed 4 is named unstable: treatment corrections flip it between
three survivors and extinction. Here its last dwarves bleed out after wolf
attacks on days 105, 106 and 108. It is the first entry in the living instability
record, as the accepted decision specifies.

The clinical fix holds completion when a cleaning job planned without brightleaf
now targets an untreated infection. Ordinary producer cancellation releases its
tool and reservations, and its replacement fetches one brightleaf before curing.
Three stepped cases were red without the fix (planning, waiting for bucket,
final work step); an uninfected control stays green. Five guard-policy cases
were also red first. All 49 focused tests, six static checks, 2,426 full-suite
tests across 275 files (479.39 seconds), and the whole 25-test browser suite
(4.0 minutes) pass. Screenshots are restored. No golden, treatment rate,
cure duration, gameplay balance constant or long fixture changes.

Browser year before and after is exactly the same: 7 living, no hunger/thirst
death, drink 101, meal 59, plant food 50, wealth 2840, hash `54f0bf60c7e768c3`.

Existing guard assertions changed only where the accepted decision replaces the
old rule: the annual minimum guard becomes second-worst; the policy controls
compute the new extinction/need caps and second-worst floor; two simultaneous
tolerated losses are now accepted while three are blocked. The treatment
regressions do not change any existing clinical assertion.
