# T-310 — A scrollbar thumb can be dragged

**Source:** T-270 (the decision "a scrollbar track is clickable and its thumb can be dragged"; the track click is done) · **Size:** S · **Needs:** — · **Status:** open

## Why

A click on a list's scrollbar track jumps the list there. Dragging the thumb is not possible, because the click regions of the surface carry no pointer position and the fortress screen does not follow a held button over a sidebar list.

## What to do

**Decisions.**
- A press on the thumb or track starts a drag of that list. While the button is held, a pointer move over the sidebar sets the list's scroll from the pointer's row, as the track click does. Releasing the button ends it. The map is not touched.
- The scrolling rule is the one of `src/ui/widgets/list.ts`: scroll is proportional to the pointer row within the track, and the selection stays inside the window.

1. Amend `ui-keymap-and-screens.md` § Mouse (the scrollbar sentence) to say the thumb is dragged.
2. Implement in `src/ui/widgets/list.ts` (a hit that reports the list it belongs to) and `src/ui/screens/fortress.ts` (pointer move and release).
3. Tests, `describe('T-310 …')`: press on a thumb, move down, the list's scroll follows; release ends it.

## Done

- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.

## Decisions made in the work

- The track of a list registers itself on the surface (`Surface.scrollbar`); a press in the sidebar that lands on a track starts the drag, and every pointer move until the release sets the scroll from the pointer's row, clamped to the track, wherever the pointer is. The lists of the Orders and workshop panels scroll with their cursor, so a drag there moves the cursor to the row at that place.
