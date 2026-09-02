"use client";

import styles from "./listing.module.css";

export type SortOption = { value: string; label: string };
export type ActiveChip = { key: string; label: string; onClear: () => void };

export function ResultBar({ total, noun = "talep", sort, sortOptions, onSort, children }: {
  total: number; noun?: string; sort: string; sortOptions: SortOption[]; onSort: (value: string) => void; children?: React.ReactNode;
}) {
  return <div className={styles.resultBar}>
    <p className={styles.resultCount}><b>{total.toLocaleString("tr-TR")}</b> {noun} bulundu</p>
    <div className={styles.resultTools}>{children}<label>Sırala<select onChange={(event) => onSort(event.target.value)} value={sort}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
  </div>;
}

export function ActiveChips({ chips }: { chips: ActiveChip[] }) {
  if (!chips.length) return null;
  return <div className={styles.chips}>{chips.map((chip) => <span className={styles.chip} key={chip.key}>{chip.label}<button aria-label={`${chip.label} filtresini kaldır`} onClick={chip.onClear} type="button">✕</button></span>)}</div>;
}

export function Pagination({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (next: number) => void }) {
  if (lastPage <= 1) return null;
  return <nav className={styles.pagination}>
    <button disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">← Önceki</button>
    <span><b>{page}</b> / {lastPage}</span>
    <button disabled={page >= lastPage} onClick={() => onPage(page + 1)} type="button">Sonraki →</button>
  </nav>;
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return <div className={styles.table}>{Array.from({ length: rows }, (_, index) => <div className={styles.skeleton} key={index}><i /><i /></div>)}</div>;
}

/** Sütun başlığı; `sortKeys` verilirse tıklandıkça bu değerler arasında döner. */
export type Column = { label: string; align?: "num" | "mid"; sortKeys?: string[]; cls?: string };

export function TableHead({ columns, sort, onSort }: { columns: Column[]; sort: string; onSort: (value: string) => void }) {
  return <div className={styles.thead}>{columns.map((column) => {
    if (!column.sortKeys?.length) return <span className={`${styles.th} ${column.cls ?? ""} ${column.align === "num" ? styles.thNum : ""} ${column.align === "mid" ? styles.thMid : ""}`} key={column.label}>{column.label}</span>;
    const index = column.sortKeys.indexOf(sort);
    const active = index >= 0;
    return <button
      className={`${styles.th} ${styles.thSort} ${column.cls ?? ""} ${active ? styles.thActive : ""} ${column.align === "num" ? styles.thNum : ""} ${column.align === "mid" ? styles.thMid : ""}`}
      key={column.label}
      onClick={() => onSort(column.sortKeys![(index + 1) % column.sortKeys!.length])}
      type="button"
    >{column.label}<i>{active ? (index === 0 ? "▼" : "▲") : "▾"}</i></button>;
  })}</div>;
}
