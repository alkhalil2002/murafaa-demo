/// Closed vocabulary of common hearing-outcome phrases the wizard's "تقرير
/// العميل" step offers as one-click inserts, so a lawyer isn't typing the same
/// few sentences from scratch every time. Free-text once inserted (not an
/// enforced enum) — mirrors PROC_REQUEST_TYPES's convention in
/// src/server/procedure-requests.ts.
export const HEARING_REPORT_PHRASES = [
  "تم تأجيل الجلسة إلى موعد لاحق",
  "تمت الجلسة دون حضور الطرف الآخر",
  "تم تقديم مذكرة الرد للمحكمة",
  "تم الاستماع لأقوال الطرفين",
  "تقرر ندب خبير في الدعوى",
  "حُجزت القضية للحكم",
  "صدر الحكم لصالح الموكّل",
] as const;
