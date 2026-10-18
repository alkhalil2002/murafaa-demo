/**
 * Enforcement-procedure picklist (legacy EXEC_PROC_TYPES, prototype): a
 * closed vocabulary stored as text on the procedure.
 */
export const EXEC_PROC_TYPES = [
  "طلب التنفيذ",
  "أمر التنفيذ",
  "تبليغ المنفذ ضده",
  "حجز حسابات بنكية",
  "حجز عقار",
  "حجز مركبات",
  "حجز أسهم",
  "منع سفر",
  "إيقاف خدمات أبشر",
  "الإفصاح عن الأصول",
  "التحصيل/السداد",
  "البيع بالمزاد",
  "إغلاق الملف",
  "أخرى",
] as const;
export type ExecProcType = (typeof EXEC_PROC_TYPES)[number];
