# Checking Claude Code quota

How to read the Claude Code plan limits and a session's context window from inside a session, and what the numbers mean when planning agent work. Companion to [codex.md](codex.md) and [antigravity.md](antigravity.md), which cover the same for Codex and Gemini.

## How to check

The quota is read with a tool, not an SDK call. In a Claude Code desktop session the tool is `mcp__ccd_session_mgmt__get_usage`. It is read-only and costs no model usage beyond the call itself.

1. The tool is deferred, so load its schema first: call `ToolSearch` with the query `select:mcp__ccd_session_mgmt__get_usage`.
2. Call the tool. It takes one optional parameter:

   | Parameter | Meaning |
   |---|---|
   | `session_id` | Whose context window to report: a session id from `list_sessions`, or `"self"` (the default) for this session. The plan limits are the account's either way. |

There is no command-line or HTTP equivalent documented here. A subagent can call the tool the same way if the tool is available to it.

## What it returns

Two sections. The values below are an example of the shape, not a reading.

```json
{
  "plan": {
    "status": "ok",
    "plan": "Pro",
    "windows": [
      { "label": "5-hour limit", "percentUsed": 26, "resetsAt": "2026-10-07T06:30:00.307Z", "resetsIn": "4h 47m" },
      { "label": "Weekly · all models", "percentUsed": 13, "resetsAt": "2026-10-13T14:00:00.307Z", "resetsIn": "6d 12h" }
    ],
    "extraUsage": { "enabled": false, "currency": "USD" }
  },
  "context": {
    "session": "self",
    "status": "ok",
    "tokensUsed": 842447,
    "contextWindow": 1000000,
    "percentUsed": 84,
    "autoCompactsAtPercent": 97,
    "categories": [
      { "name": "Messages", "tokens": 772313, "percent": 77 },
      { "name": "System tools", "tokens": 42915, "percent": 4 }
    ]
  }
}
```

### `plan`: the account's limits

- **`windows`** is a list, one entry per limit the app's usage card shows. Expect a 5-hour limit and a weekly limit for all models; a plan may also show per-model weekly limits. Read them by `label`, not by position.
- **`percentUsed`** is how much of that window is spent. **`resetsAt`** is an ISO 8601 UTC timestamp, and **`resetsIn`** is the same thing in words.
- **`extraUsage`** says whether paid overage is switched on.

### `context`: one session's context window

- **`tokensUsed`**, **`contextWindow`** and **`percentUsed`** describe how full the window is. The window size depends on the model and plan, so read it from the response.
- **`autoCompactsAtPercent`** is where the session summarises its history automatically. Read it from the response too; it is not a fixed number.
- **`categories`** lists the largest consumers: messages, system tools, MCP tools, skills, the system prompt and memory files.

### `status`

Each section has its own `status`:

| Status | Meaning |
|---|---|
| `ok` | The figures are current. |
| `unavailable` | They could not be read now. The response's note says whether asking again helps. For `context`, an idle, starting or archived session reports this. |
| `not_applicable` | Plan limits do not apply here: the session runs on an API key, Bedrock, Vertex or a gateway. |

## Using it when running agents

- **Subagents spend the same account limits.** An Opus subagent that stops with "You've hit your session limit · resets …" has hit the 5-hour window, and so has every other agent on the account. The reset time in that message is the `resetsAt` of the 5-hour window.
- **Check before starting a batch, not after.** In this project, two Opus subagents running in parallel have repeatedly used up a 5-hour window in roughly one and a half to two hours, each time cutting both off mid-task.
- **An agent cut off by the limit loses nothing that is committed.** Tell every agent to commit each piece of work as soon as it is green, and give each agent a worktree that you created yourself, so that an interrupted agent's files stay on disk.
- **The weekly window is the one to plan around.** When it is nearly spent, hand new work to another pool (see [codex.md](codex.md) and [antigravity.md](antigravity.md)) and keep Claude for review and merging.
- **Watch the session's own context as well.** A long orchestration session fills up with reports and tool output. Near `autoCompactsAtPercent` the history is summarised, so keep the durable state in the repository (the backlog, work files and commit messages) and not only in the conversation.
