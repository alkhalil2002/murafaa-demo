# التطوير المحلي (Local Development)

> البنية والقرارات في `docs/02` و`docs/adr/0001-monorepo-nestjs-drizzle.md`. التطبيق القديم (Next.js + Prisma) محفوظ في `legacy/` كمرجع فقط.

## المتطلبات
- **Node 24** عبر nvm. المستودع فيه `.nvmrc`، فاكتب `nvm use` داخل المجلد.
- **pnpm 12.14.0:**
  ```bash
  corepack enable && corepack prepare pnpm@12.14.0 --activate
  ```
- **Docker** لتشغيل Postgres 17 مع pgvector على المنفذ **5440**.

## الإعداد لأول مرة
```bash
nvm use
pnpm install

# قاعدة البيانات: تُنشئ murafaa_dev و murafaa_test، والدورين murafaa_app و murafaa_api
pnpm db:up

# الهجرات (تعمل بصلاحية مالك الجداول، لا بدور التطبيق)
MIGRATION_DATABASE_URL=postgres://murafaa:murafaa@localhost:5440/murafaa_dev pnpm db:migrate

# المتغيّرات (لا تلتزم .env أبداً)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# بيانات تجريبية: مكتب + 6 مستخدمين بالأدوار
MIGRATION_DATABASE_URL=postgres://murafaa:murafaa@localhost:5440/murafaa_dev pnpm db:seed
```

## تسجيل الدخول (بيئة التطوير)
`OTP_PROVIDER=console`: الرمز لا يُرسل لأي جهة، ويظهر تلقائياً في خانة الرمز في صفحة الدخول، ويُطبع في سجل الـ API.

| الدور | الجوال |
|---|---|
| شريك | `0500000001` |
| محامي | `0500000002` |
| مساعد | `0500000003` |
| محاسب | `0500000004` |
| إداري | `0500000005` |
| موظف استقبال | `0500000006` |

- لا يمكن طلب رمز جديد لنفس الرقم قبل مرور 30 ثانية.
- الرمز صالح 5 دقائق، و5 محاولات خاطئة تقفله.
- الجلسة تنتهي بعد 20 دقيقة خمول.


## الأوامر
```bash
pnpm dev            # الـ API على :4000 والموقع على :3000
pnpm build          # بناء كل الحزم والتطبيقات
pnpm lint           # ESLint، ويرفض أي نص عربي مكتوب مباشرة في الواجهة
pnpm typecheck
pnpm test           # اختبارات الوحدة: قواعد العمل والصلاحيات وبوابة الاستشهاد والـ API
pnpm test:e2e       # عزل المكاتب على Postgres حقيقي (RLS) + مسار HTTP كامل
pnpm sdk:generate   # بعد أي تغيير في عقود الـ API: يعيد توليد openapi.json والـ SDK
```

- توثيق الـ API: `http://localhost:4000/api/docs` (خارج الإنتاج فقط).
- فحص الصحة: `curl localhost:4000/api/v1/health`.

## قواعد مهمة
- **الاتصال بقاعدة البيانات:** الـ API يتصل بالمستخدم `murafaa_api`، ولا يملك أي جدول، فـ RLS تُطبَّق عليه دائماً. الهجرات فقط تستخدم المالك `murafaa`.
- **أي استعلام لبيانات مكتب** يمر عبر `TenantDb.run()` في الـ API، أو `withTenant()` في الحزمة. لو لم يُحدَّد مكتب، لا تُرجَع أي صفوف.
- **أي جدول جديد** يحتاج `tenantPolicy()` و`.enableRLS()`، وسطر `FORCE ROW LEVEL SECURITY` وصلاحيات في migration مخصّصة. اختبار `rls.e2e` يفشل لو نسيت.
- **أي route جديد** يحتاج `@Public()` أو `@Authenticated()` أو `@RequirePermission(module, action)`. بدونها يُرفض الطلب.
- **الـ SDK** في `packages/sdk/src/gen` مولَّد آلياً، فلا تعدّله يدوياً.
