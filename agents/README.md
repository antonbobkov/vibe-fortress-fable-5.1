# Which agent does the work

The owner's standing rules for delegating work in this repository, set on 2026-10-06. The orchestrating Claude session reviews and merges; it does not do the tasks itself.

## The rules

- **Daytime (07:00 to 24:00 local): delegate everything to Codex, and to Gemini when it has quota.** Do not start Claude subagents in these hours.
- **Night (00:00 to 07:00 local): Claude subagents may be used as well**, alongside Codex and Gemini.
- **Pick the subagent's model by the task.** Use Opus 5.5 for the complex work: audits, diagnoses, design decisions, and anything where a wrong conclusion is expensive. Use Sonnet 5.5 for the mechanical work: implementing a decided task from its work file, test authoring, docs triage, merges. This is a guide, not a rule; judge each task. Both spend the same plan limits, and Sonnet spends them more slowly. The `Agent` tool sets the model with its `model` parameter ([claude-subagents.md](claude-subagents.md)).
- **One agent per quota pool at a time.** At most one Codex run, one Gemini run and one Claude subagent (Opus or Sonnet; they share the Claude plan) may run together. Never two from the same pool: agents that share a quota drain it too fast, and both get cut off mid-task.
- **Drain the Codex and Gemini weekly quotas to 0%.** It is fine to start a task that will not finish before the quota runs out. Have each agent commit each piece as soon as it is green, so that a cut-off loses nothing.
- **Audits go to the stronger models.** An audit task (a report under `reports/audits/`) is done by an Opus subagent, within the night hours above, or by Codex on `gpt-6-astra` at high effort. Never give an audit to Gemini. Where an audit has a large mechanical part, such as playing the game through the UI and capturing what it shows, split it: the capture goes to Codex on the ordinary model, and the strong model reads the capture and writes the findings. Fix tasks that come out of an audit follow the ordinary rules.
- **Use judgement and do not stop to ask.** Decide spec gaps, fixes and the order of work, record the decision in the task's work file, and report afterwards. Stop only for a serious blocker.
- **Keep going until the backlog's audits and their fix tasks are done** ([`../docs/backlog.md`](../docs/backlog.md)).

## How to run each pool

| Pool | Notes | Quota check |
|---|---|---|
| Codex (`gpt-6.1-sol`, high effort; `gpt-6-astra`, high effort, for audits) | [codex.md](codex.md) | the usage endpoint in codex.md |
| Gemini (`agy`, Gemini 3.8 Flash High) | [antigravity.md](antigravity.md) | `python agents/agy_usage.py` |
| Claude subagents (Opus 5.5 or Sonnet 5.5) | [claude-subagents.md](claude-subagents.md) (the `model` override), [claude-quota.md](claude-quota.md) | the `get_usage` tool |

## Working practice that has held up

- Give each agent its own `git worktree` on its own branch, created by the orchestrator, with `npm ci` already run. The orchestrator merges into `master`, checks, and pushes.
- **A cloud agent works beside the local one** since 2026-10-10. Its brief is [cloud-agent.md](cloud-agent.md); the backlog marks which rows are its. It pushes to `master` too, so pull before every merge.
- **A change to behaviour under `src/` is not verified until the browser suite has run.** `npm test` does not include `npm run test:e2e`. On 2026-10-08 about twenty bug fixes were merged on `npm test` alone, and one of them left the year-long browser playthrough starving in winter; it went unseen for a day and then blocked two other tasks. The agent runs the full e2e suite before its commit and says so in the commit body; the orchestrator checks for that line before merging. The suite uses fixed ports 5174 and 5175, so only one agent can run it at a time.
- Performance timings taken while another agent runs tests are noisy. Run a speed measurement, and the full gate, when nothing else is running.
- Briefs point at the task's work file in `docs/work/` and at `docs/process/agent-workflow.md`. They do not restate the task.
- When an agent is cut off, resume its session if it can be resumed. Otherwise start a new agent on the same worktree and tell it to begin from the uncommitted work it finds there.
