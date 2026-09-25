# Handing off tasks to Antigravity CLI (`agy`)

Reference for running Google's Antigravity CLI (`agy`) against this repo to
delegate a task, with **Gemini 3.8 Flash (High)** as the model. Sibling of
[codex.md](codex.md); same shape, different tool.

Everything below was verified on this machine (Windows 10, agy **1.2.11**,
2026-09-25) unless marked **unverified**.

## Setup

`agy` is installed once, in the real `%LOCALAPPDATA%\agy\bin\agy.exe` and on the
User PATH, via Google's installer (`irm https://antigravity.google/cli/install.ps1
| iex`, SHA512-checked). Plain `agy` works in a new terminal; the examples below
use `$AGY` only so they also work in shells that started before the PATH change.

```powershell
$AGY = "$env:LOCALAPPDATA\agy\bin\agy.exe"
& $AGY --version        # 1.2.11
```

It self-updates in the background; `agy update` forces it.

**Pitfall if you ever reinstall from an agent:** the Claude desktop app is
MSIX-packaged and has a *virtualized* `%LOCALAPPDATA%`. An installer run from a
Claude Code shell lands in the app's private store
(`...\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\agy`) and is invisible to your
own terminal (`The system cannot find the path specified`), even though the PATH
entry it adds is real. Install from your own terminal instead.

**Auth:** signed in with a Google account on the AI Pro plan. Headless (`-p`) runs
use that account. The interactive first-run steps (theme, terms, sign-in, and
"Do you trust this folder?" for the repo) were completed by you in a normal
terminal; an agent should not click through those on your behalf. A new folder
will show the trust prompt again.

### Model

**Always pass the model explicitly on every run:**

```
--model gemini-3.8-flash-high
```

The reasoning level is baked into the slug (`-high` / `-medium` / `-low`), so no
`--effort` is needed. (`--model gemini-3.8-flash --effort high` is also
accepted; passing `--effort high` alongside the `-high` slug is harmless.) Same
reasoning as codex.md: the desktop app and TUI share `~/.gemini` state and can
change defaults, so never rely on it. An unknown slug exits 1 with the list of
valid models, so a typo cannot silently fall back. `agy models` lists them:

```
gemini-3.8-flash-{high,medium,low}   gemini-3.7-flash-*   gemini-3.6-flash-*
gemini-3.1-pro-{high,low}   claude-sonnet-4-6   claude-opus-4-6-thinking
gpt-oss-120b-medium
```

## Running a task non-interactively

```powershell
Set-Location E:\code\vibe-games\vibe-fortress-fable-5.1     # agy has no -C flag
& $AGY -p="<task prompt>" --model gemini-3.8-flash-high `
  --dangerously-skip-permissions --output-format json > last_run.json
```

Key flags:

- `-p` / `--print` / `--prompt` — run one prompt and exit. **The prompt must be
  attached** (`-p="..."`) or immediately follow `-p`; `-p --model x` makes agy
  take `--model` as the prompt and exit 2. Both `-p="..."` and `-p "..."` work in
  PowerShell and Git Bash.
- **Working directory = the process cwd.** There is no `-C`. `cd` into the repo
  first (the init event echoes the `cwd` it used). `--add-dir <DIR>` (repeatable)
  adds extra writable directories.
- `--output-format text|json|stream-json` — `json` gives one envelope
  (`conversation_id`, `status`, `response`, `usage`, and `denied_actions` if
  anything was refused); `stream-json` gives NDJSON `init` / `step_update` /
  `result` events, comparable to codex's `--json`.
- `--print-timeout <dur>` — default is now unlimited (was 5 min). Always set it on
  unattended runs. **It caps the total run, not silence.** In `-p` mode stdout is
  buffered until exit (the output file stays 0 bytes for the whole run), so there
  is no idle timeout to be had: the flag kills the run at N minutes whether it is
  healthy or wedged. Healthy milestone-sized runs here take 30–90 min and a
  multi-fix batch can exceed two hours, so keep it generous — **4h** is the value
  in use. See [Stalls](#stalls-and-the-npx-trap) below.
- `--conversation <id>` / `-c, --continue` — resume (below).
- `--mode accept-edits|plan` — session execution mode.
- `--sandbox` — accepted but, per the docs, terminal sandboxing exists only on
  macOS (Seatbelt) and Linux (nsjail). **Treat Windows as unsandboxed.**
- Exit codes: `0` ok, `1` bad flag/model/auth, `2` bad usage or unsupported
  stream input, `3` model/agent error mid-run (with an `AGY_ERROR: {...}` JSON
  line on stderr; documented in the changelog, **unverified** here).

### Permissions: the big gotcha

In headless mode file reads and **writes inside the workspace are auto-allowed**
(verified: it created `hello.txt`). **Shell commands are not**: agy cannot
prompt, so it denies the command, then **exits 0 with `"status":"SUCCESS"` and an
empty `response`**. The only signals are `denied_actions` in the JSON envelope
and a stderr notice starting `jetski: no output produced`. A "successful" run that
silently skipped `npm test` is exactly the failure to guard against, so check
`denied_actions` after every run.

Since a repo handoff always needs `npm run typecheck` / `test` / `lint`, use:

- **`--dangerously-skip-permissions`**: verified, shell commands then run. It
  approves *everything* (writes anywhere it can reach, any command), and there is
  no OS sandbox on Windows to contain it. Only use it with a tightly scoped prompt
  on a clean or committed tree. (Same trade-off as `-s danger-full-access` in
  codex.md.)
- Narrow allow-rules (`{"permissions":{"allow":["command(git)"]}}`) are the
  documented alternative, but a **workspace** `.agents/settings.json` was
  **ignored** in testing: `command(git)`, `command(git status)`,
  `command(regex:git .*)` and `command(git *)` all still ended in `denied_actions`.
  Not tried at user level (`~/.gemini/antigravity-cli/settings.json`) because it is
  your global config. Treat allow-rules as **unverified**.

The agent's shell on Windows is PowerShell (`run_command`), so write commands in
the prompt as PowerShell.

### Long prompts

There is no stdin prompt: piped stdin is **not** appended to `-p` (verified; the
model never sees it). Put the task in a file and point at it (file reads in the
workspace are auto-allowed; verified):

```powershell
& $AGY -p="Read agents\tasks\next.md in the current directory and follow it exactly." `
  --model gemini-3.8-flash-high --dangerously-skip-permissions --output-format json > last_run.json
```

For many turns in one process there is `--input-format stream-json` (NDJSON
`{"event":"user","message":{"content":"..."}}` lines on stdin, requires
`--output-format stream-json`). Slash commands are rejected there.

`-p` output is clean when piped or redirected on 1.2.11 (an older "no output unless
a real TTY" problem reported online did not reproduce). Diagnostics go to stderr;
in Windows PowerShell 5.1 don't use `2>&1` on it (it wraps each line in a
`NativeCommandError`); use `2>$null` or redirect stdout only.

## Stalls and the npx trap

**Observed 2026-09-25:** a four-fix handoff committed its first fix, then hung for
nearly two hours having produced no output at all. The cause: the agent wrote a
perf test and ran it with an ad-hoc

```
npx tsx -e "import { runYearOneScript } from './test/perf/year_one_seeds.test'; ..."
```

`tsx` is not a dependency of this project, so `npx` had to fetch it, and npx
cannot prompt in a non-interactive shell — it waited for an answer that never
came. The process had used **1.1 seconds of CPU in 115 minutes**.

Three layers, in order of value:

1. **Prevent it.** Run agy with `npm_config_yes=1` in the environment, so an npx
   fetch auto-confirms instead of blocking. This removes the whole failure class.
   Also tell the agent in its brief: *use only the project's own npm scripts
   (`lint`, `typecheck`, `content:check`, `test`, `test:e2e`, `test:perf`,
   `golden:update`, `gate`); `npx vitest` is fine because vitest is a
   devDependency; never `npx <tool>` for a tool not already in package.json.*
2. **Tell it not to poll.** Left alone, agy launches long commands in the
   background and then burns turns saying "Waiting for the background task to
   complete" — one run did that ~25 times. Instruct it to run checks in the
   foreground and let them finish (the suite is ~100 s), and to treat a command
   silent for more than a few minutes as hung.
3. **Backstop with `--print-timeout 4h`.** Blunt, but it needs no maintenance and
   works even when everything else is wrong.

### Diagnosing a suspected stall

stdout tells you nothing (buffered until exit), so use progress plus CPU. A long
healthy command burns CPU; a blocked one does not:

```bash
git -C <repo> log --oneline -3                      # did it commit anything?
find src test docs -newermt "-20 minutes" -type f    # is it still writing files?
```

```powershell
Get-Process | ? { $_.ProcessName -match 'agy|node' } |
  Select ProcessName, Id, @{n='CPU_s';e={[math]::Round($_.CPU,1)}},
         @{n='AgeMin';e={[math]::Round(((Get-Date)-$_.StartTime).TotalMinutes,1)}}
# then, for a suspect pid, see what it actually is:
Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | % { $_.CommandLine }
```

An old process with near-zero CPU and no recent file writes is stalled. Kill the
children first, then `agy`, then resume the conversation (below) with a note
saying what went wrong — the committed work stands and the model keeps its
context.

A psutil watchdog (no stream-json events **and** no tree CPU for N minutes ⇒ kill
and print the offending process tree) was prototyped and verified to catch this in
~1 min without killing a CPU-busy child. The owner deferred it in favour of
layers 1 and 3, to be reconsidered only if stalls recur — so don't rebuild it
without asking.

## Resuming

Every run prints a `conversation_id` (in the `json` envelope and the `init`
event). Continue with:

```powershell
& $AGY -p="<follow-up>" --model gemini-3.8-flash-high --dangerously-skip-permissions --conversation <id>
& $AGY -p="<follow-up>" --model gemini-3.8-flash-high --dangerously-skip-permissions --continue   # most recent
```

Verified: the second call remembered a word from the first (`num_turns` climbs).
Each resume is a new process. Re-pass model and permission flags every time. On
a quota abort resume the same way; conversations are stored under
`~/.gemini/antigravity-cli/conversations/`. Same advice as codex.md: keep the
follow-up prompt self-describing, since this repo's commit-per-task workflow
makes the tree self-describing anyway.

## Subagents

By default agy has a native delegation tool (`invoke_subagent`, plus
`define_subagent`, `manage_subagents`, and a `browser_subagent`), and it uses them
when asked: told to delegate `3+3`, it spawned one and relayed the answer, with no
permission prompt. Subagents inherit the parent's permission scope and can nest up
to 10 levels (docs).

There is no `-c agents.enabled=false` equivalent. What **is** verified to work is a
**custom agent whose `tools` list omits `invoke_subagent`**: define
`.agents/agents/solo.md` in the workspace and run with `--agent solo`.

```markdown
---
name: solo
description: Single-threaded worker that does all work itself and never delegates.
mainAgent: true
tools:
  - view_file
  - write_to_file
  - replace_file_content
  - multi_replace_file_content
  - run_command
  - grep_search
  - find_by_name
  - list_dir
  - finish
---

You are a single-threaded coding agent. Do all work yourself.
```

Asked to spawn a subagent, `--agent solo` answered "no such tool" and did the
task itself. Gotchas found while verifying:

- Tool names must be valid for custom agents. `command_status` and
  `send_command_input` appear in the `init` tool list but are *not* accepted in
  `tools` (`failed to construct executor ... not found in registry`, status
  ERROR). Don't add them; `run_command` covers them.
- The `init` event still prints the full default tool list under `--agent solo`.
  Judge by behaviour, not by that list.
- `permissions.deny: ["invoke_subagent"]` is what the docs suggest, but it lives in
  settings.json, which is the unverified path above.

Project agent files in `.agents/agents/` would be committed with the repo; only
create one if you want it shared. Global scope is `~/.gemini/config/agents/`.

## Checking remaining quota

**Use [agy_usage.py](agy_usage.py)** (verified). agy has no headless quota command,
so the script drives the interactive TUI through a Windows pseudo-terminal, types
`/usage`, and prints JSON. It spends no model tokens and takes about 15 seconds:

```powershell
pip install pywinpty          # once
python agents/agy_usage.py
```

Output, from a real run (Gemini Flash and Pro share one group; each group has a
weekly and a 5-hour window):

```json
{"account": "<your-google-account>", "groups": {
  "Gemini Models": {"weekly": {"remaining_percent": 99.06, "refresh": "Refreshes in 166h 24m"},
                    "five_hour": {"remaining_percent": 97.74, "refresh": "Refreshes in 3h 24m"}},
  "Claude And Gpt Models": {"weekly": {"remaining_percent": 100.0, "refresh": "Quota available"},
                            "five_hour": {"remaining_percent": 100.0, "refresh": "Quota available"}}}}
```

Notes on the script and on what did not work:

- It exits 3 instead of answering if agy shows the trust / theme / terms prompt.
- It reads the pty on a background thread. A plain blocking read loop made agy exit
  with status 143 before `/usage` could be typed.
- Run it from Claude Code's shell or your own; it finds `agy` on PATH, else in
  `%LOCALAPPDATA%\agy\bin`. It parses screen text, so a UI change in a later agy
  build can break the parser; the raw panel is the source of truth.
- `agy -p="/usage"` (also `/quota`, `/model`, `--print /usage`): on 1.2.11 the CLI
  does **not** intercept the slash command in print mode; the text goes to the model,
  which tries to run a shell command (denied). The docs claim print mode answers it,
  and `stream-json` input errors with "run it as its own `--print /usage`
  invocation", so this may change in a later build. Retest after `agy update`.
- The CLI's own log (`~/.gemini/antigravity-cli/log/`) shows it fetches quota from
  `https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`
  (also `loadCodeAssist`, `fetchAvailableModels`); in `-p` runs that refresh is
  cancelled at exit, so nothing lands on disk. The status line also shows `AI Credits`.

Other ways people check it (all third-party, **not run here**): `agy-cli-usage`
(`npm i -g agy-cli-usage`; `--json`, needs Node >= 22.13; calls the same private
endpoint, falls back to driving `/usage` in a pty), `agy-quota`, `agyp usage`,
`antigravity-usage`. The API-based ones read the OAuth token from **Windows
Credential Manager** (generic credential `gemini:antigravity`) and refresh it via
`oauth2.googleapis.com/token`. That endpoint is undocumented and may change, and
reading your Google OAuth token is a step to take deliberately, not from an agent by
default.

When you run out, expect the CLI to stop with an "Individual quota reached ...
Resets in ..." message (reported online; exit code `3` per the changelog, both
**unverified**). Because a quota abort can look like an ordinary failure, look at
`status`, `error` and exit code, not just stdout.

## Example handoff for this repo

```powershell
$AGY = "$env:LOCALAPPDATA\agy\bin\agy.exe"
Set-Location E:\code\vibe-games\vibe-fortress-fable-5.1
$env:npm_config_yes = "1"      # an npx fetch must never block on a prompt
# task text lives in a file; the prompt just points at it
& $AGY -p="Read agents\tasks\next.md and follow it exactly. Run npm run typecheck and npm test before finishing and report any failures." `
  --model gemini-3.8-flash-high `
  --dangerously-skip-permissions --print-timeout 4h `
  --output-format json > last_run.json
$r = Get-Content last_run.json -Raw | ConvertFrom-Json
$r.status; $r.response; $r.denied_actions     # denied_actions must be empty
```

Reading the envelope from Python needs **`encoding='utf-8-sig'`**: agy writes a
UTF-8 BOM, so a plain `json.load` fails with `Unexpected UTF-8 BOM`.
PowerShell's `ConvertFrom-Json` tolerates it.

`status` is `SUCCESS` and `num_turns` is `1` even for a run that did hours of
work across dozens of internal steps, so neither is a progress or health signal.
`usage` is the useful one; one M-sized task here cost ~1.9M input tokens and
~35M cache-read tokens.

**Batching works well.** Assigning several fixes to one run avoids re-reading the
repo context each time. Keep the brief invariant in one file and put the
per-run list in a small `TASK.txt` beside it, with: do them in this order, **one
commit per task**, each fully green before the next starts, and if you run out of
budget the committed ones stand — say where you stopped. Verified on a
three-fix batch (all three committed cleanly) and a four-fix batch.

**Quota cost, measured:** roughly 4% of the Gemini weekly budget per M-sized
task, and a batch of three spent about 70% of one 5-hour window. Check with
[agy_usage.py](agy_usage.py) before dispatching a batch; the 5-hour window is
usually the binding one.

Drop `--agent solo` if you want agy to be free to parallelise with subagents.
A milestone-sized run is long; give it a generous `--print-timeout`.

Notes for scoping a handoff in this repo:

- Same as codex.md: TypeScript/Vite ("deepholm"), tests via `vitest`/`playwright`,
  scripts in `scripts/*.mjs`. Name the npm scripts that count as "done"
  (`typecheck`, `test`, `lint`, `gate`).
- With no OS sandbox and `--dangerously-skip-permissions`, `git status` first, give
  an explicit file/directory scope, and commit or stash your own uncommitted work
  that overlaps.
- agy also has a desktop app and a bundled `agentapi` helper under
  `%LOCALAPPDATA%\Programs\antigravity`. That is a different interface; this doc
  is only about the `agy` CLI.
