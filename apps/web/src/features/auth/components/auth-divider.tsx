import { getServerTranslations } from "@/i18n/server";

export async function AuthDivider() {
  const { t } = await getServerTranslations();

  return (
    <div className="relative py-2">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-xs uppercase text-slate-400">
        <span className="bg-white/90 px-2 backdrop-blur-sm">{t.auth.or}</span>
      </div>
    </div>
  );
}
