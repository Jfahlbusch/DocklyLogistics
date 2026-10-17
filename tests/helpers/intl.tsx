import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import de from "../../messages/de.json";

/** Provider mit den deutschen Texten, wie ihn das Root-Layout bereitstellt (für Komponenten mit `useTranslations`). */
export function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="de" messages={de}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </NextIntlClientProvider>
  );
}

/** `render` mit deutschem next-intl-Provider (nur in jsdom-Komponententests verwenden). */
export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: IntlWrapper, ...options });
}
