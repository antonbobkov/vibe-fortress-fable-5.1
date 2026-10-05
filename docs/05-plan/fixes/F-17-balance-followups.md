# F-17 — Balance follow-ups from the economy fortress (L)

**Needs:** the economy fortress (`1851d4a`) and its report (`23e4f98`) · **Spec touched:** `18-threats-monsters-and-raids.md`, `21-immigration.md` (only if the code is brought to it), `balance.md`, `workshops-and-recipes.md` exporter only

## Why

[`reports/M8-balance-economy.md`](../../../reports/M8-balance-economy.md) re-measured the balance with a fortress that runs a real economy.

**What it showed:**
- **Peaceful wealth is close to the model.** It reaches 10,740 / 23,687 / 31,808 marks in years 1–3, against 4,000–8,000 / 15,000–25,000 / 35,000–60,000.
- **Perils 2 and 4 no longer survive.** In four of seven peril-2 seeds the script itself blocks the entrance stair with a workshop, so the economy never starts. In the others the squad's metal chain is not staffed before combat.
- **Mood fell** to a time mean of 34.65.
- **Consumption stays about 48% under the model.**
- **It found two real bugs and three places where the spec and the code disagree.**

Every decision below was made by the parent under the owner's standing instruction to use judgement.

## Decisions

### Bugs (code does not match the spec)

1. **F-17a — crafts carry their quality.** `scripts/export-tables.mjs` marks quality-bearing outputs by exact item id, so the concrete craft items produced by the symbolic `craft` output (figurines, rings, amulets and the rest) are exported with `quality: false`, and `items/api.ts` ignores their rolled quality. This contradicts the Q-marked craft rows of `workshops-and-recipes.md`, `12` § Quality and `items.md`. Fix the exporter so every item a Q-marked recipe can output is quality-bearing, then regenerate the content. A fine stone craft is worth what `it_value` and the trade example say.
2. **F-17b — a job never outputs from inputs it no longer holds.** After an interrupted craft job's reservation expires, another job can reserve and consume the same delivered input. The first job then resumes with a stale delivered id and completes with material 0 and value 0 (`jobs/board.ts` keeps delivered ids without revalidating; `workshops/operate.ts` produces output with zero consumption). Per `11` § claim/fetch/consume and `12` § Operation:
   - When a job resumes, or before it consumes, each delivered input is revalidated: it must exist, be unconsumed, and be reserved to this job.
   - A missing input goes back to "to fetch".
   - A job never completes without consuming its inputs.

### Spec and code disagreements (decided)

3. **F-17c — renown counts dwarves, not animals.** `18` § Renown says "population"; `10` and `21` mean dwarves. The code counts every living fortress creature, so each tame animal adds 0.2 renown. Renown's population term is the dwarf population. Amend `18`'s renown line to say "dwarf population" and fix `threats/index.ts`.
4. **F-17d — the winter wave follows the written order.** `21` § Wave size clamps the computed size and then halves the winter wave. The code halves first. Bring the code to the spec. Update the unit test's examples so that they distinguish the two orders.
5. **F-17e — smoothing and engraving raise rooms, not wealth.** `balance.md` § Wealth curve lists "smoothed rooms" and "engraved halls" as wealth drivers. `13` § Value excludes engravings from v1 value, and `14` gives tile improvements room score only. The detailed rules stand. Amend the two driver cells of `balance.md`'s wealth table to the measured drivers:
   - year 2: "iron goods, cut gems, a caravan's worth of purchases, prepared meals and drink";
   - year 3: "steel, masterworks, a hundred barrels, lavish meals".

   Add one sentence under the table: "Smoothing and engraving raise room tiers (mood and immigration), not wealth."

### Fixture (what a competent player would do; test authoring only)

6. **F-17f — the script never builds on its own entrance.** Workshop footprints and their temporary forbidden corners stay clear of the entrance stair, the mine shafts and their access tiles.
7. **F-17g — routine work is not urgent.** The script gives routine production, hauling, mining and smoothing the default priorities (designation and order priority 5, labors at 5 unless a real bottleneck needs one step). It keeps priorities 1–2 for genuine emergencies only. This matters for two reasons:
   - `10` lets a job of priority ≤ `NEED_DEFER_PRIORITY` defer a want-level need. The economy script's urgent orders make dwarves eat and drink at the critical threshold instead of the want threshold, which is why consumption runs about 48% under the model.
   - The same urgency keeps the social, comfort and joy standing thoughts active, which is why mood fell.

   This is the fixture's doing, not a model gap.
8. **F-17h — the squad is armed before the first raid at perils 2 and 4.** The smelter and forge chain (charcoal, smelt, mail, shields, weapons for the three soldiers) is staffed with dedicated workers and ordered first, from day 1, using the embark anvil and bars and then mined ore. It finishes before the first raid window that `balance.md` gives (day 56). Only then does the general economy take those workers.
9. **F-17i — specialists.** Assign dedicated high-skill crafters (stone, metal, gems) and keep them on their craft, as a player would. Open a deeper gem and ore band in years 2 and 3. Keep export crafts and alloy orders running.

### Not decided here

- No balance constant changes. After the re-measure, anything still more than 30% off the model on living fortresses is reported with the constant and the value that would close it. The parent decides then.

## Tasks, in order, one commit each

1. `F-17: crafts carry quality; jobs never output from inputs they no longer hold` (F-17a, F-17b). Tests tagged `F-17`: a Q-marked craft's value follows its quality; the stale-input trace from the report (seed `three-years-p0-2`, job 1005) reduced to a unit case that re-fetches and never emits a material-0 item. Regenerate goldens with a `golden:` paragraph.
2. `F-17: renown counts dwarves; the winter wave clamps before halving; balance.md wealth drivers` (F-17c, F-17d, F-17e), with tests and the spec amendments as described.
3. `T-M8-06: the economy fortress keeps its entrance clear, works at default priority and arms its squad first` (F-17f–i). Peril 0 must keep 0 deaths and its guarantees.
4. `T-M8-06: re-measure the balance after F-17`. Run the scenario, the 20-seed sweep once and the mood instrument. Update `reports/M8-balance-economy.md` with an "After F-17" section in the same shape (before → after, wealth by driver, survival by peril with causes, consumption, mood, immigration evaluations). Add one dated line under each of B-008…B-012. Classify what remains as FIXTURE, BUG or MODEL GAP, with the constant and value for each MODEL GAP. Do not change constants.

## Done

- The four commits, each green on lint, typecheck, content:check, strings:check, interface:check and `npm test`.
- `test:perf` green for tasks 1 and 2: the per-system budgets must hold, since tasks 1 and 2 touch jobs, items and threats.
- `PROGRESS.md` ticked, and DECISIONS rows added.
