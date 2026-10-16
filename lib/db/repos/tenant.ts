import { prisma } from "@/lib/db/client";

/**
 * Mandanten-Stammdaten (nur id + Name). Bewusst mandantenübergreifend — Aufrufer
 * liegen ausschließlich hinter einer GLOBAL_ADMIN-Prüfung (Mandanten-Wechsler:
 * `app/api/v1/me/tenant-view`, Layout für die Auswahlliste).
 */
const SELECT = { id: true, name: true } as const;

export const tenantRepo = {
  findById(id: string) {
    return prisma.tenant.findUnique({ where: { id }, select: SELECT });
  },

  list() {
    return prisma.tenant.findMany({ orderBy: { name: "asc" }, select: SELECT });
  },
};
