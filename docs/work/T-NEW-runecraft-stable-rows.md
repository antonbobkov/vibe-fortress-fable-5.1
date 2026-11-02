# T-NEW — Runecraft 0: new content rows number after old rows

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md), through T-467 · **Size:** M · **Needs:** T-467 · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md) § Row numbering. Every later runecraft task depends on this.

## Why

Rows are numbered sorted by id and the numbers are saved raw (`map.material`, `Skills`, `Labors`, job filters, zone settings). The first new material or skill would shift them, and an old save would load under the soft match with its rock, skills and labors wrong.

## What to do

- Table `rowOrder`, file `03-content/row-order.md`, schema, export. Empty of rows here.
- `makeTable(name, rows, appended)` and loader step 4. `content-pipeline.md` § Loading says the rule.
- `test/fixtures/content-row-baseline.json` and the test that every id in it keeps its index.
- On load, grow `Skills.level`, `Skills.xp`, `Labors.enabled` and `laborPriorities` to the table sizes.
- `save-format.md` gets the rule on optional fields from § Row numbering.

## Done

- With a content override that appends a material and a skill, `test/fixtures/played-fortress.deepholm` loads and every tile's material, every dwarf's skills and every labor bit match the load without it.
- The world hashes do not move: this task changes no number. `golden: none`.
