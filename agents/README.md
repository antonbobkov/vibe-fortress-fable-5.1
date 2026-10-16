# Which agent does the work

The owner's standing rules for delegating work in this repository, set on 2026-10-06. The orchestrating Claude session reviews and merges; it does not do the tasks itself.

## The rules

Changed by the owner on 2026-10-15: Codex and Gemini are no longer used, and the time limits on Claude are lifted.

- **All work goes to Claude subagents, at any hour.** Codex and Gemini are not used any more; their notes below are kept for the record.
- **At most two subagents at a time.** Opus and Sonnet share the Claude plan, so two together drain the 5-hour window faster; have each commit each piece as soon as it is green, so that a cut-off loses nothing, and resume a cut-off agent after the reset.
- **Pick the subagent's model by the task.** Use Opus 5.5 for the complex work: audits, diagnoses, design decisions, and anything where a wrong conclusion is expensive. Use Sonnet 5.5 for the mechanical work: implementing a decided task from its work file, test authoring, docs triage, merges. This is a guide, not a rule; judge each task. Sonnet spends the plan limits more slowly. The `Agent` tool sets the model with its `model` parameter ([claude-subagents.md](claude-subagents.md)).
- **Two agents never share a worktree or touch the same files.** Give each its own worktree and a set of tasks that do not overlap.
- **Audits go to Opus.** An audit task (a report under `reports/audits/`) is done by an Opus subagent. Fix tasks that come out of an audit follow the ordinary rules.
- **Use judgement and do not stop to ask.** Decide spec gaps, fixes and the order of work, record the decision in the task's work file, and report afterwards. Stop only for a serious blocker.
- **Keep going until the backlog's audits and their fix tasks are done** ([`../docs/backlog.md`](../docs/backlog.md)).

## How to run each pool

Codex and Gemini are retired (2026-10-15); their rows stay for reference.

| Pool | Notes | Quota check |
|---|---|---|
| Codex (`gpt-6.1-sol`, high effort; `gpt-6-astra`, high effort, for audits) | [codex.md](codex.md) | the usage endpoint in codex.md |
| Gemini (`agy`, Gemini 3.8 Flash High) | [antigravity.md](antigravity.md) | `python agents/agy_usage.py` |
| Claude subagents (Opus 5.5 or Sonnet 5.5) | [claude-subagents.md](claude-subagents.md) (the `model` override), [claude-quota.md](claude-quota.md) | the `get_usage` tool |

## Working practice that has held up

- **A subagent reports each commit itself.** Every brief says: after each commit that closes, parks or leaves a task as WIP, send one line to `main` with SendMessage (`<hash> T-123 closed`). The orchestrator merges on that message and on the agent's final report; it does not poll the branches.
- **Every change under `src/` is reviewed before the merge** by someone other than its author: a second agent (Opus reviewing Sonnet, or the reverse) or the orchestrator reading the diff, with the checklist in `docs/process/agent-workflow.md` § Review. A review counts against the two-agent limit when an agent does it.
- **Only the orchestrator edits `docs/backlog.md`.** Agents end a task with `Closes:` and `New rows:` lines; the orchestrator runs `node scripts/close-task.mjs T-123 <commits>` in the merge and adds the new rows. This ends the backlog conflicts at almost every merge.
- **Agents run the static checks, the affected tests, the whole browser suite for a behaviour change and the annual instrument for a simulation change; the full `npm test` runs once, on `master`, before the push** (agent-workflow.md § Verifying).
- Give each agent its own `git worktree` on its own branch, created by the orchestrator, with `npm ci` already run. The orchestrator merges into `master`, checks, and pushes.
- **A cloud agent works beside the local one** since 2026-10-10. Its brief is [cloud-agent.md](cloud-agent.md); the backlog marks which rows are its. It works in its own worktrees on branches `cloud/main` and `cloud/<task id>` and never pushes to `master`. The local orchestrator merges `cloud/main` into `master`: fetch, read the "Ready to merge" section at the top of `reports/cloud-agent-log.md` on that branch, re-run the checks with the browser suite, merge.
- **A change to behaviour under `src/` is not verified until the browser suite has run.** `npm test` does not include `npm run test:e2e`. On 2026-10-08 about twenty bug fixes were merged on `npm test` alone, and one of them left the year-long browser playthrough starving in winter; it went unseen for a day and then blocked two other tasks. The agent runs the full e2e suite before its commit and says so in the commit body; the orchestrator checks for that line before merging. The suite uses fixed ports 5174 and 5175, so only one agent can run it at a time.
- **No agent kills processes by image name.** On 2026-10-12 a subagent ran `taskkill /F /IM node.exe` to stop its own sweep and killed the test workers of another agent on the same machine. Every brief says: kill only the pid you started.
- Performance timings taken while another agent runs tests are noisy. Run a speed measurement, and the full gate, when nothing else is running.
- Briefs point at the task's work file in `docs/work/` and at `docs/process/agent-workflow.md`. They do not restate the task.
- When an agent is cut off, resume its session if it can be resumed. Otherwise start a new agent on the same worktree and tell it to begin from the uncommitted work it finds there.
