# Handing off tasks to Codex CLI

Reference for running OpenAI's Codex CLI against this repo to delegate a task
(instead of, or alongside, Claude Code).

## Setup

Already authenticated on this machine via ChatGPT (`~/.codex/auth.json`, Plus
plan). No login needed.

`codex` is **not on PATH** (neither Git Bash nor PowerShell). Two ways to run
it:

```powershell
# 1. the installed binary — RESOLVE IT, never hard-code the hashed directory
$CODEX = (Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
& $CODEX exec ...

# 2. npx (slower, re-resolves the package each run)
npx --yes @openai/codex exec ...
```

**Do not pin the path.** Codex self-updates into a new hashed directory and deletes
the old one, so a literal path dies without warning:
`The term '...\bin\247581e40ee272fb\codex.exe' is not recognized`. Seen 2026-09-26,
when 0.156.0 at `247581e40ee272fb` became 0.158.0-alpha.2 at `d23520d1e41bfb24`.
The `Get-ChildItem … Sort-Object LastWriteTime` form above survives an update.

Versions seen working: **0.156.0**, **0.158.0-alpha.2**. After an update, re-check
the flags you rely on — 0.156 had already removed `-a`/`--ask-for-approval`. In
0.158.0-alpha.2, `exec` still accepts `-C`, `-m`, `-s`, `-c` and `-o`
(verified).

### Model

**Always pass the model and reasoning effort explicitly on every run:**

```
-m gpt-6.1-sol -c model_reasoning_effort="high"
```

That pair *is* "GPT-6.1 Sol High", the model the owner chose on 2026-10-03.
Earlier milestones (M4 to M8-04) ran on `gpt-6-sol`. Do not drop back to it unless
the owner says so.

**Audits use `gpt-6-astra`.** The owner asked (2026-10-06) for audit tasks to run on the stronger model: `-m gpt-6-astra -c model_reasoning_effort="high"`. Its default reasoning level is also low, so pass the effort flag. Everything else stays on `gpt-6.1-sol`.

**The effort flag matters more on 6.1.** Its default reasoning level is **low**;
`gpt-6-sol` defaulted to medium. A run without `-c model_reasoning_effort="high"`
silently does much less reasoning. The levels it accepts are low, medium, high,
xhigh, max and ultra. "ultra" adds automatic task delegation, so avoid it here.

To check which model slugs the CLI knows, and each one's levels and default, read
`~/.codex/models_cache.json` (no TUI needed):

```bash
python -c "import json;[print(m['slug'],m['default_reasoning_level']) for m in json.load(open(r'C:/Users/anton/.codex/models_cache.json'))['models']]"
```

`~/.codex/config.toml` currently happens to set the same two values
globally, but never rely on it — that file is shared with the Codex desktop
app and the interactive TUI, and any of them can change it at any time. A
silent switch to a different model or a lower reasoning effort mid-milestone
is exactly the kind of surprise that is expensive to notice after the fact.
Passing both flags makes each run self-describing and reproducible from the
shell history alone.

## Running a task non-interactively

```bash
codex exec -C "E:\code\vibe-games\vibe-fortress-fable-5.1" -s workspace-write --json "<task prompt>"
```

Key flags:

- `-C, --cd <DIR>` — working root. Always pass this explicitly; don't rely on
  shell cwd.
- `-s, --sandbox <MODE>` — `read-only`, `workspace-write` (needed to let Codex
  edit files), or `danger-full-access`.

  **`workspace-write` cannot run this repo's test suite.** Under the Windows
  sandbox (`[windows] sandbox = "unelevated"`) Node cannot spawn child
  processes, so Vitest dies at startup with esbuild `spawn EPERM`. Typecheck
  still works; `npm test`, `lint` and e2e do not. Since every task here is
  only done once the suite is green, a real handoff needs
  **`-s danger-full-access`** (verified: Vitest runs normally). There is no
  middle setting — `windows.sandbox` only accepts `elevated` or
  `unelevated`, not `none`.
- `--approve-for-me` — auto-approve command requests through the
  workspace-write sandbox. **`-a` / `--ask-for-approval` no longer exists in
  0.156** (`error: unexpected argument '-a' found`); this flag replaced it.
  In practice `-s workspace-write` alone runs unattended fine.
- `--json` — stream events as JSONL (`thread.started`, `item.completed`,
  `turn.completed` with token usage, etc.) instead of TUI output.
- `-o, --output-last-message <FILE>` — write just the agent's final message
  to a file, useful for scripted pickup.
- `-m, --model <MODEL>` — the model for this run. Always pass it; see
  [Model](#model) above. Reasoning effort is a separate setting and needs its
  own `-c model_reasoning_effort="<low|medium|high>"`.

After the run, treat it like any other agent's changes: `git status` /
`git diff` before committing. `workspace-write` lets Codex edit files
directly on disk, it doesn't produce a patch to apply.

## Resuming an interrupted run

Quota aborts are the normal way a long handoff dies here (`ERROR: You've hit
your usage limit … try again at <time>`, exit code 1). The session is still
recorded, so you can continue it instead of starting cold:

```powershell
# continue the most recent session for this cwd, with a follow-up prompt
Get-Content next-step.txt -Raw |
  & $CODEX exec resume --last `
    -m gpt-6.1-sol -c model_reasoning_effort="high" `
    -s danger-full-access -c agents.enabled=false `
    -o last_message.txt -

# or resume a specific session
& $CODEX exec resume <SESSION_UUID> -m gpt-6.1-sol ... "<prompt>"
```

- `codex exec resume [SESSION_ID] [PROMPT]`, or `--last` for the newest.
  `-` as the PROMPT reads it from stdin, same as a fresh `exec`.
- **`resume` takes neither `-s/--sandbox` nor `-C/--cd`** — passing `-s` fails
  with `error: unexpected argument '-s' found`. Set the sandbox through the
  config override instead, which is verified to work:
  `-c sandbox_mode="danger-full-access"`. And since there is no `-C`, the
  shell's own working directory must already be the repo.
- Sessions are filtered by cwd by default; `--all` disables that filtering.
- **Finding the id:** sessions are recorded as
  `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<timestamp>-<uuid>.jsonl`, and
  the uuid in the filename is the SESSION_ID. `codex exec --json` also prints
  a `thread.started` event with the id at the start of a run — capture it if
  you expect to need a resume later.
- `codex exec fork <ID>` branches a session instead of continuing it, when you
  want to retry a step without losing the original.

**When resume is worth it:** the model keeps everything it already read and
decided, which on a milestone-sized task is a large fraction of the run's
cost. **When to start fresh instead:** a genuinely new task, or when the old
session went down a wrong path you don't want it anchored to — a cold run with
a good prompt beats resuming a confused one.

A quota abort usually also logs two scary-looking errors:

```
ERROR codex_core::tools::router: error=write_stdin failed: Unknown process id 5577
ERROR codex_core::session: failed to record rollout items: thread … not found
```

**Neither means the session is lost.** Verified on session
`01a0d1bd-…`, killed by the weekly limit: its rollout file was still written
in full — 413 entries, 2.2 MB, a valid `session_meta` first line and a normal
`item_completed` last line. The errors concern an in-memory thread handle and
a killed child process at shutdown, not the on-disk record. So `resume` works
after a quota abort; just confirm the rollout file for that uuid exists and is
non-trivial before relying on it.

**Not every abort is quota.** On 2026-10-03, a `gpt-6.1-sol` run ended mid-task with
`{"type":"error","message":"Selected model is at capacity. Please try a different model."}`
then `turn.failed`, while the usage endpoint showed only 22% of the 5-hour window used.
This is a transient server-side capacity error: resume the same session straight away,
with no wait for a reset. The `-o` last-message file is **not written** on such an abort,
so read the end of the `--json` stream (`turn.failed`) to tell why it stopped.

Keep a written state summary in the follow-up prompt anyway — this repo's
workflow (commits per task, `docs/backlog.md`, one work file per task in `docs/work/`) already makes the
tree self-describing, so a cold restart is never fatal.

Also: the CLI's "try again at &lt;time&gt;" in the error names whichever window is
binding. When the weekly is the one exhausted it quotes a date days away, not
the next 5-hour reset — read it as the weekly, and confirm with the usage
endpoint below rather than assuming a short wait.

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

Interactive: run `codex`, then type `/status`. (`codex models` and other TUI
subcommands fail with "stdin is not a terminal" when run from a tool call.)

Scripted, without opening the TUI — query the same first-party endpoint the
CLI's own status line uses, with the token already stored locally:

On this machine the interpreter is `python`, not `python3`:

```bash
python -c "
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

Both windows are `used_percent` + `reset_at` (unix seconds):
`primary_window` = rolling 5 h, `secondary_window` = weekly.

## Example handoff for this repo

A long prompt is best kept in a file and piped in as stdin (pass `-` as the
prompt), which avoids quoting problems in PowerShell:

```powershell
$CODEX = (Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
Get-Content prompt.txt -Raw |
  & $CODEX exec -C "E:\code\vibe-games\vibe-fortress-fable-5.1" `
    -m gpt-6.1-sol -c model_reasoning_effort="high" `
    -s danger-full-access -c agents.enabled=false `
    -o last_message.txt -
```

**From a Claude Code session, launch it detached.** Background shell commands and
monitors there are stopped after about 30 minutes, and stopping the wrapper kills Codex
with it. This is the same limit as agy (see antigravity.md). Run the pipeline inside a
detached PowerShell instead and watch git and the PID:

```powershell
$cmd = "Get-Content '<brief>' -Raw | & '$CODEX' exec -C '<repo>' -m gpt-6.1-sol " +
       "-c model_reasoning_effort=`"high`" -s danger-full-access -c agents.enabled=false " +
       "--json -o '<out.txt>' - > '<run.jsonl>' 2> '<run.err.txt>'"
$proc = Start-Process powershell.exe -ArgumentList @('-NoProfile','-Command',$cmd) `
          -WorkingDirectory '<repo>' -WindowStyle Hidden -PassThru
```

The `.jsonl` written through PowerShell's `>` is UTF-16. To confirm the model and effort
actually used, grep the session's rollout file instead:
`grep -o '"model":"[^"]*"\|"effort":"[^"]*"' ~/.codex/sessions/<Y>/<M>/<D>/rollout-*-<thread>.jsonl | sort | uniq -c`.
For a parallel task, run it in a `git worktree` on its own branch. Its first step must
be `npm ci`, because a new worktree has no `node_modules`.

A milestone-sized handoff runs long; allow a generous timeout and stream the
tail of stdout rather than waiting silently.

Notes for scoping a handoff in this repo:

- This is a TypeScript/Vite project ("deepholm"); tests run via
  `vitest`/`playwright`, scripts live in `scripts/*.mjs`. Tell Codex which
  npm scripts to run as a completion check (`typecheck`, `test`, `lint`,
  `gate`).
- Check `git status` first and give Codex an explicit file/directory scope
  so it doesn't collide with work already in progress elsewhere in the
  tree; commit or stash your own uncommitted changes before a
  `workspace-write` run if they overlap.
