"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";

export type CaseListItem = {
  id: string;
  number: string;
  title: string;
  clientName: string | null;
  opposingParty: string | null;
  city: string | null;
  category: string | null;
  stageLabel: string;
  statusLabel: string;
  isDone: boolean;
  conflictBadge: React.ReactNode;
};

/**
 * Case card grid with live client-side search/filters, reproducing the
 * prototype's `.filters` + `.clist`/`.ccard` behaviour (search-as-you-type,
 * no round trip). The full case list is already row-scoped server-side —
 * this only ever narrows what's already visible, never widens it.
 */
export function CaseList({ cases }: { cases: CaseListItem[] }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"" | "active" | "done">("");

  const cities = useMemo(
    () => Array.from(new Set(cases.map((c) => c.city).filter((v): v is string => !!v))).sort(),
    [cases],
  );
  const categories = useMemo(
    () => Array.from(new Set(cases.map((c) => c.category).filter((v): v is string => !!v))).sort(),
    [cases],
  );

  const filtered = cases.filter((c) => {
    if (status === "active" && c.isDone) return false;
    if (status === "done" && !c.isDone) return false;
    if (city && c.city !== city) return false;
    if (category && c.category !== category) return false;
    if (q) {
      const needle = q.trim();
      const hay = `${c.title} ${c.opposingParty ?? ""} ${c.clientName ?? ""} ${c.number}`;
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return (
    <>
      <div className="filters">
        <input
          className="search"
          type="text"
          placeholder={t("cases.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">{t("cases.filterCity")}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("cases.filterCategory")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">{t("cases.filterStatus")}</option>
          <option value="active">{t("cases.filterStatusActive")}</option>
          <option value="done">{t("cases.filterStatusDone")}</option>
        </select>
      </div>
      <div className="clist">
        {filtered.length === 0 ? (
          <div className="empty-list">{t("cases.noMatches")}</div>
        ) : (
          filtered.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className={`ccard${c.isDone ? " done" : ""}`}>
              <h3>{c.title}</h3>
              <div className="chips">
                <span className="chip">{c.number}</span>
                {c.city && <span className="chip">{c.city}</span>}
                <span className={`chip st${c.isDone ? " done" : ""}`}>{c.statusLabel}</span>
                <span className="chip">{c.stageLabel}</span>
                {c.conflictBadge}
              </div>
              <div className="meta">
                {c.clientName ? `${c.clientName} · ` : ""}
                {c.opposingParty ?? ""}
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
