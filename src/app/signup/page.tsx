import { SignupForm } from "@/components/auth/signup-form";
import { BrandMark } from "@/components/icons";
import { t } from "@/lib/i18n";

/** Public self-serve registration. Starts a 7-day trial, no card required. */
export default function SignupPage() {
  return (
    <div className="login-shell">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("app.name")}</h1>
        <div className="tag">{t("signup.tagline")}</div>
        <SignupForm />
      </div>
    </div>
  );
}
