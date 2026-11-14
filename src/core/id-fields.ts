/**
 * The component fields that hold content indices, and their conversion to and from string ids.
 *
 * `save-format.md` § Serialization helpers: "Content references are written as string ids: every
 * component field typed `Idx<…>` is converted through `registry.idOf` on save and
 * `registry.indexOf` on load (a table of which fields are indices is generated from the component
 * schemas)". The table below is what `scripts/parse-id-fields.mjs` generates from
 * `schemas/components.md`; `test/unit/save-game.test.ts` fails when the two differ. The string ids
 * the save references feed the content soft match of `content-pipeline.md` (docs/04-implementation/save-format.md § Serialization helpers,
 * D-080).
 */

import type { Registry } from './registry';

export interface IdField {
  /** The component name. */
  readonly component: string;
  /** Field path: `.` a nested record, `[]` every element of an array. */
  readonly path: string;
  /** The content table the index points into. */
  readonly table: string;
  /** The field may also hold a plain string that is not an id (`WorkOrder.materialFilter`). */
  readonly orString: boolean;
}

/** Generated from `schemas/components.md` by `scripts/parse-id-fields.mjs`. */
export const ID_FIELDS: readonly IdField[] = Object.freeze([
  { component: 'Creature', path: 'species', table: 'creatures', orString: false },
  { component: 'Creature', path: 'bodyPlan', table: 'bodyPlans', orString: false },
  { component: 'Skills', path: 'lastRaised', table: 'skills', orString: false },
  { component: 'Personality', path: 'traits[]', table: 'personality', orString: false },
  { component: 'Mood', path: 'thoughts[].thought', table: 'thoughts', orString: false },
  { component: 'Item', path: 'type', table: 'items', orString: false },
  { component: 'Item', path: 'material', table: 'materials', orString: false },
  { component: 'Item', path: 'stone', table: 'materials', orString: false },
  { component: 'Item', path: 'enchant.id', table: 'enchants', orString: false },
  { component: 'Item', path: 'seasoned[]', table: 'materials', orString: false },
  { component: 'Corpse', path: 'species', table: 'creatures', orString: false },
  { component: 'Building', path: 'type', table: 'buildings', orString: false },
  { component: 'Building', path: 'material', table: 'materials', orString: false },
  { component: 'Workshop', path: 'orders[].recipe', table: 'recipes', orString: false },
  { component: 'Workshop', path: 'orders[].materialFilter', table: 'materials', orString: true },
  { component: 'Workshop', path: 'orders[].targetType', table: 'items', orString: false },
  { component: 'Zone', path: 'type', table: 'zoneTypes', orString: false },
  { component: 'Projectile', path: 'spell', table: 'spells', orString: false },
  { component: 'Crop', path: 'plant', table: 'plants', orString: false },
]);

/** The id fields of one component. */
export function idFieldsOf(component: string): readonly IdField[] {
  return ID_FIELDS.filter((f) => f.component === component);
}

type Leaf = (value: unknown) => unknown;

/**
 * Apply `fn` to every leaf a path names, in place on a (fresh, plain) value. `traits[]` maps the
 * elements of `traits`; `thoughts[].thought` the `thought` of every element.
 */
function mapPath(value: unknown, segments: readonly string[], fn: Leaf): void {
  if (value === null || typeof value !== 'object' || segments.length === 0) return;
  const [head, ...rest] = segments as [string, ...string[]];
  const isArray = head.endsWith('[]');
  const key = isArray ? head.slice(0, -2) : head;
  const record = value as Record<string, unknown>;
  const field = record[key];
  if (field === undefined) return;
  if (isArray) {
    if (!Array.isArray(field)) return;
    if (rest.length === 0) {
      record[key] = field.map(fn);
    } else {
      for (let k = 0; k < field.length; k += 1) mapPath(field[k], rest, fn);
    }
    return;
  }
  if (rest.length === 0) record[key] = fn(field);
  else mapPath(field, rest, fn);
}

/** A deep copy of plain data (typed arrays copied too), so conversion never touches live state. */
export function clonePlain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (ArrayBuffer.isView(value)) return (value as unknown as { slice(): unknown }).slice() as T;
  if (Array.isArray(value)) return value.map(clonePlain) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = clonePlain((value as Record<string, unknown>)[key]);
  }
  return out as T;
}

/**
 * The save form of a component value: every id field as its string id (`null` for index 0,
 * "none"). Returns a copy; the live value is not changed.
 */
export function idsToStrings(component: string, value: unknown, registry: Registry): unknown {
  const fields = idFieldsOf(component);
  const copy = clonePlain(value);
  for (let k = 0; k < fields.length; k += 1) {
    const f = fields[k] as IdField;
    const table = registry.table(f.table);
    mapPath(copy, f.path.split('.'), (leaf) => {
      if (typeof leaf !== 'number') return leaf;
      return leaf === 0 ? null : table.idOf(leaf);
    });
  }
  return copy;
}

/**
 * The inverse of {@link idsToStrings}, in place on a freshly parsed value. A string that is not
 * an id of the table stays a string when the field allows one, and throws otherwise (the soft
 * match of the load procedure refuses such saves before this runs).
 */
export function stringsToIds(component: string, value: unknown, registry: Registry): unknown {
  const fields = idFieldsOf(component);
  for (let k = 0; k < fields.length; k += 1) {
    const f = fields[k] as IdField;
    const table = registry.table(f.table);
    mapPath(value, f.path.split('.'), (leaf) => {
      if (leaf === null) return f.orString ? null : 0;
      if (typeof leaf !== 'string') return leaf;
      if (f.orString && !table.has(leaf)) return leaf;
      return table.index(leaf);
    });
  }
  return value;
}

/**
 * Every string id the saved component values reference, for the content soft match
 * (`save-format.md` § Load procedure step 2). Strings of an `orString` field that are not ids of
 * its table are not references.
 */
export function referencedIds(
  components: Readonly<Record<string, readonly (readonly [number, unknown])[]>>,
  isId?: (table: string, id: string) => boolean,
): string[] {
  const out = new Set<string>();
  for (const name of Object.keys(components)) {
    const fields = idFieldsOf(name);
    if (fields.length === 0) continue;
    const rows = components[name] ?? [];
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r] as readonly [number, unknown];
      for (let k = 0; k < fields.length; k += 1) {
        const f = fields[k] as IdField;
        const copy = clonePlain(row[1]);
        mapPath(copy, f.path.split('.'), (leaf) => {
          if (typeof leaf === 'string' && (!f.orString || isId === undefined || isId(f.table, leaf))) out.add(leaf);
          return leaf;
        });
      }
    }
  }
  return Array.from(out).sort();
}
