/**
 * What the embark screen shows about a party and its presets at a glance, and how its find fields
 * match: `04-implementation/ui-screens/embark.md` § Finding things. Pure functions of content
 * rows, so the screen and its tests read the same text.
 */

/** A skill as the lists name it. */
export interface NamedSkill {
  readonly id: string;
  readonly name: string;
}

/**
 * A dwarf's skills, highest first (ties in the skill list's order), as `Mining 5, Building 3, Axe
 * 2`, fitted to `width`: skills that do not fit are counted at the end (`Masonry 5, Mechanics 3
 * +1`). Empty when the dwarf has none.
 */
export function skillSummary(levels: Readonly<Record<string, number>>, skills: readonly NamedSkill[], width: number): string {
  const order = new Map(skills.map((s, k) => [s.id, k]));
  const named = Object.entries(levels)
    .filter(([id, level]) => level > 0 && order.has(id))
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([id, level]) => `${skills[order.get(id) ?? 0]?.name ?? id} ${level}`);
  for (let shown = named.length; shown > 0; shown -= 1) {
    const rest = named.length - shown;
    const text = named.slice(0, shown).join(', ') + (rest > 0 ? ` +${rest}` : '');
    if (Array.from(text).length <= width) return text;
  }
  return named.length === 0 ? '' : (named[0] as string);
}

/**
 * A preset's one-line description: each dwarf's main skill (its highest, on a tie the one the
 * preset names first), the same skill counted once (`Mining x2·Woodcutting·Masonry`).
 */
export function presetSummary(skills: readonly { dwarf: number; skill: string; level: number }[], named: readonly NamedSkill[]): string {
  const order = new Map(named.map((s, k) => [s.id, k]));
  const best = new Map<number, { skill: string; level: number }>();
  for (const s of skills) {
    const was = best.get(s.dwarf);
    if (was === undefined || s.level > was.level) best.set(s.dwarf, { skill: s.skill, level: s.level });
  }
  const counts = new Map<string, number>();
  for (const dwarf of [...best.keys()].sort((a, b) => a - b)) {
    const skill = (best.get(dwarf) as { skill: string }).skill;
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts].map(([id, n]) => {
    const name = named[order.get(id) ?? -1]?.name ?? id;
    return n > 1 ? `${name} x${n}` : name;
  }).join('·');
}

/** Whether a find field's text matches a row: every word of it is in the row's name or its group's, in any order and case. */
export function findMatches(needle: string, ...haystack: readonly string[]): boolean {
  const text = haystack.join(' ').toLowerCase();
  return needle.trim().toLowerCase().split(/\s+/).every((w) => text.includes(w));
}
