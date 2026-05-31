import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getDictionary } from "./index";
export { formatMessage } from "./messages";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getServerTranslations() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
