# T-NEW — A full stockpile leaves the brew at the still, and no one drinks it

**Source:** T-458, T-457 (`pp_drink`) · **Size:** S · **Needs:** — · **Status:** open

## Why

`pp_drink` failed twice on a change that only moved its timeline. Its 18 usable tiles of `everything` stockpile had filled with the wagon's goods and the logs, so two barrels of ale had no slot and stood beside the still for 30,000 ticks. Drink search looks for alcohol in a barrel on a stockpile, then a well, then water, and takes loose alcohol only when none of those exist: ten dwarves drank water 125 times and alcohol none. The scenario now has a stockpile with room, but a player with a full pile gets the same fortress, and nothing tells them why the still's brew goes undrunk beyond the stockpile-full note.

## Decisions

1. **Drink where it stands.** Add a barrel of alcohol standing off a stockpile to 10's drink search, after barrels on stockpiles and before wells and water. Food is already taken from wherever it lies.
2. No priority for drink in hauling.

## Done

- **Scenario:** `pp_drink`'s old stockpile (6 × 4) passes.
- The six static checks, `npm test`, e2e, and the instrument by the T-308 rule pass.
