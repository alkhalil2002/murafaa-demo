import { LoginForm } from "@/components/auth/login-form";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-bench to-bench-2 p-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 shadow-2xl">
        <h1 className="text-center font-serif text-3xl text-bench">{t("app.name")}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-ink-soft">{t("app.tagline")}</p>
        <LoginForm />
      </div>
    </main>
  );
}
