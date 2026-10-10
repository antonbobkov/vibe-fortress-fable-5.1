# T-188 reproduction after the barrel and wild-spawn fixes

Measured on `codex-a` at `23d58fa`, with the rewritten fortress files from `f-17` commit `ffbc723`. The frozen walking-speed probe was run without priority, command, capacity or timing changes. The creature speed column was scaled in a private registry in each instrument process by 2/3 or 7/6, with the original rounding, to reproduce dwarf speeds 100 and 175. No tracked content file was edited.

| Dwarf speed | End day | Population | Drink | Completed brews | Deaths |
|---|---:|---:|---:|---:|---|
| 100 | 152 | 0 | 0 | 17 | Seven combat deaths, then five starvation deaths on days 123-126 |
| 175 | 277 | 37 | 390 | 199 | None |

The 175 reproduction no longer has the reported fetching stall. It reaches days 112 and 224 without any dwarf death and continues brewing through day 277.

At speed 100, badgers kill five dwarves at ticks 87,647-90,932 (days 73-76), and boars kill two more at ticks 100,437 and 103,692 (days 84 and 86). This leaves five dwarves, including two with brewing enabled. Brew 1760 is claimed at tick 108,301; its successor, 1764, is created at tick 108,862 (day 90.718). Unlike the historical partly delivered job 2206, job 1764 has no delivered or reserved input and never gets claimed. Drink reaches zero again on day 110. The remaining dwarves die at ticks 147,602-151,202.

The collapse repeats in two additional observational runs to day 127, including identical death ticks and 17 completed brews. The assignment trace records 39 requests by enabled brewers while an open brew exists. The brew is eligible in all 39; one request claims its predecessor 1760. For the successor, the board chooses farm or kitchen work instead. Candidate pools contain at most 19 jobs, below `CANDIDATE_LIMIT`; neither a missing labor nor exclusion by the candidate limit explains the open brew. For example, at tick 111,297 dwarf 16777297 takes kitchen job 1763 with cooking skill 5 instead of brew 1764 with brewing skill 0; both have effective priority 4. At tick 113,144 dwarf 16777296 takes harvest 1767 instead of brew 1764. Daily observations show both brewers conscious, with work available, alternating other jobs and needs. They are not free workers being ignored by the assignment queue.

This is a different reproduction from the original reservation stall, after wild animals began spawning. The current assignment code follows the priority/distance/skill rule in system 11. The evidence does not justify changing that formula, need rates, or the fixture's priorities and capacity. T-188 remains open: its no-starvation completion criterion is not met. The next step needs an owner decision on how this older, slower fixture should be qualified in the presence of wild predators and competing work; no fixture tuning was done here.

[Compact observations](../data/2026-10-09-t188-reproduction-summary.json) retain death ticks, actual assignment results and copied primitive worker observations. Derived distance/score fields and mutable worker/activity references from the scratch logger are deliberately omitted. The unchanged original instrument is [the walking-speed probe](../data/2026-10-09-walking-speed-probe.ts.txt); its source report gives the reproduction environment. Three-year fixture migration remains T-145.
