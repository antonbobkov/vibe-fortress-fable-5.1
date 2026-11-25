# T-725 — A log line keeps the string key it was written from

**Source:** T-720 ([work file](../archive/tasks/T-720-legend-scroll-and-last-words.md)) · **Size:** S · **Needs:** T-714 (it changes the announcement code) · **Status:** open

## Why

The legend's last words fold the log's alert and danger lines by kind: one string key, and one creature for a line about one (24 § The legend record). A `LogLine` holds only its text, so T-720 reads the key back by matching the text against every `announce.*` template, the most literal first, and skips fragments and templates with under four letters of their own. That works for the lines seen in play, but it is a guess: two templates with the same words ("{name} has died." and "{dwarf} has died.") read back as one, and a line written from a template that changes later reads back as plain text.

## What to do

Decisions:

- **`LogLine` gains `key?: string`**, the string key the line was filled from, set where the announcer appends it (also the starving, frost, engagement and other merged lines). Presentation state, saved with the line as `subject` is; an older save's lines have none.
- **The legend folds by `key` when a line has one**, and falls back to reading the text back only for lines without it. The `SUBJECT_FIELDS` reading stays for the one-creature rule, from the line's `subject` when the key's template names one creature.

Spec: 24 § Announcements and the log (the line's fields), § The legend record.

Decisions taken while doing it:

- **The key is passed to `append`** (a sixth, optional argument), so every line written through the registry's generic path carries its key with no further code: a new `register.announcement` row (T-723's `NoDressing` of an animal) gets one for free. The writers with their own words return a `Said` (`{ key, text }`): the engagement, the starving line, the theft line and `raidEndedText`; a line that grows (starving one → many, engagement one → many, a theft, a frost count, the dangerous-arrivals count in the fortress screen) sets the key of its new words. A line merged by the dedup rule keeps its first key, and takes the new one only if it had none.
- **Only the announcer's lines have a key.** A line the UI writes itself (a refused command's `ui.status.rejected`, a save's note, a hint, the depot and designation notes) has none and folds by its text, as before: folding every refused command under one key would hide which command was refused.
- **The params are not stored.** The key alone is enough to fold, and the params would grow every saved line; the creature of a one-creature template is read from the text by that key's own template (case-insensitive, as the log capitalizes the first letter), which is exact once the key is known.
- **The creature is read from the text first, the subject second.** The work file said the subject; but a line's subject is the first creature *or item* its event names (an artifact's line names its item), so two lines about one dwarf could carry different subjects. The subject is used only when the text does not read as the key's template; a line with neither folds by its own text.
- **No hash moves**: the key lives in the `ui` section only, which the world hash does not read. A save written now carries `key` on its log lines, so its bytes differ from before; no golden holds a save's bytes. No sweep.

## Done

- [x] Tests (`describe` with the task id, `test/unit/ui/t725-log-keys.test.ts`): a line's key, written by the announcer and changed when the line grows, survives a save and load; a dwarf and a cow both named Modi starving on two days make two last-words lines by key, where the text alone folds them into one; keyed lines and the same lines from an older save (keys stripped) fold alike, per creature, deaths never folded.
- [x] UI only: world hashes unchanged (`test/golden/world-hashes.test.ts` passes, no golden moved).
- [x] Spec: 24 § Announcements and the log (the line's key), § The legend record (folding by it, the text as the fallback), § State; `save-format.md` (`ui` row); `schemas/system-state.md` (`UiState.logTail[].key`).
- [x] Follow-up for T-714 (not merged when this was done): [T-NEW-miserable-line-key](T-NEW-miserable-line-key.md).
