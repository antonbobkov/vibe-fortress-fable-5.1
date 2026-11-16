/** T-574: the script's state saved beside a game save. */
/** Sets and Maps survive JSON as tagged arrays. */
export function setReplacer(_k: string, v: unknown): unknown {
  if (v instanceof Set) return { __set: [...v] };
  if (v instanceof Map) return { __map: [...v] };
  return v;
}
export function setReviver(_k: string, v: unknown): unknown {
  if (v !== null && typeof v === 'object' && '__set' in v) return new Set((v as { __set: unknown[] }).__set);
  if (v !== null && typeof v === 'object' && '__map' in v) return new Map((v as { __map: [unknown, unknown][] }).__map);
  return v;
}
