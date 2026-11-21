# Keymap: plain letters first (T-674 proposal)

21 November 2026 · proposal only, nothing implemented.

The owner: "d-Shift+d to dig is too complex of a shortcut for such a common action of digging. d-d is much better. Generally rework such commands for common actions. Also why are there so many Shift actions? Work through regular letters first."

## The short version

- **Why there are so many Shift keys.** Decision D-U2 (U-03): the 17 panel letters (`d b z u l j o s m n t c p e a k f`) open their panel from anywhere, *including from inside another panel*. So no panel may use one of those letters bare, and every panel action on one of them was pushed to Shift. That is 82 of today's 86 Shift chords. Dig is `[S-d]` only because `d` is the Designate letter.
- **The change: the open panel's letters come first.** While a panel is open, a letter that panel binds does the panel's action; a letter it does not bind still opens its panel, as today. Shift stops being the price of a collision and is left for dangerous and rare actions.
- **Same letters, Shift dropped.** No action changes letter. `[S-d]` dig becomes `d`, so `d d` digs; `[S-s]` stockpile becomes `s`, so `z s` makes one; `[S-n]` new order becomes `n`, so `o n` adds one. A veteran's old chord keeps working, because a plain binding already takes a shifted press (§ Keymap notation).
- **Shift kept for 8 letter chords** (from 82): ignite, dump (twice), melt, slaughter, suspend, kill, compost heap, plus `Shift+F1`, `Shift+Tab` and `Shift+↑↓` which are not collisions.
- **The cost.** From inside a panel, a panel letter that panel uses needs `Esc` first: in Zones, `b` arms Bedroom instead of opening Build. The panels most players switch *from* keep the common targets free: from Designate `b` `z` `k` still switch directly. `k` (Look) and `?` stay free in every panel.

## 1. Today's keymap

Source: `src/content/keymap.json` (the default table, 290 rows) built into bindings by `src/ui/keymap.ts`; the panel letters are `FORTRESS_PANEL_KEYS` there, and `acceleratorOf()` is the D-U2 rule ("a letter that is a panel hotkey counts only with Shift"). The labor manager is the one place that already works plain-letters-first: `a` `c` `t` are its actions and Shift plus a letter jumps to a labor.

Marks in the full table (§ 6): **⇧** a Shift chord; **seq** a two-key sequence from the map (panel letter, then the key). Every panel action is a sequence; dig today is `d`, `⇧d`.

Counts today: 86 Shift bindings (72 `[S-x]` accelerators, 14 `Shift+…` rows), 82 of them Shift+letter. Every one of the 72 `[S-x]` exists only because its letter is a panel letter.

## 2. How often a player does what

Ranked by presses per hour of play, from the tutorial, the hints, the played-fortress fixtures and what the panels are for. Frequency decides how much a key may cost.

| Rank | Action | How often | Today | Why it ranks here |
|---|---|---|---|---|
| 1 | Pause, speed | constantly | `Space` `+` `-` | Every decision starts with a pause. Already plain. |
| 2 | Move the view, change level | constantly | arrows, `<` `>`, wheel | Already plain. |
| 3 | Look / inspect | constantly | `k`, click; inside Look `1`–`3` | The main way to read the game; T-669..T-671 add `1`–`9`, Enter, centre, follow, here, back. |
| 4 | Dig | dozens per session, every session | `d` `⇧d` | The core verb of the genre; every room, corridor and mine starts with it. |
| 5 | Other designations: stairs, channel, ramp, chop, gather, smooth | many per session, heavy in year 1 | `w` `r` `g` plain; `⇧c` `⇧t` `⇧s` `⇧e` | Each new level needs stairs, the first winter needs wood. |
| 6 | Build: furniture, workshops | many in years 1–2 | `b` then `⇧f` / `w` | Beds, tables, doors, then the workshops. |
| 7 | Zones: stockpile, farm, bedroom, dining | several per fortress, bursts | `z` then `⇧s` `⇧f` `⇧b` `⇧d` | Every stockpile and room. The zone inspector (preset, cellar, crops) follows each one. |
| 8 | Work orders | regular from the first season | `o` `⇧n`, count `+` `-`, `r` repeat | The economy runs on them. |
| 9 | Military in a raid | rare but urgent | `m`, `1`–`3`, `⇧s` `⇧t` `⇧k` `⇧f` | Few presses, under time pressure: they must not need thought. |
| 10 | Units, labors, jobs | occasional | `u` `l` `j`, `⇧c` `⇧l` `⇧s` `⇧p` | Checking who does what. |
| 11 | Stocks: forbid, dump, melt, to depot | occasional | `s` `⇧f` `⇧d` `⇧m` `⇧t` | Dump and melt destroy; forbid is common and harmless. |
| 12 | Animals, trade, requests, mood, population, calendar | rare | mostly `⇧` | A few times a year. |
| 13 | Save, load, help, debug, tutorial | rare | `F5` `F9` `Ctrl+S` `?` `F12` `F1` | Not letters; unchanged. |

Ranks 4 to 8 are where the Shift chords sit and where the presses are. That is the target.

## 3. The proposed keymap

### The rule that replaces D-U2

1. **A text field** takes letters, as today.
2. **The open panel's own context** (its panel state first: the zone inspector, a chooser; then the panel; then a map selection) takes a letter it binds, plain or with Shift as bound.
3. **Otherwise a panel letter** opens its panel. The open panel's own letter closes it unless the panel binds that letter (only Designate does: `d` is dig).
4. **Otherwise** the map and global keys, as today.
5. `Esc` always backs out one step, so `Esc` then a letter always reaches any panel. The sidebar's panel strip and the mouse are unchanged.
6. **Guarantees:** no panel binds plain `k` (Look is one key from anywhere) or `?`; no panel binds a digit, `Space`, `+` or `-` other than those it binds today.
7. **Shift is for** (a) actions that destroy or are hard to undo (ignite, dump, melt, slaughter, suspend, kill), (b) a second variant of a key (`Shift+↑↓` moves an order, `Shift+F1` ends the tutorial where `F1` skips a step, `Shift` held for ten), and (c) a letter a panel needs but cannot give up (compost heap, so `k` stays Look). `x` stays the plain, confirmed "remove / cancel / take apart" key everywhere, as today.

Rebinding works as today: the rows are the same rows with a new default key, saved rebindings are keyed by action name (`designate_panel/dig`) and survive, and the parity scenario keeps checking every row.

### What changes, panel by panel

Only the rows that change; § 6 has every row.

| Where | Today | Proposed | From the map |
|---|---|---|---|
| Global | `Shift+Y` calendar | `y`, a panel letter (inside Building, Military and the zone inspector their own `y` wins) | `y` |
| Map selection | `⇧f` forbid, `⇧t` to depot | `f`, `t` (`⇧d` dump stays) | drag, `f` |
| Designate | `⇧d` dig, `⇧c` channel, `⇧s` smooth, `⇧e` engrave, `⇧t` chop, `⇧f` traffic, `⇧p` priority to last batch | `d` `c` `s` `e` `t` `f` `p` (`⇧b` ignite stays) | **`d d`**, `d c`, `d t` |
| Build | `⇧c` constructions, `⇧f` furniture, `⇧m` mechanisms, `⇧t` traps, `⇧s` special | `c` `f` `m` `t` `s` (`w` workshops already plain) | `b f`, `b w` |
| Zones | `⇧s` `⇧f` `⇧p` `⇧b` `⇧d` `⇧o` `⇧a` `⇧m` `⇧t` `⇧u` `⇧c` | `s` stockpile, `f` farm, `p` pasture, `b` bedroom, `d` dining, `o` hospital, `a` archery, `m` meeting, `t` tomb, `u` dump, `c` sanctum (`⇧k` compost stays) | **`z s`**, `z f`, `z b` |
| Zone inspector | `⇧e` resize, `⇧p` preset, `⇧o` owner, `⇧c` cellar, `Shift+A` all seasons | `e` `p` `o` `c` `a` | |
| Units | `Shift+W` `Shift+T` `Shift+N` `Shift+M` `Shift+L`, `⇧c` centre | `w` wounded first, `t` title, `n` rename, `m` to a squad, `l` labor manager, `c` centre | `u c` |
| Labors | `⇧a` whole row | `a` | |
| Jobs | `⇧l` labor filter, `⇧s` state filter, `⇧p` priority | `l` `s` `p` | |
| Orders | `⇧n` new, `⇧m` mode, `⇧p` priority, `⇧f` material | `n` `m` `p` `f` | **`o n`** |
| Workshop | `⇧n` new order, `⇧o` its orders, `⇧f` material | `n` `o` `f` (`⇧s` suspend stays) | click, `n` |
| Stocks | `⇧f` forbid, `⇧t` to depot | `f` `t` (`⇧d` dump, `⇧m` melt stay) | `s f` |
| Depot | `⇧m` move goods here, `⇧t` trade | `m` `t` | |
| Military | `Shift+L` leader, `Shift+B` barracks, `Shift+N` rename, `⇧s` station, `⇧c` clear station, `⇧p` patrol, `⇧f` follow, `⇧m` next mode, `⇧o` off, `⇧t` train, `⇧a` add members | `l` `b` `n` `s` `c` `p` `f` `m` `o` `t` `a` (`⇧k` kill stays) | `m s`, `m t` |
| Animals | `⇧p` pasture, `⇧c` cap, `⇧a` assign, `⇧n` name, `⇧t` train | `p` `c` `a` `n` `t` (`⇧s` slaughter stays) | |
| Civilizations | `⇧d` depot, `⇧t` trade, `⇧a` add request, `⇧p` priority | `d` `t` `a` `p` | |
| Mood | `⇧s` sort | `s` | |
| Look (T-669..T-671) | design: `S-c` centre, `S-f` follow | `c` centre, `f` follow; `1`–`9`, `Enter`, `h`, `Backspace`, `PgUp` `PgDn` as the design says; `k` or `Esc` closes | `k`, then `c` / `f` |
| Debug | `⇧d` dump save | `d` | |

Result: 86 Shift bindings become 12; 82 Shift+letter become 8. Two-key plain sequences cover ranks 4 to 8: `d d`, `d w`, `d t`, `b f`, `b w`, `z s`, `z f`, `o n`, `k` then `c` / `f`.

### No collisions

Within each context every key still has one binding (the table checks it on load, as today). What a panel's letters shadow is now deliberate; what each panel leaves free to switch directly:

| Panel open | Panel letters that still switch directly |
|---|---|
| Designate | `b` `z` `k` `u` `l` `j` `o` `m` `n` `a` `y` |
| Build | `d` `z` `k` `u` `l` `j` `o` `n` `p` `e` `a` `y` |
| Zones (no zone selected) | `k` `l` `j` `n` `e` `y` |
| Units | `d` `b` `z` `k` `j` `o` `s` `p` `e` `a` `f` `y` |
| Orders | `d` `b` `z` `k` `u` `l` `j` `s` `t` `c` `e` `a` `y` |
| Stocks, Look, Jobs, Mood, Labors | every letter but their few own ones and `k` closing Look |
| Military | `d` `z` `k` `u` `e` (its long key list takes the rest) |
| Animals | `d` `b` `z` `k` `u` `l` `j` `o` `s` `m` `e` `f` `y` |

The flows that matter most stay one key: from Designate to Build, Zones or Look; from Build to Designate, Zones or Look; from anything to Look.

## 4. Migration

**For a player used to the old keys.** Every old chord still does what it did: each action kept its letter, and a plain binding takes the shifted press unless the context binds the Shift key itself. Two habits change:

- Inside a panel, a bare panel letter the panel uses now acts instead of switching. The one a player will hit: drawing a stockpile then pressing `b` or `d` arms Bedroom or Dining hall. `Esc` first.
- `d` no longer closes Designate (it chooses Dig); `Esc` does. `l` in Units opens the labor manager, not the Labors panel (`Esc` `l` for that). `Shift+Y` inside the zone inspector is now "back"; elsewhere it still opens the calendar.

To teach it: one new hint, shown the first time a panel-local letter acts in a panel that shadows a panel letter: "Inside a panel its own letters come first. Esc, then a letter, opens another panel." Help's Keys tab replaces its D-U2 note with the same sentence. The panel footers already list each panel's letters, now shown `[s]` instead of `[S-s]`.

**What the implementation changes.**

- `src/content/keymap.json`: 72 `[S-x]` rows become `[x]`; the `Shift+…` rows of § 3 become plain; `Shift+Y` moves to the Fortress panels list as `y`. The `[S-x]` notation keeps one meaning: an explicit Shift accelerator (the 8 that stay).
- `src/ui/keymap.ts`: `acceleratorOf` / `acceleratorLabel` stop deriving Shift from `panelLetters()`; `FORTRESS_PANEL_KEYS` gains `y` calendar; `rebind` / `loadOverrides` must allow a panel binding to share a letter with a panel letter (a shadow, not a conflict) while still refusing two bindings in one context. 37 call sites of `acceleratorOf`, `acceleratorLabel` and `panelLetters` in `src/ui` follow.
- `src/ui/screens/fortress.ts`: the key dispatch asks the open panel's contexts before the panel letters (rule 2 before rule 3).
- `src/ui/strings.ts` (53 captions), `src/content/strings.json` (4), `src/content/tutorial.json` (4: `[S-s]`, `[S-n]`, `[S-f]`, `[S-a]`), `src/ui/panels/help.ts` (the D-U2 note), `src/ui/panels/military.ts` and `units.ts` captions, one new hint in `hints.json`. The existing hints name only panel letters and plain keys and stay as they are.
- Docs: `docs/03-content/ui-keymap-and-screens.md` (§ Keymap notation, § Panels paragraph, every table: 94 `[S-x]`), `docs/04-implementation/ui-screens/panels.md` (91), `fortress-screen.md` (25), `docs/02-systems/24-ui-and-input.md` § Input model and § Panels (8), `25-runecraft.md` (4), and a decision in `docs/decisions.md` that supersedes D-U2.
- Tests: about 25 unit files under `test/unit/ui/` press Shift letters or assert `[S-x]` captions (most: `u03-hotkeys`, `t332-panels-*`, `u06-units-military`, `u03-orders`, `t428-caption-hits`); `test/golden/render/m8-panels.json` (10 captions); `test/e2e/farm-plot-and-orders.spec.ts`; `test/scenarios/ui_keymap_parity.scenario.ts` keeps its checks and gains one for rule 2 (a panel letter bound in the open panel acts; an unbound one switches). Any test that presses a panel letter inside another panel to switch must be found and given `Esc` first; a search for it is the first step of the implementation. A new unit test per guarantee: `k` free in every panel context, and no context binds one key twice.
- T-669..T-671: if they land first with `S-c` / `S-f`, T-674 moves them to `c` / `f` with the rest; whoever builds them next can use `c` / `f` directly.

## 5. Choices I made

1. **Panel-first letters instead of "panel letters always win".** This is the decision. Alternatives: keep D-U2 and special-case `d d` only (fixes dig, leaves 80 Shift chords, which is what the owner asked about); or make `Shift`+panel letter the always-works switch (puts Shift back on something frequent and collides with the destructive Shift keys). The cost of the choice is § 4's first habit.
2. **Same letters, Shift dropped; no reassignments.** Old chords keep working and nothing has to be relearned. Some mnemonics could be better (`w` stairs, `q` ice) but moving them is churn the owner did not ask for.
3. **Own letter twice only where it means something.** `d d` is dig because dig starts with `d`. I did not make `z z` stockpile, `o o` new order or `b b` the last building: they are not mnemonic and the own letter closing the panel is useful. Each is a one-row addition later.
4. **Destructive actions keep Shift even though they confirm.** The confirm (default No) stays; Shift also leaves the plain letter free to switch panels from Stocks, Animals and Workshop, where `s` `d` `m` are common switch targets. `x` stays plain and confirmed, as the one remove key.
5. **`k` is free in every panel.** Look is rank 3; compost heap and kill keep `⇧k` so that it is.
6. **Calendar on plain `y`.** It was on Shift only because `y` is a panel-local key in three panels; under the new rule those three win and the calendar is `y` elsewhere.
7. **Zone inspector `a` (all seasons) plain.** It reads like a variant, but setting a farm's crop for the year is the common farm action.
8. **Units `l` opens the labor manager** (marked dwarves, or the cursor's dwarf). It was `Shift+L`, and bare `l` jumped to the Labors panel; both are labor views, the manager is the one used from Units.
9. **Inspection centre and follow are `c` and `f`** inside Look, same letters as T-669..T-671 design, Shift dropped; Units' centre becomes `c` to match.
10. **Zones keeps all its letters** even though `b` and `d` are common switch targets: bedroom and dining hall are common zones and their letters are what players know. If the first habit of § 4 proves annoying, the cheapest fix is to give those two zone types other letters, not to bring back Shift.

## 6. The full table

Every binding of `keymap.json`, by context. **⇧** marks a Shift chord, **seq** a two-key sequence from the map (the panel's letter first). "=" means unchanged.

### Global

| Action | Today | Proposed |
|---|---|---|
| cancel tool → close panel → game menu | `Esc` | = |
| pause / resume | `Space` | = |
| speed up | `+` `=` | = |
| speed down | `-` | = |
| quick save / quick load (confirm) | `F5` / `F9` | = |
| save menu | `Ctrl+S` | = |
| debug panel | `F12` | = |
| help | `?` | = |
| toggle sidebar | `Tab` | = |
| undo last designation batch | `Ctrl+Z` | = |
| calendar panel | `Shift+Y` ⇧ | `y` |
| music on / off | `Ctrl+M` | = |
| skip the tutorial step | `F1` | = |
| end the tutorial | `Shift+F1` ⇧ | = (variant of `F1`) |

### Fortress panels (from the map)

| Panel | Today | Proposed |
|---|---|---|
| Designate, Build, Zones, Units, Labors, Jobs, Orders, Stocks, Military, Animals, Threats, Civilizations, Population, Mood, Log, Look, Overlays | `d b z u l j o s m n t c p e a k f` | = letters; inside a panel, that panel's own letters come first |
| Calendar | `Shift+Y` ⇧ (global) | `y` |
| Help, Debug | `?`, `F12` | = |

### Map

| Action | Today | Proposed |
|---|---|---|
| pan or move the cursor (Shift: 10) | arrows | = |
| z-level down / up | `<` `,` / `>` `.` | = |
| centre on the hearth | `Home` | = |
| zoom in / out | `Ctrl+↑` / `Ctrl+↓` | = |
| look at the mouse | `k` | = |
| act at the cursor (Shift: a corner) | `Enter` | = |
| set priority (designation or zone tool) | `1`–`9` | = |
| rotate / cycle material (building tool) | `r` / `x` | = |
| cancel designations / zone / building in a selection | `Delete` | = |

### Panels (every list)

| Action | Today | Proposed |
|---|---|---|
| move selection / scroll | `↑` `↓` / `PageUp` `PageDown` | = |
| activate | `Enter` | = |
| next / previous field | `Tab` / `Shift+Tab` ⇧ | = (variant) |
| accelerator | `[letter]` | = |
| focus the filter | `/` | = |
| back within nested menus | `Backspace` | = |
| across, or change the value | `←` `→` | = |

### Map selection (drag with no tool)

| Action | Today | Proposed |
|---|---|---|
| forbid everything on the tiles | `⇧f` | `f` |
| dump everything on the tiles (confirm) | `⇧d` | = `⇧d` |
| move the goods to the depot | `⇧t` | `t` |

### Designate panel (seq: `d` then the key)

| Action | Today | Proposed |
|---|---|---|
| dig | `⇧d` | `d` (`d d`) |
| channel | `⇧c` | `c` |
| stairs | `w` | = |
| ramp | `r` | = |
| smooth | `⇧s` | `s` |
| engrave | `⇧e` | `e` |
| remove a construction | `x` | = |
| chop trees | `⇧t` | `t` |
| gather plants | `g` | = |
| harvest | `h` | = |
| harvest ice | `q` | = |
| ignite (set a fire) | `⇧b` | = `⇧b` |
| traffic (again: next mode) | `⇧f` | `f` |
| the tool's priority to the last batch | `⇧p` | `p` |

### Build panel (seq: `b` then the key)

| Action | Today | Proposed |
|---|---|---|
| constructions | `⇧c` | `c` |
| furniture | `⇧f` | `f` |
| workshops | `w` | = |
| mechanisms | `⇧m` | `m` |
| traps | `⇧t` | `t` |
| special | `⇧s` | `s` |

### Zones panel (seq: `z` then the key)

| Action | Today | Proposed |
|---|---|---|
| stockpile | `⇧s` | `s` |
| farm plot | `⇧f` | `f` |
| pasture | `⇧p` | `p` |
| bedroom | `⇧b` | `b` |
| dining hall | `⇧d` | `d` |
| hearth hall | `h` | = |
| hospital | `⇧o` | `o` |
| barracks | `r` | = |
| archery range | `⇧a` | `a` |
| meeting area | `⇧m` | `m` |
| tomb | `⇧t` | `t` |
| dump | `⇧u` | `u` |
| fishing zone | `i` | = |
| gather zone | `g` | = |
| sanctum | `⇧c` | `c` |
| compost heap | `⇧k` | = `⇧k` (`k` stays Look) |

### Zone inspector (a selected zone)

| Action | Today | Proposed |
|---|---|---|
| back to the zone types | `y` | = |
| unlink a source, or remove the zone (confirm) | `x` | = |
| remove the stockpile zone (confirm) | `Delete` | = |
| resize the zone | `⇧e` | `e` |
| link a source stockpile | `i` | = |
| preset dropdown | `⇧p` | `p` |
| category tree / numeric settings / material classes | `g` / `q` / `v` | = |
| owner or apprentice picker | `⇧o` | `o` |
| cellar on / off | `⇧c` | `c` |
| farm: the row's crop for every season | `Shift+A` ⇧ | `a` |
| farm: fertilize on / off | `w` | = |
| toggle the checkbox | `Space` | = |
| adjust the focused value | `+` `=` `-` | = |

### Units panel (seq: `u` then the key)

| Action | Today | Proposed |
|---|---|---|
| mark the row / mark all or none | `Space` / `*` | = |
| idle only / all | `i` | = |
| wounded first / list order | `Shift+W` ⇧ | `w` |
| give or take a title | `Shift+T` ⇧ | `t` |
| rename the dwarf | `Shift+N` ⇧ | `n` |
| add the marked dwarves to a squad | `Shift+M` ⇧ | `m` |
| sleep an hour earlier / later | `[` `]` | = |
| labor manager on the marked dwarves | `Shift+L` ⇧ | `l` |
| centre the map on the dwarf | `⇧c` | `c` |

### Labors, Jobs, Mood, Population, Log, Help, Debug

| Context | Action | Today | Proposed |
|---|---|---|---|
| Labors | whole row on / off | `⇧a` | `a` |
| Jobs | jobs ↔ "Orders waiting" | `Tab` | = |
| Jobs | cycle labor filter | `⇧l` | `l` |
| Jobs | cycle state filter | `⇧s` | `s` |
| Jobs | raise priority | `⇧p` | `p` |
| Jobs | cancel the job | `x` | = |
| Mood | sort by tier | `⇧s` | `s` |
| Population | cap up / down | `+` `-` | = |
| Log | filter tabs | `1` `2` `3` | = |
| Help | Keys / Legend / Start | `1` `2` `3` | = |
| Debug | dump save | `⇧d` | `d` |
| Debug | replay season log / hash world | `r` / `h` | = |

### Orders panel (seq: `o` then the key)

| Action | Today | Proposed |
|---|---|---|
| new order | `⇧n` | `n` (`o n`) |
| count +1 / −1 (Shift: 10) | `+` `=` / `-` `_` | = |
| repeat | `r` | = |
| remove (confirm) | `x`, `Delete` | = |
| mode | `⇧m` | `m` |
| priority | `⇧p` | `p` |
| material | `⇧f` | `f` |
| move in its queue | `Shift+↑` `Shift+↓` ⇧ | = (variant of `↑↓`) |

### Workshop and Building panels (seq: a click, then the key)

| Context | Action | Today | Proposed |
|---|---|---|---|
| Workshop | new order here | `⇧n` | `n` |
| Workshop | this workshop's orders | `⇧o` | `o` |
| Workshop | material of the orders | `⇧f` | `f` |
| Workshop | next worker | `w` | = |
| Workshop | suspend (confirm) / resume | `⇧s` | = `⇧s` |
| Workshop | take apart (confirm) | `x` | = |
| Building | build priority | `1`–`9` | = |
| Building | link a lever or plate | `i` | = |
| Building | unlink, or release a caged creature (confirm) | `r` | = |
| Building | pull the lever | `y` | = |
| Building | tame the caged creature | `g` | = |
| Building | owner of a bed or coffin | `w` | = |
| Building | take out its bedding | `h` | = |
| Building | see the items | `v` | = |
| Building | cancel the plan or take apart (confirm) | `x` | = |

### Stocks and Depot (seq: `s` then the key)

| Context | Action | Today | Proposed |
|---|---|---|---|
| Stocks | forbid | `⇧f` | `f` |
| Stocks | dump (confirm) | `⇧d` | = `⇧d` |
| Stocks | melt (confirm) | `⇧m` | = `⇧m` |
| Stocks | to the depot | `⇧t` | `t` |
| Stocks | mark goods in the depot list | `Space` | = |
| Depot | move goods to the depot | `⇧m` | `m` |
| Depot | return to stock | `r` | = |
| Depot | open the trade session | `⇧t` | `t` |

### Military panel (seq: `m` then the key)

| Action | Today | Proposed |
|---|---|---|
| mark / mark all / add or remove marked | `Space` / `*` / `Enter` | = |
| squad leader | `Shift+L` ⇧ | `l` |
| barracks zone | `Shift+B` ⇧ | `b` |
| rename the squad | `Shift+N` ⇧ | `n` |
| weapon class / armor | `w` / `g` | = |
| alert: calm / watchful / hearth | `1` / `2` / `3`, `h` | = |
| new squad | `+` | = |
| disband (confirm) | `x` | = |
| set station / clear station | `⇧s` / `⇧c` | `s` / `c` |
| add patrol points / clear patrol | `⇧p` / `y` | `p` / = |
| order a kill | `⇧k` | = `⇧k` (`k` stays Look) |
| follow a dwarf | `⇧f` | `f` |
| cancel the orders | `q` | = |
| next mode / off / train / active | `⇧m` / `⇧o` / `⇧t` / `v` | `m` / `o` / `t` / = |
| add members / remove members | `⇧a` / `r` | `a` / = |
| ranged or melee | `j` | = |

### Animals and Civilizations

| Context | Action | Today | Proposed |
|---|---|---|---|
| Animals | tame / wild tab | `1` `2` | = |
| Animals | pasture | `⇧p` | `p` |
| Animals | slaughter (confirm) | `⇧s` | = `⇧s` |
| Animals | breeding cap | `⇧c` | `c` |
| Animals | assign | `⇧a` | `a` |
| Animals | name | `⇧n` | `n` |
| Animals | train | `⇧t` | `t` |
| Animals | wild: hunt on / off | `h` | = |
| Civilizations | depot panel | `⇧d` | `d` |
| Civilizations | trade session | `⇧t` | `t` |
| Civilizations | add a request | `+`, `⇧a` | `+`, `a` |
| Civilizations | remove the request | `x` | = |
| Civilizations | request priority | `⇧p` | `p` |

### Look panel (with T-669..T-671)

| Action | Today | Proposed |
|---|---|---|
| tabs (today) / open a row of the tile list (design) | `1` `2` `3` | `1`–`9` |
| open the first row | — | `Enter` |
| take apart the building here (confirm) | `x` | moves to the building panel (design § 8) |
| centre on the thing | — (design `S-c`) | `c` |
| follow on / off | — (design `S-f`) | `f` |
| the tile list of where it is | — | `h` |
| back to the view before | — | `Backspace` |
| scroll | — | `PgUp` `PgDn`, wheel |
| close | `Esc`, `k` | = |

### Screens over and before the fortress (all plain, unchanged)

| Context | Keys |
|---|---|
| Labor manager | arrows (`Shift+↑↓` marks rows passed), `Space`, `*`, `Enter`, `a` row, `c` column, `+` `=` `-`, `1`–`9`, `t` templates, letters jump to a labor (`Shift` with `a` `c` `t`), `Esc`, `Home`, `End` |
| Profession templates | `1`–`9` |
| Trade session | `Tab`, `+` `=` `-`, `Enter` offer, `g` gift, `Esc`, `Home` none, `End` all |
| Game menu | `r` resume, `s` save, `l` load, `o` settings, `n` rename, `x` retire (confirm), `m` main menu |
| Confirmation | `y`, `n`, `Enter` |
| Main menu | `n` `t` `c` `l` `g` `o` `a` `i` |
| World generation | `g` generate, `r` random seed |
| World map | arrows (`Shift`: 8), `f` filters, `Enter` embark, `?` legend, `+` `=` `-` |
| Embark | `1`–`4` tabs, `+` `=` `-`, `0`, `r` reroll, `n` rename, `p` presets, `l` loadouts, `Enter`, `t` testing, `a` add, `x` remove, `*` everyone |
| Load | `x` delete (confirm), `e` export, `i` import |
