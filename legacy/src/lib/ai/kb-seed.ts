import { KnowledgeSourceType } from "@prisma/client";

/**
 * A small CLOSED knowledge base for dev/demo — a few Saudi legal sources with
 * article chunks. This is illustrative reference content (paraphrased, not
 * official text); the production KB is a curated, verified corpus. `citationKey`
 * is the canonical name the gate matches parsed citations against. Global
 * (not tenant-scoped), like the Najiz taxonomy.
 */

export type KbSeedSource = {
  citationKey: string;
  title: string;
  type: KnowledgeSourceType;
  officialRef?: string;
  chunks: Array<{ articleNumber?: string; content: string }>;
};

export const KB_SEED: KbSeedSource[] = [
  {
    citationKey: "نظام المعاملات المدنية",
    title: "نظام المعاملات المدنية",
    type: KnowledgeSourceType.STATUTE,
    officialRef: "مرسوم ملكي م/١٩١",
    chunks: [
      { articleNumber: "41", content: "العقد شريعة المتعاقدين، فلا يجوز نقضه ولا تعديله إلا باتفاق الطرفين أو للأسباب التي يقرّرها النظام." },
      { articleNumber: "95", content: "إذا نفّذ أحد المتعاقدين التزامه استحقّ مقابله المتفق عليه ما لم يثبت الطرف الآخر إخلالاً يبرّر الامتناع." },
      { articleNumber: "136", content: "يلتزم من تسبّب بضرر للغير بتعويضه، ويُقدَّر التعويض بقدر الضرر الفعلي المباشر." },
    ],
  },
  {
    citationKey: "نظام العمل",
    title: "نظام العمل",
    type: KnowledgeSourceType.STATUTE,
    officialRef: "مرسوم ملكي م/٥١",
    chunks: [
      { articleNumber: "74", content: "ينتهي عقد العمل بانتهاء مدته أو باتفاق الطرفين أو لبلوغ سن التقاعد، وفق الضوابط المقرّرة." },
      { articleNumber: "77", content: "إذا أُنهي العقد لسبب غير مشروع استحقّ الطرف المتضرّر تعويضاً وفق ما يقرّره النظام." },
    ],
  },
  {
    citationKey: "نظام المرافعات الشرعية",
    title: "نظام المرافعات الشرعية",
    type: KnowledgeSourceType.STATUTE,
    officialRef: "مرسوم ملكي م/١",
    chunks: [
      { articleNumber: "1", content: "البيّنة على من ادّعى واليمين على من أنكر؛ وعلى المدّعي إثبات دعواه بالطرق النظامية." },
    ],
  },
  {
    citationKey: "مبدأ قضائي — إثبات التنفيذ العقدي",
    title: "مبدأ قضائي: من أتمّ التزامه التعاقدي استحقّ مقابله",
    type: KnowledgeSourceType.PRECEDENT,
    chunks: [
      { content: "استقرّ القضاء على أن الثابت كتابةً لا يُنقض إلا بكتابة مثله، وأن إتمام الالتزام يرتّب استحقاق المقابل ما لم يثبت الإخلال." },
    ],
  },
];
