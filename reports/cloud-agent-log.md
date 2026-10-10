# Cloud agent log

The running log of the Claude agent that works in the cloud on branches `cloud/main` and `cloud/<task id>`. Its brief is [`../agents/cloud-agent.md`](../agents/cloud-agent.md).

## Ready to merge

- `91dedf3`: T-111 closed. The UI audit follow-up report (`reports/audits/2026-10-10-ui-audit-follow-up.md`) and T-240 … T-252 filed. Documentation only; no source, test or spec change.

## Needs the owner

- **T-252 revises D-U3** (not blocking): it adds an "Embark without an axe?" question, because the Supplies tab calls an axe part of the minimum and a party without one embarks unasked. Look at it before anyone picks T-252 up.

## Entries

### 2026-10-10: started

- `cloud/main` cut from `origin/master` at `4fbe72c`.
- Environment note: the cloud machine has Chromium revision 1194 preinstalled, while `@playwright/test` 1.63 asks for headless shell revision 1243. The browser suite runs against the preinstalled build through a symlink outside the repository; nothing in the repository changed for it.
- Chain A starts with T-196 on `cloud/T-196`; chain B starts with T-111 on `cloud/T-111` beside it.
- Owner's instruction, 2026-10-10: from now on, one subagent at a time, to manage quota. The two already running finish; nothing new starts until both are done, and after that tasks run one by one.

### 2026-10-10: T-111 closed (merge `91dedf3`)

- The walkthrough of the first audit's § 2 was played in Chromium at 1280×800 against `26b6b86`. Of the 89 findings: 65 fixed, 20 partly fixed, 4 open (the code-only draft said 68, 16, 5).
- States corrected by play or code: Issue 2 and M1 → partly (a stockpile made while paused cannot be set up until time runs); § 5.5 → partly (the Jobs panel's empty line is drawn over); 7.19 → partly (the idle-hauler hint now exists, two others are missing).
- New findings, all filed: a raw string key in the stockpile preset list, a status notice that hides the next readout, layout cuts at 1280×800, placement that still looks refused, ungrouped merchant goods, Jobs panel names and filters, the second `d` closing Designate.
- Filed T-240 … T-252, each with a work file. They are unassigned (status `open`).
- Not established: the labor grid with 40+ dwarves; door, lever, trap and cage modes; the colourblind palette; immigration, reputation and load-failure messages.
- Seen in passing, not investigated: the embark dog and cat died within four days, and in the flat-test run five of seven dwarves were dead by Day 10 of Summer. This is T-196's ground.
- Checks: the subagent ran typecheck, lint, content, strings, interface, docs and `npm test` (2242 passed); after the merge into `cloud/main` I re-ran the four checks that read `docs/`. No browser suite: nothing under `src/` changed.
