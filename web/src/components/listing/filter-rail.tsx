"use client";

import { useState } from "react";
import styles from "./listing.module.css";

export type FacetOption = { value: string; label: string; count: number; color?: string; icon?: string };
export type FilterGroup = { key: string; title: string; options: FacetOption[]; selected: string; onSelect: (value: string) => void; allLabel?: string };
export type BudgetRange = { min: string; max: string; bounds: { min: number; max: number }; onChange: (next: { min: string; max: string }) => void };

export type FilterRailProps = {
  search: { value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void };
  groups: FilterGroup[];
  budget?: BudgetRange;
  activeCount: number;
  onReset: () => void;
};

const money = (value: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <div className={styles.railBlock}>
    <button className={styles.railHead} data-open={open} onClick={() => setOpen(!open)} type="button">{title}<i>▾</i></button>
    {open && children}
  </div>;
}

export function FilterRail({ search, groups, budget, activeCount, onReset }: FilterRailProps) {
  return <aside className={styles.rail}>
    <div className={styles.railTop}><strong>FİLTRELER</strong><button className={styles.railReset} disabled={!activeCount} onClick={onReset} type="button">Temizle{activeCount ? ` (${activeCount})` : ""}</button></div>

    <div className={styles.railSearch}>
      <label>⌕<input onChange={(event) => search.onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search.onSubmit(); } }} placeholder={search.placeholder} value={search.value} /></label>
    </div>

    {groups.map((group) => <Block key={group.key} title={group.title}>
      <div className={styles.railBody}>
        <button className={`${styles.railOption} ${!group.selected ? styles.railActive : ""}`} onClick={() => group.onSelect("")} type="button">
          <span>{group.allLabel ?? "Tümü"}</span><b>{group.options.reduce((total, option) => total + option.count, 0)}</b>
        </button>
        {group.options.map((option) => <button className={`${styles.railOption} ${group.selected === option.value ? styles.railActive : ""}`} key={option.value} onClick={() => group.onSelect(option.value)} type="button">
          {option.color && <em style={{ background: option.color }} />}<span>{option.icon ? `${option.icon} ` : ""}{option.label}</span><b>{option.count}</b>
        </button>)}
        {group.options.length === 0 && <p className={styles.railHint}>Seçenek yok</p>}
      </div>
    </Block>)}

    {budget && <Block title="BÜTÇE (₺)">
      <div className={styles.railRange}>
        <input inputMode="numeric" onChange={(event) => budget.onChange({ min: event.target.value, max: budget.max })} placeholder={money(budget.bounds.min)} value={budget.min} />
        <span>—</span>
        <input inputMode="numeric" onChange={(event) => budget.onChange({ min: budget.min, max: event.target.value })} placeholder={money(budget.bounds.max)} value={budget.max} />
      </div>
      <p className={styles.railHint}>{money(budget.bounds.min)} – {money(budget.bounds.max)} ₺ aralığında talep var</p>
    </Block>}
  </aside>;
}
