import { healthCheck } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Reads live API status on every request, never at build time.
export const dynamic = "force-dynamic";

async function apiIsUp(): Promise<boolean> {
  try {
    const { data } = await healthCheck({ client: api, signal: AbortSignal.timeout(2000) });
    return data?.data.status === "ok";
  } catch {
    return false;
  }
}

export default async function Home() {
  const up = await apiIsUp();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
      <header className="space-y-1">
        <h1 className="text-4xl text-bench">{t("app.name")}</h1>
        <p className="text-ink-soft">{t("app.tagline")}</p>
      </header>
      <section className="rounded-xl border border-line bg-white/60 p-5">
        <h2 className="mb-3 text-xl text-bench">{t("health.title")}</h2>
        <div className="flex items-center justify-between">
          <span>{t("health.api")}</span>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm text-white",
              up ? "bg-ok" : "bg-advocate",
            )}
          >
            {up ? t("health.ok") : t("health.down")}
          </span>
        </div>
      </section>
    </main>
  );
}
