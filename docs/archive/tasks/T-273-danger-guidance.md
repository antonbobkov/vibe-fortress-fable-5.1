# T-273 — Danger guidance: the game says that wild beasts kill, and what stops them, before it matters

Closed by `T-273: the game says that wild beasts kill, and what stops them` (the commit that moved this file, after 47ea3e4). Decisions made while doing it: "dangerous" is a surface species (it has biomes) that is not timid and is a carnivore, aggressive or territorial (so a lynx counts, a fox and the cavern species do not); the first-squad advice follows the T-145 finding (iron spears and a kill order hold off boars, clubs do not), so the strings say spears, not clubs.

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (issue 3, § 8 b); the question came from T-220 and the wildlife work · **Size:** M · **Needs:** T-244 (`src/ui/screens/embark.ts`), T-248 (`src/ui/panels/military.ts`) · **Status:** open; the owner should see one point, the pause on the first predator. Recommendation: pause once per fortress

## Why

Measured elsewhere: a fortress that arms a squad with clubs, digs a hearth shelter and puts a door set to lock on alert on it in the first two weeks loses almost nobody to wildlife (median 13 of about 13 alive, worst seed 11, over twelve maps). An unprepared one can be wiped out. The game tells a new player none of this. A bear arrives with the same plain line as a deer, the Threats panel says "Active: none" with the bear on the map, and the only hint about the alert and locked doors fires on a raid warning.

## Reproduction

The capture's flow 7 (seed `e2e-year`, default embark, an economy and no defence, 70 days). The log shows "A lynx has arrived." (day 8), "A boar has arrived. x2" (day 27), "A bear has arrived." (day 63) as plain notes; no hint mentions danger; at day 71 Military reads "No squads yet: [+] makes one." and Threats reads "Active: none". Code: `src/systems/animals/index.ts:213` (one note for every species), `src/ui/hints.ts:112` (`hint_alert` on `ThreatWarning`), `src/systems/threats/index.ts:362` (only the raid scheduler emits it).

## What the spec says

- [`08-animals-and-domestication.md`](../../02-systems/08-animals-and-domestication.md): which animals attack dwarves, and the `AnimalSpawned` event.
- [`ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md) § Hints and § Announcement strings: the two tables this task adds rows to.
- [`panels.md`](../../04-implementation/ui-screens/panels.md) § Threats and § Military; [`embark.md`](../../04-implementation/ui-screens/embark.md); [`menus-and-world.md`](../../04-implementation/ui-screens/menus-and-world.md) § World map.

## What to do

**Decisions.**
- **Which animals.** "Dangerous" means a species whose content row makes it attack dwarves unprovoked (the tag 08 already uses for predators). No species id appears in code.
- **Arrival.** `AnimalSpawned` for a dangerous species is announced as an alert, not a note: "A bear has come to the valley." (one line per group, with the count when more than one: "3 wolves have come to the valley."). It is listed under Alerts in the Log and can centre the map like other alerts. Other species keep "A deer has arrived."
- **Pause.** The first such alert in a fortress pauses the game, as a first raid does, and never again for wildlife. The save keeps the flag with the hint flags.
- **Hints** (rows in the hints table; texts are final):
  - `hint_shelter`, day 3 of the first spring if no squad exists: "Wild beasts will come. Dig a hall into rock, put a door on it, click the door and choose Lock on alert. Make a squad in [m] and order clubs at a carpenter's workshop."
  - `hint_predator`, the first dangerous arrival: "A beast that hunts dwarves is near. [m] then [3] raises the Hearth alert: civilians go to the hearth and doors set to Lock on alert shut. [n] › Wild shows where it is."
  - `hint_alert` keeps its text and also fires on the first dwarf wounded by an animal.
  - `hint_food`, when food in stock falls below two days for the population and no hint about food has been shown: "Food is running low. Check the farm plots' crops [z], order meals at a kitchen, and gather plants [d]." (Flow 7 starved from day 54 with no warning.)
- **Embark.** The hint line alternates, every five seconds of real time or on each tab change, between the existing line and "Hint: wolves and bears come in the first season. Bring an axe; a carpenter makes clubs from logs."
- **World map.** Under the Peril bar of the region panel: "Peril counts raiders. Wild beasts live everywhere."
- **Threats panel.** A "Wildlife" section above Caverns: one row per dangerous species on the map with its count and "near the hall" (within the distance 08 uses for a threat nearby) or "far". With a row there, "Active: none" reads "Active: wildlife".
- **Military panel.** Under "No squads yet: [+] makes one.": "A squad of four with clubs holds off wolves." Under the alert row, one line for the current alert: "Calm: everyone works." / "Watch: squads stand to; civilians work." / "Hearth: civilians go to the hearth; doors set to Lock on alert are shut."
- Before writing the numbers into strings ("first season", "four with clubs"), check them against [`../balance-status.md`](../../balance-status.md); if the measured rule differs, the strings follow the measurement.

1. Amend 08 § Player-facing behavior (the alert and the pause), `ui-keymap-and-screens.md` § Hints and § Announcement strings, `panels.md` § Threats and § Military, `embark.md`, and `menus-and-world.md` § World map.
2. Implement in `src/systems/animals/` (the announcement registration by tag), the hints table and `npm run content:export`, `src/ui/hints.ts`, `src/ui/panels/threats.ts`, `src/ui/panels/military.ts`, `src/ui/screens/embark.ts`, `src/ui/screens/world_map.ts`, and the strings.
3. Tests, `describe('T-273 …')`: a dangerous arrival is an alert and a deer is a note; the single pause; each hint's trigger; the Threats row; the Military lines. Scenario goldens that record announcements will move; say which in a `golden:` paragraph.

## Done

- Flow 7 replayed shows `hint_shelter` on day 3, an alert and `hint_predator` at the lynx on day 8, and a Wildlife row while it is on the map.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.

## Owner point settled (2026-10-12, local orchestrator, under the owner's standing instruction to use judgement; the owner was told and may overrule)

**The first predator sighting pauses the game once per fortress**, as recommended. One pause at the moment the knowledge matters costs a second; a fortress lost to an animal the game never mentioned costs the player the game. Later sightings do not pause.
