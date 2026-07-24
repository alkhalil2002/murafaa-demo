import { escapeHtml } from "@/lib/pdf/letterhead";
import type { TemplateField } from "./template-defs";

/**
 * Pure document-template rendering (docs BR-DOC-*). No DB/IO: given a template's
 * fields + a case's autofillable values, produce (a) the effective field list
 * honoring field-deny, (b) default values, and (c) the escaped HTML body.
 */

export type CaseAutofill = {
  clientName?: string | null;
  opposingParty?: string | null;
  caseType?: string | null;
  city?: string | null;
};

function courtFor(city?: string | null): string {
  return city ? `المحكمة المختصة بمدينة ${city}` : "المحكمة المختصة";
}

/** Autofill value for a field from case data (empty string if none/manual). */
function autofillValue(field: TemplateField, c: CaseAutofill | null): string {
  // `court` has a base value even with no case ("المحكمة المختصة"); resolve it
  // before the no-case short-circuit so a standalone document isn't left blank.
  if (field.autofill === "court") return courtFor(c?.city);
  if (!field.autofill || !c) return field.default ?? "";
  switch (field.autofill) {
    case "clientName":
      return c.clientName ?? "";
    case "opposingParty":
      return c.opposingParty ?? "";
    case "caseType":
      return c.caseType ?? "";
    default:
      return field.default ?? "";
  }
}

/**
 * Effective fields + default values for a template, honoring field-deny.
 * `feesDenied` drops fee-bearing fields (assistant) so they are neither
 * pre-filled nor accepted (docs/04 layer 2).
 */
export function prepareFields(
  fields: TemplateField[],
  caseData: CaseAutofill | null,
  opts: { feesDenied?: boolean } = {},
): { fields: TemplateField[]; values: Record<string, string> } {
  const allowed = fields.filter((f) => !(opts.feesDenied && f.deny === "fees"));
  const values: Record<string, string> = {};
  for (const f of allowed) {
    const v = autofillValue(f, caseData);
    if (v) values[f.id] = v;
    else if (f.default) values[f.id] = f.default;
  }
  return { fields: allowed, values };
}

/**
 * Render the body template into escaped HTML paragraphs. Both literal text and
 * substituted values are HTML-escaped (safe even for office-authored templates).
 * Empty placeholders render as the Arabic ellipsis "……" (BR-DOC-EMPTY-PLACEHOLDER).
 */
export function renderBody(
  bodyTemplate: string,
  values: Record<string, string>,
  officeName: string,
): string {
  return bodyTemplate
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const html = escapeHtml(line).replace(/\{\{(\w+)\}\}/g, (_m, id: string) => {
        if (id === "office") return escapeHtml(officeName);
        const v = (values[id] ?? "").trim();
        return v ? escapeHtml(v) : "……";
      });
      return `<p>${html}</p>`;
    })
    .join("");
}

/**
 * Document date in the Saudi Umm-al-Qura Hijri calendar (BR-DOC-DATE-LOCALE).
 * Frozen onto the document at generation so re-rendering never changes it.
 */
export function formatHijri(date: Date): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
