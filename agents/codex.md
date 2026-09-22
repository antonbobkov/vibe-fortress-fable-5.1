# Handing off tasks to Codex CLI

Reference for running OpenAI's Codex CLI against this repo to delegate a task
(instead of, or alongside, Claude Code).

## Setup

Already authenticated on this machine via ChatGPT (`~/.codex/auth.json`, Plus
plan). No login needed. If `codex` isn't on PATH, run it through npx:

```bash
npx --yes @openai/codex exec ...
```

Or install it globally: `npm install -g @openai/codex`.

## Running a task non-interactively

```bash
codex exec -C "E:\code\vibe-games\vibe-fortress-fable-5.1" -s workspace-write --json "<task prompt>"
```

Key flags:

- `-C, --cd <DIR>` — working root. Always pass this explicitly; don't rely on
  shell cwd.
- `-s, --sandbox <MODE>` — `read-only`, `workspace-write` (needed to let Codex
  edit files), or `danger-full-access`.
- `-a, --ask-for-approval <on-request|never>` — when Codex must pause for
  human approval of a command. Default is interactive approval; for a
  scripted handoff either accept the prompts or use `--approve-for-me` to
  auto-approve through the workspace-write sandbox.
- `--json` — stream events as JSONL (`thread.started`, `item.completed`,
  `turn.completed` with token usage, etc.) instead of TUI output.
- `-o, --output-last-message <FILE>` — write just the agent's final message
  to a file, useful for scripted pickup.
- `-m, --model <MODEL>` — override the model for this run.

After the run, treat it like any other agent's changes: `git status` /
`git diff` before committing. `workspace-write` lets Codex edit files
directly on disk, it doesn't produce a patch to apply.

## Subagents

Codex has a native multi-agent tool (`thread_spawn`) — the model decides on
its own to spawn child "subagent" threads when a task looks parallelizable
or when the prompt asks it to delegate. Each spawn is a real, separate
thread tracked locally.

- **To allow it (default):** do nothing, or explicitly invite it in the
  prompt, e.g. "if this splits into independent parts, spawn subagents to
  parallelize."
- **To hard-disable it:** pass `-c agents.enabled=false`. Verified this
  actually removes the tool from the model — Codex reports no
  `thread_spawn` tool is available rather than just declining to use it.
  Use this when you want a single predictable thread for the whole task.
- **Do not rely on `--disable multi_agent`** — it flips the flag in
  `codex features list` but did not stop spawning in testing on this
  account (ChatGPT/Plus auth appears to gate tool availability
  server-side). `agents.enabled=false` is the reliable lever.
- Browse/manage threads: `codex agents` (TUI browser of all local
  parent/child threads), `codex resume --last` / `codex resume <id>`,
  `codex fork --last`.

## Checking remaining quota (5-hour / weekly)

Interactive: run `codex`, then type `/status`.

Scripted, without opening the TUI — query the same first-party endpoint the
CLI's own status line uses, with the token already stored locally:

```bash
python3 -c "
import json, os, urllib.request
auth_path = os.path.join(os.environ.get('CODEX_HOME', os.path.expanduser('~/.codex')), 'auth.json')
with open(auth_path) as f:
    auth = json.load(f)
tok, acct = auth['tokens']['access_token'], auth['tokens']['account_id']
req = urllib.request.Request(
    'https://chatgpt.com/backend-api/wham/usage',
    headers={'Authorization': f'Bearer {tok}', 'ChatGPT-Account-ID': acct},
)
print(urllib.request.urlopen(req, timeout=15).read().decode())
"
```

Response has `rate_limit.primary_window` (rolling 5h, `used_percent` /
`reset_at`) and `.secondary_window` (weekly). Read-only, doesn't burn any
model usage — safe to poll before/after a handoff.

## Example handoff for this repo

```bash
codex exec -C "E:\code\vibe-games\vibe-fortress-fable-5.1" \
  -s workspace-write -c agents.enabled=false --json \
  -o last_message.txt \
  "Implement <specific scoped task>, following the existing code style in
   src/systems/. Only touch files under <specific path> — do not modify
   unrelated in-progress work. Run npm run typecheck and npm run test
   before finishing, and report any failures instead of leaving them."
```

Notes for scoping a handoff in this repo:

- This is a TypeScript/Vite project ("deepholm"); tests run via
  `vitest`/`playwright`, scripts live in `scripts/*.mjs`. Tell Codex which
  npm scripts to run as a completion check (`typecheck`, `test`, `lint`,
  `gate`).
- Check `git status` first and give Codex an explicit file/directory scope
  so it doesn't collide with work already in progress elsewhere in the
  tree; commit or stash your own uncommitted changes before a
  `workspace-write` run if they overlap.
