# Running Claude agents on a chosen model

How the orchestrating Claude session starts Claude agents, and what was found about starting them from the command line. Companion to [codex.md](codex.md), [antigravity.md](antigravity.md) and [claude-quota.md](claude-quota.md). Checked on 2026-10-06 in a Claude Code desktop session (Claude Code 2.1.289, orchestrator on Sonnet 5.5).

## Subagents can use a different model than the orchestrator

**Verified.** The `Agent` tool takes an optional `model` parameter (`sonnet`, `opus`, `haiku` or `fable`) that overrides the model for that one subagent. The orchestrator does not have to share its model with the agents it starts.

The test: the orchestrator (Sonnet 5.5, `claude-sonnet-5-5`) started a subagent with `model: "haiku"` and asked it to quote the model its own system prompt names. It answered "Haiku 4.5, `claude-haiku-4-5-20251001`". The run cost about 45k tokens and 6 seconds.

- **Not tested:** an upgrade, such as Sonnet to Opus. The `model` parameter accepts `opus`, so it should work, but no Opus subagent was started because the standing rule in [README.md](README.md) forbids them from 07:00 to 24:00 local.
- If `model` is omitted, the subagent uses the agent type's own model, else the orchestrator's.
- Subagents spend the same account limits whatever the model; see [claude-quota.md](claude-quota.md).

How to start one, from the orchestrator:

```
Agent({
  description: "<3-5 words>",
  subagent_type: "general-purpose",
  model: "opus",            // or "sonnet", "haiku", "fable"
  prompt: "<self-contained brief>"
})
```

Give the agent a worktree you created yourself, as [README.md](README.md) says; the `isolation: "worktree"` option's automatic worktree was destroyed when an agent was stopped.

## Starting Claude from the command line: not needed, and not set up

No command-line launches are used or documented for Claude, as the owner decided on 2026-10-06. For anyone who revisits it, what was found:

- The desktop app bundles a `claude` CLI (2.1.289) at `%APPDATA%\Claude\claude-code\<version>\<hash>\claude.exe`. It is not on PATH. `claude --help` shows `-p/--print`, `--model <alias|full name>`, `--effort`, `--output-format json|stream-json`, `--permission-mode`, `--bg` and `claude agents`.
- **It is not signed in.** `claude auth status` reports `loggedIn: false`, and `~/.claude/.credentials.json` holds empty token placeholders. The desktop app keeps the real tokens and refreshes them only for sessions it starts itself, so a `claude -p` launched from a shell cannot use them.
- **Failure is easy to miss.** `claude -p ... --output-format json` without credentials printed `"is_error": true`, `"result": "Failed to authenticate: OAuth session expired and could not be refreshed"` and still exited with code 0. Any script around it must check `is_error`, not the exit code.
- No authenticated run was made, so every other flag is unverified here. Signing in (`claude auth login` or `claude setup-token`) would be the owner's step, done in their own terminal.
