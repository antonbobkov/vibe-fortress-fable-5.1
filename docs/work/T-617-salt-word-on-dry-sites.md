# T-617 — A desert site's salt is not called sea salt

**Source:** T-613 (the world map's words) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-613 names the `salt` good "sea salt" in the site lists, so a forest that has rock salt and lacks salt no longer seems to contradict itself. But desert and badlands sites *have* `salt`, and their salt is the salt crust shrub's (07 § Conversions), so their panel now reads "This site has: sand, sea salt, cactus fiber, …" in the middle of a desert.

## Decisions

- The `salt` good keeps one name in both lists. Choose a word that fits a salt crust as well as a coast and stays apart from rock salt: "salt" with rock salt named "rock salt (halite)", or "loose salt", or "salt crust" on a site whose `salt` comes from its crusts. Take the shortest one that reads true on a desert, a forest and a sedimentary hill.

## Spec sections

`02-systems/02-embark-and-loadout.md` § What a site has and lacks, `04-implementation/ui-screens/menus-and-world.md` § World map, `03-content/regions-biomes-and-traits.md` § Signatures (the note under the table).

## Done

A unit test reads a desert's and a temperate forest's has and lacks lines: neither says "sea salt" on a desert, and rock salt and the lacked salt still read as two different goods. `t550-making-do-sundries` and `t613-world-map-readability` pass, updated.
