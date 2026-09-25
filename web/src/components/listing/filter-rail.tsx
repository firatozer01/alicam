"use client";

import { useState } from "react";
import styles from "./listing.module.css";

export type FacetOption = { value: string; label: string; count: number; color?: string; icon?: string };
export type FilterGroup = {
  key: string;
  title: string;
  options: FacetOption[];
  /** Tek secimde slug, coklu secimde slug listesi. */
  selected: string | string[];
  /** Coklu secimde ayni deger ikinci kez gelince secimden cikarilir; bos deger temizler. */
  onSelect: (value: string) => void;
  allLabel?: string;
  multiple?: boolean;
};
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

    {groups.map((group) => {
      const picked = Array.isArray(group.selected)
        ? group.selected
        : group.selected ? [group.selected] : [];

      return <Block key={group.key} title={group.title}>
      <div className={styles.railBody}>
        <button className={`${styles.railOption} ${picked.length === 0 ? styles.railActive : ""}`} onClick={() => group.onSelect("")} type="button">
          <span>{group.allLabel ?? "Tümü"}</span><b>{group.options.reduce((total, option) => total + option.count, 0)}</b>
        </button>
        {group.options.map((option) => {
          const on = picked.includes(option.value);
          return <button aria-pressed={on} className={`${styles.railOption} ${on ? styles.railActive : ""}`} key={option.value} onClick={() => group.onSelect(option.value)} type="button">
            {option.color && <em style={{ background: option.color }} />}<span>{option.icon ? `${option.icon} ` : ""}{option.label}</span><b>{group.multiple && on ? "✓" : option.count}</b>
          </button>;
        })}
        {group.options.length === 0 && <p className={styles.railHint}>Seçenek yok</p>}
        {group.multiple && picked.length > 1 && <p className={styles.railHint}>{picked.length} kategori seçili</p>}
      </div>
    </Block>;
    })}

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
