import { prisma } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/append";

export type TenantViewActor = { id: string; email: string };

type Meta = { ip?: string; userAgent?: string };

/**
 * Audit der Mandanten-Ansicht eines GLOBAL_ADMIN. Der Eintrag landet im
 * betrachteten (Ziel-)Mandanten — dort muss nachvollziehbar sein, dass und wann
 * ein Plattform-Admin hineingeschaut hat; nicht im eigenen Mandanten des Admins.
 */
export const tenantViewService = {
  recordStarted(tenantId: string, actor: TenantViewActor, meta: Meta = {}) {
    return prisma.$transaction((tx) =>
      appendAudit(tx, {
        tenantId,
        entity: "AdminTenantView",
        entityId: tenantId,
        action: "UPDATE",
        actorId: actor.id,
        actorEmail: actor.email,
        ...meta,
        after: { viewingAs: tenantId },
      }),
    );
  },

  recordEnded(tenantId: string, actor: TenantViewActor, meta: Meta = {}) {
    return prisma.$transaction((tx) =>
      appendAudit(tx, {
        tenantId,
        entity: "AdminTenantView",
        entityId: tenantId,
        action: "DELETE",
        actorId: actor.id,
        actorEmail: actor.email,
        ...meta,
        before: { viewingAs: tenantId },
      }),
    );
  },
};
