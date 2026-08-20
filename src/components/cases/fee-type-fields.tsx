"use client";

import { useState } from "react";

/**
 * Fee-agreement value fields, shown/hidden by the selected fee type
 * (prototype `fa_awardedWrap` onchange toggle). FLAT/RETAINER need only the
 * flat value; HOURLY is billed per time-entry rate so needs no value here;
 * PERCENTAGE needs the percentage and the awarded amount it applies to.
 * Field names are unchanged so the server action's FormData parsing still
 * works — this only controls which inputs render, not what they're called.
 */
export function FeeTypeFields({
  feeTypeOptions,
  defaultType,
  defaultFeeValue,
  defaultPercentage,
  defaultAwarded,
  labels,
}: {
  feeTypeOptions: Array<{ value: string; label: string }>;
  defaultType: string;
  defaultFeeValue: number | "";
  defaultPercentage: number | "";
  defaultAwarded: number | "";
  labels: {
    feeType: string;
    feeValue: string;
    percentage: string;
    awarded: string;
  };
}) {
  const [type, setType] = useState(defaultType);
  const isPercentage = type === "PERCENTAGE";
  const isHourly = type === "HOURLY";

  return (
    <div className="two">
      <div className="field">
        <label>{labels.feeType}</label>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {feeTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {!isPercentage && !isHourly && (
        <div className="field">
          <label>{labels.feeValue}</label>
          <input type="number" name="feeValue" min="0" step="0.01" defaultValue={defaultFeeValue} />
        </div>
      )}
      {isPercentage && (
        <>
          <div className="field">
            <label>{labels.percentage}</label>
            <input type="number" name="percentage" min="0" max="100" step="0.01" defaultValue={defaultPercentage} />
          </div>
          <div className="field">
            <label>{labels.awarded}</label>
            <input type="number" name="awarded" min="0" step="0.01" defaultValue={defaultAwarded} />
          </div>
        </>
      )}
    </div>
  );
}
