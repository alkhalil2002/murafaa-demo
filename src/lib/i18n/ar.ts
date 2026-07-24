/**
 * Arabic dictionary — the single place UI strings live.
 * Components MUST NOT hardcode Arabic; they call t("some.key").
 * Keys are dot-namespaced by feature. English is added later as a sibling file.
 */
export const ar = {
  "app.name": "مُرافعة",
  "app.tagline": "منصة إدارة مكاتب المحاماة الذكية",

  // ── Auth / login ──
  "auth.login.title": "تسجيل الدخول",
  "auth.login.phoneLabel": "رقم الجوال",
  "auth.login.phonePlaceholder": "5XXXXXXXX",
  "auth.login.sendOtp": "إرسال رمز التحقق",
  "auth.login.otpLabel": "رمز التحقق",
  "auth.login.otpPlaceholder": "٦ أرقام",
  "auth.login.verify": "دخول",
  "auth.login.resend": "إعادة الإرسال",
  "auth.login.sentTo": "أُرسل رمز التحقق إلى",
  "auth.otp.sent": "تم إرسال رمز التحقق",
  "auth.otp.invalid": "رمز التحقق غير صحيح",
  "auth.otp.expired": "انتهت صلاحية الرمز، أعد الإرسال",
  "auth.otp.tooManyAttempts": "محاولات كثيرة، أعد الإرسال بعد قليل",
  "auth.otp.rateLimited": "الرجاء الانتظار قبل طلب رمز جديد",
  "auth.error.phoneInvalid": "رقم الجوال غير صالح",
  "auth.error.userNotFound": "لا يوجد حساب مرتبط بهذا الرقم",
  "auth.error.generic": "تعذّر إتمام العملية، حاول مجدداً",
  "auth.signout": "تسجيل الخروج",

  // ── Roles (docs/04) ──
  "role.partner": "شريك",
  "role.lawyer": "محامي",
  "role.assistant": "مساعد",
  "role.accountant": "محاسب",
  "role.admin": "إداري",
  "role.reception": "موظف استقبال",

  // ── Modules (docs/04) ──
  "module.cases": "القضايا",
  "module.ai": "المحاكمة الذكية",
  "module.clients": "العملاء",
  "module.documents": "المستندات",
  "module.finance": "المالية",
  "module.hr": "الموارد البشرية",
  "module.reports": "التقارير",
  "module.permissions": "الصلاحيات",
  "module.whatsapp": "واتساب",
  "module.appointments": "المواعيد",
  "module.tasks": "المهام",
  "module.alerts": "التنبيهات",
  "module.pulse": "نبض الفريق",

  // ── Permission errors (server-enforced) ──
  "perm.denied.module": "لا تملك صلاحية الوصول لهذه الوحدة",
  "perm.denied.field": "لا تملك صلاحية الاطّلاع على هذا الحقل",
  "perm.denied.scope": "هذه القضية خارج نطاق صلاحياتك",
  "perm.denied.generic": "غير مصرّح",

  // ── Generic ──
  "common.dashboard": "لوحة المعلومات",
  "common.today": "اليوم",
  "common.loading": "جارٍ التحميل…",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.welcome": "أهلاً",
} as const;

export type MessageKey = keyof typeof ar;
