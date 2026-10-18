import { DocumentTemplateCategory } from "@prisma/client";

/**
 * The 8 seeded system document templates (prototype TEMPLATES + tplFields +
 * tplBody). Templates are DATA (stored in DocumentTemplate); this module is the
 * seed source. Field labels/bodies are Arabic content (not UI-chrome), so they
 * live as data, not i18n keys. Bodies use {{fieldId}} and {{office}} tokens;
 * empty values render as the Arabic ellipsis "……" at render time.
 *
 * `autofill` maps a field to a Case-derived value:
 *   clientName → our client · opposingParty → opponent · caseType → Najiz type
 *   · court → composed "المحكمة المختصة[ بمدينة <city>]".
 * `deny: "fees"` fields are stripped for roles field-denied from fee data
 * (assistant), matching FIELD_DENY.
 */

export type TemplateFieldType = "input" | "textarea" | "select";

export type TemplateField = {
  id: string;
  label: string;
  type: TemplateFieldType;
  options?: string[];
  default?: string;
  autofill?: "clientName" | "opposingParty" | "caseType" | "court";
  deny?: "fees";
};

export type TemplateDef = {
  key: string;
  title: string;
  category: DocumentTemplateCategory;
  fields: TemplateField[];
  bodyTemplate: string;
};

const FEE_TYPES = ["نسبة من المحكوم به", "مبلغ مقطوع", "بالساعة", "أتعاب شهرية (Retainer)"];

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    key: "claim",
    title: "صحيفة دعوى — مطالبة مالية",
    category: DocumentTemplateCategory.CLAIMS,
    fields: [
      { id: "court", label: "المحكمة المختصة", type: "input", autofill: "court" },
      { id: "plaintiff", label: "المدّعي (الموكّل)", type: "input", autofill: "clientName" },
      { id: "defendant", label: "المدّعى عليه (الخصم)", type: "input", autofill: "opposingParty" },
      { id: "subject", label: "موضوع الدعوى", type: "input", autofill: "caseType" },
      { id: "amount", label: "المبلغ المطالب به (ر.س)", type: "input" },
      { id: "facts", label: "الوقائع", type: "textarea" },
      { id: "claims", label: "الطلبات", type: "textarea" },
    ],
    bodyTemplate:
      "إلى فضيلة قاضي {{court}} الموقّر،\n" +
      "المدّعي: {{plaintiff}}، يمثّله مكتب {{office}} بموجب وكالة شرعية.\n" +
      "المدّعى عليه: {{defendant}}.\n" +
      "موضوع الدعوى: {{subject}} بمبلغ {{amount}} ريال.\n" +
      "الوقائع: {{facts}}\n" +
      "الطلبات: {{claims}}\n" +
      "بناءً عليه نلتمس من فضيلتكم الحكم بإلزام المدّعى عليه بما هو مطلوب، وما ترونه محقّقاً للعدالة.",
  },
  {
    key: "reply",
    title: "مذكرة جوابية",
    category: DocumentTemplateCategory.MEMOS,
    fields: [
      { id: "court", label: "المحكمة / الدائرة", type: "input", autofill: "court" },
      { id: "caseNumber", label: "رقم الدعوى", type: "input" },
      { id: "client", label: "المُمثَّل (الموكّل)", type: "input", autofill: "clientName" },
      { id: "opponent", label: "الخصم", type: "input", autofill: "opposingParty" },
      { id: "defenses", label: "الدفوع والردود", type: "textarea" },
    ],
    bodyTemplate:
      "إلى {{court}} — في الدعوى رقم {{caseNumber}}،\n" +
      "نيابةً عن موكّلنا {{client}} في مواجهة {{opponent}}، نتقدّم بهذه المذكرة الجوابية:\n" +
      "الدفوع والردود: {{defenses}}\n" +
      "وعليه نلتمس ردّ دعوى الخصم لعدم قيامها على سند صحيح، وإلزامه بالمصاريف.",
  },
  {
    key: "contract",
    title: "عقد مقاولة",
    category: DocumentTemplateCategory.CONTRACTS,
    fields: [
      { id: "partyOne", label: "الطرف الأول", type: "input", autofill: "clientName" },
      { id: "partyTwo", label: "الطرف الثاني", type: "input", autofill: "opposingParty" },
      { id: "scope", label: "محل العقد / الأعمال", type: "textarea" },
      { id: "value", label: "قيمة العقد (ر.س)", type: "input" },
      { id: "duration", label: "مدة التنفيذ", type: "input" },
    ],
    bodyTemplate:
      "أُبرم هذا العقد بين:\n" +
      "الطرف الأول: {{partyOne}}\n" +
      "الطرف الثاني: {{partyTwo}}\n" +
      "محل العقد: {{scope}}\n" +
      "القيمة: {{value}} ريال · مدة التنفيذ: {{duration}}\n" +
      "يلتزم الطرفان بتنفيذ بنود هذا العقد بحسن نية، ويخضع لأنظمة المملكة العربية السعودية، وتختص محاكمها بأي نزاع ينشأ عنه.",
  },
  {
    key: "poa",
    title: "وكالة خاصة",
    category: DocumentTemplateCategory.POWERS_OF_ATTORNEY,
    fields: [
      { id: "principal", label: "الموكِّل (الاسم/الهوية)", type: "input", autofill: "clientName" },
      {
        id: "scope",
        label: "نطاق الوكالة",
        type: "input",
        default:
          "المرافعة والمدافعة والإقرار والصلح والمطالبة وقبض الحقوق أمام كافة المحاكم والجهات.",
      },
      { id: "subject", label: "موضوع الوكالة", type: "input", autofill: "caseType" },
    ],
    bodyTemplate:
      "أقر أنا {{principal}} بأنني وكّلت مكتب {{office}} ومحاميه وكالةً خاصةً في: {{subject}}.\n" +
      "نطاق الوكالة: {{scope}}\n" +
      "وللوكيل حق الإنابة والتفويض للغير في كل أو بعض ما ذُكر، وهذه الوكالة سارية حتى إنجاز موضوعها أو إلغائها كتابةً.",
  },
  {
    key: "engage",
    title: "خطاب ارتباط واتفاقية أتعاب",
    category: DocumentTemplateCategory.ADMIN,
    fields: [
      { id: "client", label: "العميل", type: "input", autofill: "clientName" },
      { id: "scope", label: "نطاق العمل القانوني", type: "input", autofill: "caseType" },
      { id: "feeType", label: "نوع الأتعاب", type: "select", options: FEE_TYPES, default: FEE_TYPES[0], deny: "fees" },
      { id: "feeValue", label: "قيمة/نسبة الأتعاب", type: "input", deny: "fees" },
    ],
    bodyTemplate:
      "عميلنا الكريم {{client}}،\n" +
      "يسرّ مكتب {{office}} ارتباطه بكم لتقديم الخدمة القانونية التالية:\n" +
      "نطاق العمل: {{scope}}\n" +
      "الأتعاب: {{feeType}} — {{feeValue}}. تُضاف ضريبة القيمة المضافة بحسب النظام، وتُسدّد المصروفات الفعلية على حدة.\n" +
      "بتوقيعكم أدناه تُعدّ هذه الاتفاقية نافذة. شاكرين ثقتكم.",
  },
  {
    key: "settle",
    title: "عرض تسوية ودية",
    category: DocumentTemplateCategory.MEMOS,
    fields: [
      { id: "recipient", label: "إلى (الطرف الآخر)", type: "input", autofill: "opposingParty" },
      { id: "client", label: "عن العميل", type: "input", autofill: "clientName" },
      { id: "amount", label: "مبلغ التسوية المقترح (ر.س)", type: "input" },
      { id: "terms", label: "شروط التسوية", type: "textarea" },
    ],
    bodyTemplate:
      "إلى {{recipient}}،\n" +
      "نيابةً عن موكّلنا {{client}}، وحرصاً على إنهاء النزاع ودّياً، نعرض التسوية الآتية:\n" +
      "المبلغ المقترح: {{amount}} ريال.\n" +
      "الشروط: {{terms}}\n" +
      "هذا العرض ساري المفعول لمدة (١٥) يوماً من تاريخه، ولا يُعدّ إقراراً بأي التزام.",
  },
  {
    key: "exec",
    title: "طلب تنفيذ",
    category: DocumentTemplateCategory.EXECUTION,
    fields: [
      { id: "court", label: "محكمة التنفيذ", type: "input", autofill: "court" },
      { id: "creditor", label: "طالب التنفيذ (الموكّل)", type: "input", autofill: "clientName" },
      { id: "debtor", label: "المنفّذ ضده", type: "input", autofill: "opposingParty" },
      { id: "writNumber", label: "رقم السند التنفيذي/الحكم", type: "input" },
      { id: "amount", label: "المبلغ المطلوب تنفيذه (ر.س)", type: "input" },
    ],
    bodyTemplate:
      "إلى {{court}}،\n" +
      "يتقدّم طالب التنفيذ {{creditor}} ضد المنفّذ ضده {{debtor}}،\n" +
      "بموجب السند التنفيذي رقم {{writNumber}}، طالباً تنفيذ مبلغ {{amount}} ريال وفق نظام التنفيذ.\n" +
      "ونلتمس اتخاذ إجراءات التنفيذ والحجز اللازمة على أموال المنفّذ ضده.",
  },
  {
    key: "warn",
    title: "إنذار / إشعار رسمي",
    category: DocumentTemplateCategory.ADMIN,
    fields: [
      { id: "recipient", label: "إلى (المُنذَر)", type: "input", autofill: "opposingParty" },
      { id: "sender", label: "من (المُنذِر/الموكّل)", type: "input", autofill: "clientName" },
      { id: "subject", label: "موضوع الإنذار", type: "input" },
      { id: "demand", label: "المطلوب", type: "textarea" },
      { id: "deadlineDays", label: "المهلة (أيام)", type: "input", default: "١٥" },
    ],
    bodyTemplate:
      "إنذار رسمي\n" +
      "إلى: {{recipient}}\n" +
      "من: {{sender}}، بوكالة مكتب {{office}}.\n" +
      "الموضوع: {{subject}}\n" +
      "المطلوب: {{demand}}\n" +
      "وعليه نُنذركم بضرورة تنفيذ ما سبق خلال {{deadlineDays}} يوماً من تاريخ تبلّغكم، وإلا اتخذنا الإجراءات النظامية كافة دون أدنى مسؤولية.",
  },
];
