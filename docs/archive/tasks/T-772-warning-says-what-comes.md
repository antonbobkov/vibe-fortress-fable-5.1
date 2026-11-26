# T-772 — The raid warning says only "Gloam scouts", and the Threats panel never says what a party is made of

**Closed:** 2026-11-25, in ce22e3ac.

**Source:** playtest 2026-11-25 (military) ([report](../../../reports/data/2026-11-25-playtest-6.md), finding 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

The warning a day ahead is the moment a player decides between locking in and meeting the party, and it is the line that pauses the game. At peril 3 on `playtest-1125-p3m` it read the same for three very different threats:

- Raid of 10, Autumn 20, Year 1: "! Gloam scouts have been seen at the northern edge. They will come tomorrow."
- **Siege of 23 Gloam plus trollkin (30 on the map), Spring 5, Year 3**: "! Gloam scouts have been seen at the northern edge. They will come tomorrow." (`15-siege-alerts.png`)
- Raid of 15 with a captain and a hexer (17), Spring 21, Year 3: the same line.

`ThreatWarning` carries `kind` and `sizeBand` (18 § Raids), and 18 says the UI words the band ("a horde of Gloam"), but `announce.threat_warning` uses only `{edge}`. The Threats panel's Coming line words a raid's band ("Coming: a band of Gloam from the north, tomorrow.") but a siege's not ("Coming: a Gloam siege from the north, tomorrow.", `11-siege-warning.png`). Once the party is on the map the panel says "Active: Gloam siege, 30, looting" (`12-siege-arrived.png`): 30 of what? Whether trollkin are among them decides whether a door holds ("Trollkin break doors; walls and bridges hold", 19's hint), and whether archers are decides whether fortifications matter. The only way to learn it was to read the map's `T` glyphs among the `G`s.

## What to do

Decisions:

- **The warning names the kind and the band**, from the event: "! A band of Gloam raiders has been seen at the northern edge. They will come tomorrow." (raid), "! A Gloam siege, a horde, has been seen at the northern edge, with trollkin. They will come tomorrow." (siege; "with trollkin" because every siege brings them, 03-content threat schedules). The few/band/horde words are 18's. Fog's shorter lead keeps its "today" wording as now.
- **The Threats panel's Coming line for a siege gives the band**: "Coming: a Gloam siege, a horde, from the north, tomorrow."
- **A party in view has a composition row** under its Active line and before Morale, by species and role in the order of 18's roles, counted: "  6 warriors, 3 archers, 2 trollkin, a captain, a hexer" (the members on the map and seen, as the Active line counts them). Wrapped with a two-cell indent.
- The size stays a band before arrival (18: the exact count is not shown until they are seen).

Spec: 18 § Registrations (the `ThreatWarning` announcement), 24 § Announcements, `ui-screens/panels.md` § Threats (Coming and Active), `03-content/ui-keymap-and-screens.md` (strings).

Decided while doing it:

- **"Today" under fog.** The warning's line said "They will come tomorrow." whatever the lead, so under fog (half a day's lead) it said tomorrow for a party that came the same day. It now takes `{when}` from the party 18 lists as coming (`threats.coming()`, matched by kind, civ and edge), worded as the Coming line words it: "tomorrow", or "today" when fog shortened the lead; "tomorrow" when no such party is listed. The event is unchanged.
- **Verb agreement.** A few raiders "have been seen"; a band or a horde "has been seen". Each band has its own string (`announce.threat_warning.few`, `.band`, `.horde`), and a siege `announce.threat_warning.siege` with `{band}` ("a few", "a band", "a horde", `ui.threats.size.*`). The old `announce.threat_warning` stays as the line of a kind with no string of its own.
- **The composition row's order.** "In the order of 18's roles" and the example ("6 warriors, 3 archers, 2 trollkin, a captain, a hexer") disagree: 18 lists trollkin last, and trollkin carry the `warriors` role. The row follows the example by a rule that needs no content id in code: the kinds with the most members first, kinds of as many in the creature table's order (captain before hexer). It groups by species, and names each species without the party's civilization ("gloam warrior" is "warrior" under a Gloam party; trollkin stay "trollkin"). It counts the members the Active line counts: on the map and shown.
- **Colour and place.** The row is in the danger colour like its Active line, under the Active line and above the morale line, wrapped with `wrapHang` at a two-cell indent.
- **Strings.** The new announcement lines and the band nouns are rows of the Announcement strings table (`strings.json`); the row's `ui.threats.makeup` ("  {list}") is a UI default, like `ui.threats.morale`.

## Done

- [x] Tests (`describe` with the task id): a raid warning of band size and a siege warning of horde size read as above; the siege Coming line has the band; a party of 6 warriors, 3 archers, 2 trollkin and a captain in view shows the composition row, and a stealthed unseen member is not counted.
- [x] UI only: no world hash moves.
