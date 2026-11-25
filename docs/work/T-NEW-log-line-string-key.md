# T-NEW — A log line keeps the string key it was written from

**Source:** T-720 ([work file](T-720-legend-scroll-and-last-words.md)) · **Size:** S · **Needs:** T-714 (it changes the announcement code) · **Status:** open

## Why

The legend's last words fold the log's alert and danger lines by kind: one string key, and one creature for a line about one (24 § The legend record). A `LogLine` holds only its text, so T-720 reads the key back by matching the text against every `announce.*` template, the most literal first, and skips fragments and templates with under four letters of their own. That works for the lines seen in play, but it is a guess: two templates with the same words ("{name} has died." and "{dwarf} has died.") read back as one, and a line written from a template that changes later reads back as plain text.

## What to do

Decisions:

- **`LogLine` gains `key?: string`**, the string key the line was filled from, set where the announcer appends it (also the starving, frost, engagement and other merged lines). Presentation state, saved with the line as `subject` is; an older save's lines have none.
- **The legend folds by `key` when a line has one**, and falls back to reading the text back only for lines without it. The `SUBJECT_FIELDS` reading stays for the one-creature rule, from the line's `subject` when the key's template names one creature.

Spec: 24 § Announcements and the log (the line's fields), § The legend record.

## Done

- [ ] Tests (`describe` with the task id): a line's key survives a save and load; two lines from different templates with the same words do not fold together.
- [ ] UI only: world hashes unchanged.
