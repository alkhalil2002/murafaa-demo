"use client";

import { useState } from "react";
import { NAJIZ } from "@/lib/najiz";
import { t } from "@/lib/i18n";

const NAJIZ_MAP: Record<string, Record<string, readonly string[]>> = NAJIZ;
const MAIN_CLASSES = Object.keys(NAJIZ_MAP);
const FIRST_MAIN = MAIN_CLASSES[0] ?? "";
const firstSubOf = (main: string) => Object.keys(NAJIZ_MAP[main] ?? {})[0] ?? "";

/**
 * Cascading Najiz classification picker (main ← sub ← case type), matching
 * the prototype's `#mainClass`/`#subClass`/`#caseType` selects. Client-side
 * because each level's options depend on the one above; plain `name`d
 * selects so the values still submit with the surrounding server form.
 */
export function NajizPicker({
  initialMain,
  initialSub,
  initialType,
}: {
  initialMain?: string | null;
  initialSub?: string | null;
  initialType?: string | null;
}) {
  const startMain = initialMain && NAJIZ_MAP[initialMain] ? initialMain : FIRST_MAIN;
  const startSub =
    initialSub && NAJIZ_MAP[startMain]?.[initialSub] ? initialSub : firstSubOf(startMain);
  const [main, setMain] = useState(startMain);
  const [sub, setSub] = useState(startSub);
  const subClasses = Object.keys(NAJIZ_MAP[main] ?? {});
  const types = NAJIZ_MAP[main]?.[sub] ?? [];
  const startType = initialType && types.includes(initialType) ? initialType : types[0];

  return (
    <div className="three">
      <select
        name="najizMainClass"
        value={main}
        onChange={(e) => {
          const next = e.target.value;
          setMain(next);
          setSub(firstSubOf(next));
        }}
      >
        {MAIN_CLASSES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select name="najizSubClass" value={sub} onChange={(e) => setSub(e.target.value)}>
        {subClasses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select name="najizCaseType" defaultValue={startType}>
        {types.map((ct) => (
          <option key={ct} value={ct}>
            {ct}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Standalone label row for the classification field (kept out of the picker
 * itself so the server page can lay out label + hint exactly like the
 * prototype's `.field label`). */
export function NajizFieldLabel() {
  return (
    <label>
      {t("cases.new.classification")} <span className="hint">{t("cases.new.classificationHint")}</span>
    </label>
  );
}
