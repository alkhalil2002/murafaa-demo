import { t } from "@murafaa/i18n";
import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/icons";

export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("app.name")}</h1>
        <div className="tag">{t("app.tagline")}</div>
        <LoginForm />
      </div>
    </div>
  );
}
