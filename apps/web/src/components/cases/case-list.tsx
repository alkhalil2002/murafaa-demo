"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { t } from "@murafaa/i18n";
import { ConflictBadge } from "./conflict-badge";

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
  conflictSeverity: "HIGH" | "MEDIUM" | null;
};

/**
 * Case cards with live search and filters (legacy case-list). The list is
 * already row-scoped by the API; filtering only narrows it.
 */
export function CaseList({ cases }: { cases: CaseListItem[] }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"" | "active" | "done">("");

  const cities = useMemo(
    () => [...new Set(cases.map((c) => c.city).filter((v): v is string => !!v))].sort(),
    [cases],
  );
  const categories = useMemo(
    () => [...new Set(cases.map((c) => c.category).filter((v): v is string => !!v))].sort(),
    [cases],
  );

  const filtered = cases.filter((c) => {
    if (status === "active" && c.isDone) return false;
    if (status === "done" && !c.isDone) return false;
    if (city && c.city !== city) return false;
    if (category && c.category !== category) return false;
    const needle = q.trim();
    return (
      !needle ||
      `${c.title} ${c.opposingParty ?? ""} ${c.clientName ?? ""} ${c.number}`.includes(needle)
    );
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
                <ConflictBadge severity={c.conflictSeverity} />
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
