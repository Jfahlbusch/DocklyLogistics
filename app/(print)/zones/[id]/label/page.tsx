import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { zoneRepo } from "@/lib/db/repos/zone";
import { tenantRepo } from "@/lib/db/repos/tenant";
import { generateBarcode } from "@/lib/barcode/generate";
import { appBaseUrl, zoneWalkUrl } from "@/lib/warehouse/zone-walk-url";
import { PrintActions } from "./print-actions";

export const dynamic = "force-dynamic";

export default async function ZoneLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const zone = await zoneRepo.findById(session.tenant, id);
  if (!zone) notFound();

  const t = await getTranslations("zones.qr");
  const tenant = await tenantRepo.findById(session.tenant);
  const { svg } = await generateBarcode({
    format: "qrcode",
    source: "SKU",
    sku: zoneWalkUrl(appBaseUrl(), zone.id),
  });

  return (
    <>
      {/* A6-Etikett; beim Druck nur dieser Block */}
      <style>{`@page { size: A6; margin: 8mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <PrintActions />
      <main
        aria-label={t("labelAria", { name: zone.name })}
        className="mx-auto flex flex-col items-center justify-between gap-4 p-4 text-center print:p-0"
        style={{ width: "min(100%, 105mm)", minHeight: "min(100dvh, 148mm)" }}
      >
        <h1 className="font-display text-4xl leading-tight font-bold break-words">{zone.name}</h1>
        <div
          role="img"
          aria-label={t("qrAria", { name: zone.name })}
          className="w-full max-w-[80mm] [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="text-xs" style={{ color: "#333" }}>
          {t("caption", { tenant: tenant?.name ?? session.tenant })}
        </p>
      </main>
    </>
  );
}
