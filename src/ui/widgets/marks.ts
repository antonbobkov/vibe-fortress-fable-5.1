/**
 * Marked rows: the multi-selection of a list (24 § Panels; UI audit M5, M10, M11, § 3 "Multi-select
 * units": "`Space` to mark rows, then act on the selection"). The marks are entity ids, so they
 * survive a filter or a re-sort; `anchor` is the row a `Shift` range starts from.
 */

export class Marks {
  readonly ids = new Set<number>();
  anchor: number | null = null;

  get size(): number {
    return this.ids.size;
  }

  has(id: number): boolean {
    return this.ids.has(id);
  }

  /** `Space`: mark or unmark one row. */
  toggle(id: number): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
    this.anchor = id;
  }

  /** `Shift`-click: mark every row from the anchor to `id` (just `id` without an anchor in `rows`). */
  range(rows: readonly number[], id: number): void {
    const to = rows.indexOf(id);
    if (to < 0) return;
    const from = this.anchor === null ? -1 : rows.indexOf(this.anchor);
    const a = from < 0 ? to : Math.min(from, to);
    const b = from < 0 ? to : Math.max(from, to);
    for (let k = a; k <= b; k += 1) this.ids.add(rows[k] as number);
    this.anchor = id;
  }

  /** `*`: mark every row, or unmark them when all are marked. */
  all(rows: readonly number[]): void {
    if (rows.length > 0 && rows.every((id) => this.ids.has(id))) for (const id of rows) this.ids.delete(id);
    else for (const id of rows) this.ids.add(id);
  }

  clear(): void {
    this.ids.clear();
    this.anchor = null;
  }

  /** Drop the marks of rows that no longer exist (a dwarf died, a member left). */
  prune(rows: readonly number[]): void {
    if (this.ids.size === 0) return;
    const live = new Set(rows);
    for (const id of Array.from(this.ids)) if (!live.has(id)) this.ids.delete(id);
    if (this.anchor !== null && !live.has(this.anchor)) this.anchor = null;
  }

  /** The marked rows in list order. */
  list(rows: readonly number[]): number[] {
    return rows.filter((id) => this.ids.has(id));
  }

  /**
   * What an action on `row` applies to: every marked row when `row` is marked (or there is no
   * row), otherwise that row alone.
   */
  targets(rows: readonly number[], row: number | undefined): number[] {
    if (this.ids.size > 0 && (row === undefined || this.ids.has(row))) return this.list(rows);
    return row === undefined ? [] : [row];
  }
}
