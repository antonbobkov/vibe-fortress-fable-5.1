# T-731 — The miserable line keeps its string key

**Closed:** 2026-11-25, in fa8f907a,82f9b1ff,4fced7eb,6b655369.

**Source:** T-725 ([work file](T-725-log-line-string-key.md)) · **Size:** S · **Needs:** T-714 · **Status:** open

## Why

T-725 gave every log line the announcer writes its string key (`LogLine.key`), which the legend's last words fold by. T-714 (branch `t714-mood-lines`, not on master when T-725 was done) adds `announceMiserable`, a line that grows over a day as the starving line does ("Asa Forgehall is miserable: …", then "3 dwarves are miserable: …"). It appends through `append(severity, text, tick, focus, category)` with no key and rewrites `open.line.text` without one, so its lines fold by their text only (the T-720 fallback): they still fold, but by a guess.

## What to do

After T-714 is on master (whichever of the two merges second can do it in its merge instead):

- `miserableText` returns a `Said` (`{ key, text }`): `spec.stringKey` or `announce.mood_tier_why` for one dwarf, `announce.mood_tier_many` or `announce.mood_tier_many_why` for more, as `starvingText` does.
- `announceMiserable` passes `said.key` to `append`, and sets `open.line.key` with `open.line.text` when the line grows.

Spec: none beyond 24 § Announcements and the log (every line the announcer writes has its key).

## Done

- [x] Test (`describe` with the task id): a miserable line's key is `announce.mood_tier_why` for one dwarf and `announce.mood_tier_many_why` once a second dwarf joins it.
- [x] UI only: world hashes unchanged.
