# T-134 — T-195 follow-up: squad orders respect need activities

Closed by `T-195 follow-up: let soldiers finish needs before returning to orders`.

**Source:** the owner's critical review request of 2026-10-10 for T-195 (`8ef36d5`) · **Size:** S · **Needs:** T-195 · **Status:** in progress (codex-a)

## Rule and scope

Implement the existing behavior-selection rules in systems 10 and 16. A critical
need wins in every mode, and squad movement never redirects a `need` activity,
including travel to a bed and sleep. Want-level needs wait only for an active
squad with a hostile in sight, or an explicit order during watchful/hearth alert.
A calm station order and an alert without an order do not alone hold a want.
An acquired combat target is not proof of current sight.

Avoid sight scans when they cannot affect need selection; keep combat's own
target retention unchanged. Pin each discrepancy with a failing stepped-world
test before fixing it. Run the per-system performance file once and record
system 10's measurement, plus all six static checks, npm test and the whole e2e
suite. Restore screenshots and name any golden change. Do not tune fixtures.

## Spec sections

- `02-systems/10-dwarves.md` — Behavior selection and Sleeping.
- `02-systems/16-combat.md` — Squads.
- `04-implementation/algorithms/creature-brains.md` — Dwarf brain.

## Done

The regression cases pass, the gates are green, and the rules are folded into
the spec. Archive this file and remove its backlog row.
