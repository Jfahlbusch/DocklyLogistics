import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";
import { EdiView } from "./edi-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ direction?: string; status?: string; page?: string }>;

export default async function EdiPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");
  const sp = await searchParams;

  const direction = sp.direction === "IN" || sp.direction === "OUT" ? sp.direction : undefined;
  const { rows, total, page, pageSize } = await ediMessageRepo.list(session.tenant, {
    direction,
    status: sp.status || undefined,
    page: Math.max(1, Number(sp.page ?? 1)),
    pageSize: 50,
  });

  return (
    <EdiView
      rows={rows.map((r) => ({
        id: r.id,
        direction: r.direction as "IN" | "OUT",
        type: r.type,
        status: r.status,
        transport: r.transport,
        supplierName: r.supplierName,
        documentNo: r.documentNo,
        interchangeRef: r.interchangeRef,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      }))}
      total={total}
      page={page}
      pageSize={pageSize}
      filters={{ direction: sp.direction ?? "", status: sp.status ?? "" }}
      canManage={session.role === "MANAGER" || session.role === "GLOBAL_ADMIN"}
    />
  );
}
