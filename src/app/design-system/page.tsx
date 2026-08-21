import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  ErrorAlert,
  Field,
  FrameCorners,
  GoldRule,
  Input,
  Label,
  ScaleMark,
  SealMark,
  Textarea,
  type BadgeTone,
} from "@/components/ui";
import { InteractiveDemos } from "./interactive";

/**
 * Design-system showcase — a DEVELOPER surface, not a product screen.
 *
 * Labels here are component and token names, which are English identifiers by
 * the same convention as the rest of the code. The sample *content* inside the
 * components is Arabic, so RTL behaviour is visible at a glance.
 *
 * Every colour on this page comes from a token: there is not one hardcoded hex
 * below, which is the property the page exists to demonstrate.
 */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-5">
        <GoldRule size="md" />
        <h2 className="mt-3 font-display text-2xl font-bold text-ink">{title}</h2>
        {hint ? <p className="mt-1 max-w-prose text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-14 rounded-md border border-line ${className}`} />
      <code className="text-xs text-ink-soft">{name}</code>
    </div>
  );
}

const BADGE_TONES: BadgeTone[] = [
  "default",
  "active",
  "suspended",
  "closed",
  "won",
  "partial",
  "settled",
  "lost",
  "critical",
  "serious",
  "warning",
  "good",
  "gold",
  "bench",
];

export default async function DesignSystemPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-14">
        <div className="mb-3 flex items-center gap-3 text-gold">
          <SealMark size={44} />
        </div>
        <h1 className="font-display text-4xl font-bold text-ink">Murafaa Design System</h1>
        <p className="mt-2 max-w-prose leading-normal text-ink-soft">
          Tokens from <code>src/design/</code>, components from <code>src/components/ui/</code>.
          Same architecture as Alkhalil EMS, with Murafaa&apos;s own palette.
        </p>
      </header>

      <Section
        title="Palette"
        hint="Brand, surface and state. Each swatch is a Tailwind utility resolving to a CSS variable — swap the variable and every component follows."
      >
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          <Swatch name="bg-bench" className="bg-bench" />
          <Swatch name="bg-bench-2" className="bg-bench-2" />
          <Swatch name="bg-gold" className="bg-gold" />
          <Swatch name="bg-gold-soft" className="bg-gold-soft" />
          <Swatch name="bg-advocate" className="bg-advocate" />
          <Swatch name="bg-advocate-2" className="bg-advocate-2" />
        </div>

        <p className="mb-3 text-sm font-medium text-ink">
          Parchment ramp{" "}
          <span className="text-ink-soft">(new — the app had no neutral scale)</span>
        </p>
        <div className="mb-8 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-11">
          <Swatch name="50" className="bg-parch-50" />
          <Swatch name="100" className="bg-parch-100" />
          <Swatch name="200" className="bg-parch-200" />
          <Swatch name="300" className="bg-parch-300" />
          <Swatch name="400" className="bg-parch-400" />
          <Swatch name="500" className="bg-parch-500" />
          <Swatch name="600" className="bg-parch-600" />
          <Swatch name="700" className="bg-parch-700" />
          <Swatch name="800" className="bg-parch-800" />
          <Swatch name="900" className="bg-parch-900" />
          <Swatch name="950" className="bg-parch-950" />
        </div>

        <p className="mb-3 text-sm font-medium text-ink">
          Alpha modifiers{" "}
          <span className="text-ink-soft">(these emitted no CSS at all before the token fix)</span>
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          <Swatch name="bg-ok/10" className="bg-ok/10" />
          <Swatch name="bg-ok/20" className="bg-ok/20" />
          <Swatch name="bg-advocate/10" className="bg-advocate/10" />
          <Swatch name="bg-advocate/20" className="bg-advocate/20" />
          <Swatch name="bg-gold/20" className="bg-gold/20" />
          <Swatch name="bg-bench/10" className="bg-bench/10" />
        </div>
      </Section>

      <Section title="Typography" hint="IBM Plex Sans Arabic for UI, Amiri for display.">
        <div className="flex flex-col gap-3">
          <p className="font-display text-4xl font-bold text-ink">مُرافعة — عنوان رئيسي</p>
          <p className="font-display text-2xl font-semibold text-ink">عنوان قسم</p>
          <p className="text-base text-ink">
            نص المتن بخط IBM Plex Sans Arabic، بارتفاع سطر ١٫٧ المناسب للعربية.
          </p>
          <p className="text-sm text-ink-soft">نص ثانوي — ملاحظات وتلميحات.</p>
        </div>
      </Section>

      <Section title="Button" hint="Seven variants, four sizes, loading and disabled states.">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button>primary</Button>
          <Button variant="gold">gold</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="outline">outline</Button>
          <Button variant="danger">danger</Button>
          <Button variant="ghost">ghost</Button>
          <Button variant="link">link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">sm</Button>
          <Button size="md">md</Button>
          <Button size="lg">lg</Button>
          <Button loading>loading</Button>
          <Button disabled>disabled</Button>
        </div>
      </Section>

      <Section
        title="Badge"
        hint="Tones are named after domain state (CaseStatus, CaseOutcome, urgency) — never after a colour."
      >
        <div className="flex flex-wrap gap-2.5">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} variant={tone}>
              {tone}
            </Badge>
          ))}
          <Badge variant="active" withDot={false}>
            withDot=false
          </Badge>
        </div>
      </Section>

      <Section
        title="Card"
        hint="The gold rule on the top edge is Murafaa's signature — the role Alkhalil's skewed red slash plays."
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>قضية تجارية</CardTitle>
              <Badge variant="active">جارية</Badge>
            </CardHeader>
            <CardBody>مطالبة مالية أمام المحكمة التجارية بالرياض.</CardBody>
            <CardFooter>
              <span className="text-xs text-ink-soft">آخر تحديث: أمس</span>
              <Button size="sm" variant="link">
                فتح
              </Button>
            </CardFooter>
          </Card>
          <Card hoverable>
            <CardHeader>
              <CardTitle>hoverable</CardTitle>
            </CardHeader>
            <CardBody>مرّر المؤشر: ترتفع البطاقة ويتحوّل إطارها إلى الذهبي.</CardBody>
          </Card>
          <Card withRule={false}>
            <CardHeader>
              <CardTitle>withRule=false</CardTitle>
            </CardHeader>
            <CardBody>بدون الخط الذهبي العلوي.</CardBody>
          </Card>
        </div>
      </Section>

      <Section title="Form" hint="Input, Textarea, Label, Field (with hint and error), Checkbox.">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Field hint="مثال: ١٤٤٦/١٢٣٤">
              <Label required>رقم القضية</Label>
              <Input placeholder="أدخل رقم القضية" />
            </Field>
            <Field error="هذا الحقل مطلوب">
              <Label required>اسم الموكّل</Label>
              <Input error placeholder="أدخل الاسم" />
            </Field>
            <Field>
              <Label>حقل معطّل</Label>
              <Input disabled placeholder="غير متاح" />
            </Field>
          </div>
          <div>
            <Field>
              <Label>ملخص الوقائع</Label>
              <Textarea placeholder="اكتب ملخصاً موجزاً…" />
            </Field>
            <div className="flex flex-col gap-3">
              <Checkbox label="إشعار عند تحديث القضية" defaultChecked />
              <Checkbox label="إرسال نسخة للموكّل" />
              <Checkbox label="خيار معطّل" disabled />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Marks"
        hint="Murafaa signs surfaces with document furniture rather than an architect's slash."
      >
        <div className="flex flex-wrap items-center gap-10">
          <div className="flex flex-col items-center gap-2 text-gold">
            <SealMark size={52} />
            <code className="text-xs text-ink-soft">SealMark</code>
          </div>
          <div className="flex flex-col items-center gap-2 text-bench">
            <ScaleMark size={40} />
            <code className="text-xs text-ink-soft">ScaleMark</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col gap-2">
              <GoldRule size="sm" />
              <GoldRule size="md" />
              <GoldRule size="lg" />
            </div>
            <code className="text-xs text-ink-soft">GoldRule</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <FrameCorners size={28} className="px-8 py-6">
              <p className="font-display text-lg text-ink">اقتباس من مذكرة</p>
            </FrameCorners>
            <code className="text-xs text-ink-soft">FrameCorners (RTL-aware)</code>
          </div>
        </div>
      </Section>

      <Section
        title="States"
        hint="EmptyState and ErrorAlert — both new. Copy is passed in already translated, never hardcoded inside the component."
      >
        <div className="flex flex-col gap-6">
          <EmptyState
            title="لا توجد قضايا بعد"
            description="ابدأ بإضافة أول قضية لعرضها هنا."
            action={<Button size="sm">إضافة قضية</Button>}
          />
          <ErrorAlert
            title="تعذّر الاتصال بناجز"
            message="انتهت مهلة الطلب. حاول مرة أخرى بعد قليل."
            action={
              <Button size="sm" variant="outline">
                إعادة المحاولة
              </Button>
            }
          />
        </div>
      </Section>

      <Section
        title="Interactive"
        hint="Toast (aria-live polite, auto-dismiss) and ConfirmDialog (native dialog element: real focus trap, Escape to close)."
      >
        <InteractiveDemos />
      </Section>
    </main>
  );
}
