# T-123 — The economy fortress cannot run its economy at default priorities

**Source:** F-17 ([`../archive/tasks/F-17-balance-followups.md`](../archive/tasks/F-17-balance-followups.md)) and its re-measure, [`../../reports/audits/2026-10-07-balance-after-f17.md`](../../reports/audits/2026-10-07-balance-after-f17.md) · **Size:** L · **Needs:** — · **Status:** open

**Who:** a diagnosis first, by a strong model (an Opus subagent, or Codex on `gpt-6-astra` at high effort). The fixes it leads to follow the ordinary rules.

## Why

F-17 decided that the three-year economy fortress should play as a competent player would: routine work at the default priority 5, the entrance kept clear, the squad armed first, specialists kept on their craft. Codex rewrote the fixture to do that. The rewrite is on the branch `f-17` (last commit `ffbc723`) and is **not merged**, because the fortress it produces is far worse than the one it replaced.

| | Old fixture (urgent priorities) | Rewritten fixture (default priorities) | Model |
|---|---|---|---|
| Wealth, years 1 / 2 / 3 | 15,107 / 18,638 / 23,698 | 3,423 / 4,338 / 4,950 | 4–8k / 15–25k / 35–60k |
| Mood, daily mean | 34.65 (measured before the runtime fixes) | 50.53 | 55–60 |
| Trades completed | 8 of 8 | 4 of 8 | all |
| Forge, gem and lavish-meal jobs | all complete | 0 | — |
| Peril 0 seeds surviving three years | 7 of 7 (before the runtime fixes) | 3 of 7 | 7 of 7 |

The old-fixture wealth in the first row was measured on 2026-10-07 with the F-17 runtime fixes applied and the old fixture unchanged (`npx vitest run test/scenarios/m8.test.ts -t three_years` on master after the F-17 runtime merge). So the runtime fixes did not break production. The rewrite did.

That leaves a question the balance work cannot go round. The old fixture reaches the wealth model only by making routine work urgent, which lets jobs defer want-level needs and gives a mood of about 35. The rewritten fixture works at default priority, has a mood of about 50, and produces almost nothing. Either the rewrite is a poor player, or the game does not let a fortress at default priorities both keep its dwarves content and run a workshop chain. The second would be a design fault in job selection or need service, and no constant tuning would fix it.

## What to do

1. **Reproduce both.** Run the three-year scenario on master (old fixture) and on `f-17` (rewritten fixture), same seed.
2. **Find where the time goes at default priority.** For the rewritten fixture, account for dwarf-hours by activity over the three years: working, hauling, walking, eating and drinking, sleeping, idle, waiting on a need. Compare with the old fixture. The mood instrument (`test/perf/mood_breakdown.test.ts`) and the economy measurements (`test/scenarios/three_years_measurements.ts`) already collect part of this.
3. **Explain each missing chain.** For forging, gem cutting, lavish meals, beds and trade: which step never happens, and why. Give the tick and the job-board state as evidence, not a guess. Codex's own notes in the report (§ Remaining findings) name some causes: a broker hauling through the trade visit, specialists assigned late, a shaft that stops above the gem band.
4. **Classify every cause** as one of:
   - FIXTURE: a competent player would do it differently, and the game lets them. Say what the script should do.
   - GAME: the game's rules make the sensible play fail. Name the rule, the spec section and the code.
   - BALANCE: a constant makes it too slow. Name the constant and the value that would close it.
5. **Write a new dated report** under `reports/audits/`, and add a `T-1nn` row with a work file for each GAME and BALANCE cause worth fixing, plus one for the fixture.

Do not change simulation code, constants or the fixture in this task.

## Related

- The balance items B-008 … B-012 and T-109 wait on this: no constant should move on the evidence of a fortress that is not playing competently.
- T-122 (civilians do not flee by stairs) limits how deep the rewritten fixture dares to mine.

## Done

- The report exists and each cause carries evidence and a class.
- The follow-up rows are in the backlog.
