import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProgress, mayRunOnboarding, ONBOARDING_STEPS, LAST_STEP_INDEX } from "@/server/onboarding";
import { getTerms } from "@/server/terms";
import { defaultTerms, GLOSSARY } from "@/lib/i18n/glossary";
import { TermsStep } from "@/components/onboarding/terms-step";
import { IdentityStep } from "@/components/onboarding/identity-step";
import { TeamStep } from "@/components/onboarding/team-step";
import { StepNav } from "@/components/onboarding/step-nav";
import { t, type MessageKey } from "@/lib/i18n";
import { SealMark } from "@/components/v2/marks";

export const dynamic = "force-dynamic";

/** Modules introduced on the first screen — this is the "show me what's here" step. */
const TOUR: Array<{ key: MessageKey; desc: MessageKey }> = [
  { key: "module.cases", desc: "onboarding.terms.hint.case" },
  { key: "module.clients", desc: "onboarding.terms.hint.client" },
  { key: "nav.leads", desc: "onboarding.terms.hint.lead" },
  { key: "module.documents", desc: "onboarding.terms.hint.document" },
  { key: "module.finance", desc: "onboarding.terms.hint.invoice" },
  { key: "module.hr", desc: "onboarding.terms.hint.employee" },
  { key: "module.tasks", desc: "onboarding.terms.hint.task" },
  { key: "module.appointments", desc: "onboarding.terms.hint.appointment" },
  { key: "module.reports", desc: "onboarding.terms.hint.report" },
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // An office is configured by its partner. Anyone else who lands here goes to
  // the app rather than being walked through branding they cannot change.
  if (!mayRunOnboarding(session)) redirect("/today");

  const progress = await getProgress(session);
  const params = await searchParams;

  // The URL drives which screen shows, so Back works and a step is linkable.
  // It is clamped to what the office has actually reached: a hand-typed
  // ?step=4 must not skip setup that was never done.
  const requested = Number.parseInt(params.step ?? "", 10);
  const index = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 0), Math.min(progress.step + 1, LAST_STEP_INDEX))
    : progress.step;
  const step = ONBOARDING_STEPS[index] ?? "intro";

  const [terms] = await Promise.all([getTerms(session.officeId)]);
  const defaults = defaultTerms();

  return (
    <main className="ob">
      <header className="ob-head">
        <SealMark />
        <h1>{t("onboarding.title")}</h1>
        <p>{t("onboarding.subtitle")}</p>
        <div className="ob-progress" role="status">
          {t("onboarding.stepOf", { n: index + 1, total: ONBOARDING_STEPS.length })}
          <div className="ob-bar">
            <span style={{ width: `${((index + 1) / ONBOARDING_STEPS.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <section className="ob-body">
        {step === "intro" && (
          <>
            <h2>{t("onboarding.step.intro")}</h2>
            <div className="ob-tour">
              {TOUR.map((m) => (
                <div className="ob-tour-card" key={m.key}>
                  <div className="ob-tour-name">{t(m.key)}</div>
                  <div className="ob-tour-desc">{t(m.desc)}</div>
                </div>
              ))}
            </div>
            <StepNav next={1} />
          </>
        )}

        {step === "identity" && (
          <>
            <h2>{t("onboarding.step.identity")}</h2>
            <IdentityStep officeName={progress.officeName} />
          </>
        )}

        {step === "terms" && (
          <>
            <h2>{t("onboarding.terms.title")}</h2>
            <p className="ob-lead">{t("onboarding.terms.intro")}</p>
            <TermsStep initial={terms} defaults={defaults} />
          </>
        )}

        {step === "team" && (
          <>
            <h2>{t("onboarding.step.team")}</h2>
            <TeamStep teamCount={progress.teamCount} />
          </>
        )}

        {step === "done" && (
          <>
            <h2>{t("onboarding.step.done")}</h2>
            <p className="ob-lead">{t("onboarding.subtitle")}</p>
            <ul className="ob-summary">
              <li>
                {t("onboarding.step.identity")}: <strong>{progress.officeName}</strong>
              </li>
              <li>
                {t("onboarding.step.terms")}:{" "}
                <strong>
                  {GLOSSARY.filter((d) => terms[d.id] !== defaults[d.id]).length}
                </strong>
              </li>
              <li>
                {t("onboarding.step.team")}: <strong>{progress.teamCount}</strong>
              </li>
            </ul>
            <StepNav finish />
          </>
        )}
      </section>
    </main>
  );
}
