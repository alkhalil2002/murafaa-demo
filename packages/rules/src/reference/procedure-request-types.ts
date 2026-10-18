/**
 * Procedural request types (legacy PROC_REQUEST_TYPES, prototype
 * PROC_REQ_TYPES): a closed vocabulary stored as text on the request.
 */
export const PROC_REQUEST_TYPES = [
  "طلب ندب خبير",
  "طلب إدخال طرف (ضامن/خصم)",
  "طلب وقف سير الدعوى",
  "التماس إعادة النظر",
  "طلب تأجيل الجلسة",
  "دفع بعدم الاختصاص",
  "طلب ضمّ قضية",
  "طلب سماع شهود",
  "طلب تمكين من مستندات",
  "اعتراض / استئناف",
  "طلب آخر",
] as const;
export type ProcRequestType = (typeof PROC_REQUEST_TYPES)[number];
