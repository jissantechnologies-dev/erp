/**
 * The register table from the design: select-all checkbox, sortable headers,
 * right-aligned numeric columns, clickable rows and a skeleton loading state.
 *
 * Emits the prototype's exact markup (`.tbl-wrap > table.tbl`, `td.r.num`), so
 * design-system.css governs the appearance and this file only handles
 * behaviour.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ms } from './ui';

export type Column<T> = {
  /** Header text. */
  header: string;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Right-align and apply tabular numerals — the design's `r` + `num`. */
  numeric?: boolean;
  /** Field name to sort by; omit to make the column unsortable. */
  sortKey?: string;
  width?: number | string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  /** Stable row key. */
  rowKey: (row: T) => string;
  /** Row click target, matching the design's clickable table rows. */
  rowHref?: (row: T) => string;
  loading?: boolean;
  /** Rendered in place of the table when there are no rows and no filters. */
  empty?: ReactNode;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
};

export function DataTable<T>({
  columns, rows, rowKey, rowHref, loading, empty,
  selectable = true, onSelectionChange, sort, onSortChange,
}: DataTableProps<T>) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));

  const commit = (next: Set<string>) => {
    setSelected(next);
    onSelectionChange?.([...next]);
  };

  const toggleAll = () => {
    commit(allSelected ? new Set() : new Set(rows.map(rowKey)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    commit(next);
  };

  const headerClick = (key: string) => {
    const dir = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange?.(key, dir);
  };

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {selectable ? (
              <th style={{ width: 44 }}>
                <input
                  type="checkbox"
                  className="cb"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
            ) : null}
            {columns.map((c) => {
              const isSorted = sort?.key === c.sortKey;
              return (
                <th
                  key={c.header}
                  className={`${c.numeric ? 'r' : ''} ${c.sortKey && onSortChange ? 'sortable' : ''}`}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onClick={c.sortKey && onSortChange ? () => headerClick(c.sortKey!) : undefined}
                >
                  {c.header}
                  {c.sortKey && onSortChange ? (
                    <Ms
                      name={isSorted ? (sort!.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                      className="sort-ind"
                    />
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <tr key={`skel-${i}`}>
                  {selectable ? <td /> : null}
                  {columns.map((c) => (
                    <td key={c.header}>
                      <div className="skel" style={{ width: c.numeric ? '40%' : '70%', marginLeft: c.numeric ? 'auto' : 0 }} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => {
                const id = rowKey(row);
                const href = rowHref?.(row);
                return (
                  <tr
                    key={id}
                    onClick={href ? () => navigate(href) : undefined}
                    style={href ? { cursor: 'pointer' } : undefined}
                    // Rows are navigable by keyboard as well as click, since the
                    // whole row — not just the link cell — is the hit target.
                    tabIndex={href ? 0 : undefined}
                    onKeyDown={
                      href
                        ? (e) => { if (e.key === 'Enter') navigate(href); }
                        : undefined
                    }
                  >
                    {selectable ? (
                      <td>
                        <input
                          type="checkbox"
                          className="cb"
                          aria-label={`Select ${id}`}
                          checked={selected.has(id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleOne(id)}
                        />
                      </td>
                    ) : null}
                    {columns.map((c) => (
                      <td key={c.header} className={c.numeric ? 'r num' : ''}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
