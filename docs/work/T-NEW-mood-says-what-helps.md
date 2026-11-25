# T-NEW — "X is miserable" from the second day, and nothing says what would help

**Source:** playtest 2026-11-25 (newcomer) ([report](../../reports/data/2026-11-25-playtest-5.md), finding 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

On the default embark ("Bitterbrae", Balanced), the log said 'Ulfar Ironfist is miserable: "I have not talked to anyone in a while. Slept under the sky. Got soaked."' on Spring 2. It said the same on Spring 3. On Spring 5 it was '2 dwarves are miserable: Dis, Torvald. "There is nowhere to sit. Slept under the sky. I am thirsty."', then more on Spring 6, 7, 9, 10 and 14. Hall spirit was Unhappy from Spring 4 (`31-log-d4.png`, `45-log-d15.png`). The Mood panel lists "Thoughts held by most": "−4 There is nowhere to sit. x7", "−3 Slept under the sky. x7", "−1 Nothing lifts my spirits. x7" (`32-mood.png`). None of it says what to build or do. A newcomer reads "miserable" in the first week and has no way to act on it.

What would help is in 10 § Needs and § Social, comfort, joy, and almost all of it is the **hearth hall**. Sitting there relieves comfort, a talk there relieves social, and a visit there relieves joy. Beds relieve the sleep thoughts, and work relieves purpose. Help's Start page never mentions a hearth. `hint_hearth` exists, but nothing ties it to these thoughts.

## What to do

Decisions:

- **The Mood panel says what helps.** Under "Thoughts held by most", for each of its top three negative thoughts that has a `ui.mood.helps.<thought>` string, a dim line "Helps: …". The strings:
  - `uncomfortable`: "a chair at a table in a dining room, or a hearth hall [b > Special]"
  - `lonely`: "a hearth hall or a meeting zone [z], where dwarves meet and talk"
  - `bored`: "a hearth hall to visit; fine meals"
  - `restless`: "work: dig, chop or order goods; or a squad on Train"
  - `slept_outdoors`: "a bed indoors: a dug hall with beds or pallets"
  - `slept_on_floor`: "a bed or a pallet for each dwarf [b > Furniture]"
  - `hungry`, `thirsty`: "food or drink they can reach; see Stocks [s]"
- **A dwarf's own thoughts** (the Mood panel's per-dwarf rows and the creature view's mood section) show the same "Helps:" line under its strongest negative thought that has one.
- **A new hint, `hint_mood`**: "A miserable dwarf works slower and may sulk. The Mood panel [e] says what helps." Its trigger is the first miserable line of a fortress.
- The thoughts, their values and the miserable line are unchanged.

Spec: `ui-screens/panels.md` § Mood (e), the creature view's mood section (24 § Inspection or `fortress-screen.md` § Inspection panel), 24 § Hints and `03-content/ui-keymap-and-screens.md` § Hints, and the strings in `03-content/ui-keymap-and-screens.md`.

## Done

- [ ] Tests (`describe` with the task id): a fortress whose dwarves all hold `uncomfortable` and `slept_outdoors` shows the two "Helps:" lines under "Thoughts held by most", and a dwarf's row shows the line for its strongest. A thought with no string shows none. The first miserable line shows `hint_mood` once.
- [ ] UI only: no world hash moves and no sweep is needed.
