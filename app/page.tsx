import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/i18n";

// The real landing page lives under /[lang]. Send the bare root to the
// default locale (English for dev); the picker there lets users switch.
export default function RootRedirect() {
  redirect(`/${DEFAULT_LOCALE}`);
}
