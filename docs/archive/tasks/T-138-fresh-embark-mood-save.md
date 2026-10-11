# T-138 - A fresh embark save loses mood reactions on its next tick

Closed by `T-138: fresh saves retain the pending morale bootstrap`.

**Source:** T-133's save-continuation control, 2026-10-11 | **Size:** S | **Needs:** none | **Status:** open

## Reproduction and measurement

At the master state merged before T-133, create `HeadlessGame` with seed
`t133-save`, `world: 'flat-test'`, `embark: 'default'`, submit no commands,
and immediately `roundTrip` it. The immediate world hashes agree. Step both
games once from tick 400 to 401: the original hashes `363844f6310795ae`, its
load `a289a0263eb2114b`.

Only system 15 and the seven dwarves' Mood components differ in the inspected
system/entity state. The original gains thought index 76 at tick 400; the
loaded dwarves keep empty thought lists and mood 55. Original hall spirit is
53.98571428571428; loaded hall spirit is 55. No command-log normalization runs
in this control, because its command queue is empty.

## Proposed resolution and done

Trace the pending embark reaction or transient state that saving omits and
preserve that boundary, following the save continuation rule. Add this exact
control as a failing permanent regression, then compare every one of at least
50 subsequent world hashes, including a control saved after the first bootstrap
tick. Do not flush reactions or advance a tick while saving. Edit the save-format
and owning system's saved-state specification for the actual omitted state.
Run all six checks, npm test and the whole e2e suite, recording the browser-year
end state before and after. Name any golden change and its cause.

## Progress (2026-10-11)

Renumbered from T-136 to T-138 because master independently assigned T-136 to the many-seed wildlife instrument. The save reproduction and proposed resolution are unchanged.
