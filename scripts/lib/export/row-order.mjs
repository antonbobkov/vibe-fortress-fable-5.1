// docs/03-content/row-order.md -> rowOrder. Listed order is the numbering, so it is kept as written.

import { join } from 'node:path';
import { CONTENT_DIR, asObjects, plain, readTables } from '../md-tables.mjs';

export function exportRowOrder() {
  // A table with no rows yet is not a table to readTables, so no table means no rows.
  const tables = readTables(join(CONTENT_DIR, 'row-order.md'));
  return tables.flatMap((table) => asObjects(table).map((row) => ({ table: plain(row.table), id: plain(row.id) })));
}
