# T-217 — A workshop's announcement does not centre the map on the workshop

**Source:** T-199 (found while adding the `no_empty_container` announcement) · **Size:** S · **Needs:** — · **Status:** open

## Why

`24` § Announcements and the log says that clicking an announcement centres the map on its focus. The focus of an event is its `tile`, the first of its `tiles`, or the position of an entity named by `defenderId`, `attackerId`, `victimId`, `id` or `creatureId` (`focusOf`, `src/ui/announcements.ts`). `WorkshopBlocked` names the workshop in `workshopId`, which `focusOf` does not read, so its alert (`no_magma`, and `no_empty_container`) has no focus: the line cannot take the player to the workshop that needs a barrel or magma power.

## Reproduction

Seed `flat-test`: build a still, add a brew order with no empty barrel, announce the `WorkshopBlocked` event through an `AnnouncementLog`. `announce` returns `focus: undefined`.

## What the spec says

- [`24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Rules: "Clicking a location reference (a job target, an announcement) centers the map."
- [`12-workshops-and-professions.md`](../02-systems/12-workshops-and-professions.md) § Registrations: the `WorkshopBlocked` alerts.

## What to do

**Decision.** An event that names a building in `workshopId` has the building's first footprint tile as its focus.

1. Amend 24 § Announcements and the log to list `workshopId` among the entities that give an event its focus.
2. Add `workshopId` to `focusOf` through the buildings reader, with a unit test that announces a `WorkshopBlocked` event and checks the focus.

## Done

- A `WorkshopBlocked` announcement carries the workshop's tile as its focus; the unit test passes.
