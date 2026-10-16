import { z } from "zod";
import { registry } from "@/lib/api/openapi";

// Einzige Quelle für Antwort und Dokumentation: Die Routen parsen ihre Antwort mit
// diesen Schemas, die OpenAPI-Registrierung unten verwendet dieselben Objekte —
// die Doku kann dadurch nicht von der Antwort abweichen.

export const NotificationSchema = z
  .object({
    id: z.string(),
    type: z.string().openapi({ example: "import" }),
    title: z.string(),
    body: z.string().nullable(),
    link: z.string().nullable().openapi({ description: "Interner, app-relativer Pfad" }),
    readAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ description: "Lesezeitpunkt des anfragenden Nutzers; null = ungelesen" }),
    createdAt: z.string().datetime(),
  })
  .openapi("Notification");

export const NotificationListSchema = z
  .object({
    items: z.array(NotificationSchema),
    unread: z.number().int().min(0).openapi({ description: "Ungelesene Meldungen des anfragenden Nutzers" }),
  })
  .openapi("NotificationList");

/** Body von POST /me/notifications/read — ohne `id` werden alle quittiert. Kein Mandant im Body. */
export const NotificationReadSchema = z
  .object({ id: z.string().trim().min(1).max(64).optional() })
  .openapi("NotificationRead");

export const NotificationReadResultSchema = z.object({ ok: z.literal(true) }).openapi("NotificationReadResult");

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function toNotificationDto(n: NotificationRow): z.infer<typeof NotificationSchema> {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

const jsonOf = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

registry.registerPath({
  method: "get",
  path: "/me/notifications",
  summary: "Benachrichtigungen des Mandanten (20 neueste) + Anzahl ungelesen",
  description:
    "Die Meldungen gelten mandantenweit, der Lesestatus (`readAt`, `unread`) je Nutzer. " +
    "Mindestrolle VIEWER; funktioniert auch mit persönlichem API-Key.",
  tags: ["Benachrichtigungen"],
  responses: {
    200: {
      description: "Meldungen, neueste zuerst, und Zähler",
      content: jsonOf(z.object({ data: NotificationListSchema })),
    },
    401: { description: "Keine Sitzung / kein gültiger API-Key" },
  },
});

registry.registerPath({
  method: "post",
  path: "/me/notifications/read",
  summary: "Benachrichtigung(en) für den aktuellen Nutzer als gelesen markieren",
  description:
    "Mit `id`: eine Meldung (idempotent; eine ID aus einem fremden Mandanten wird ignoriert). " +
    "Ohne `id` (leerer Body): alle offenen. Der Mandant kommt immer aus der Authentifizierung, nie aus dem Body. " +
    "Schreibt kein Audit — der Lesestatus ist keine fachliche Änderung.",
  tags: ["Benachrichtigungen"],
  request: { body: { content: jsonOf(NotificationReadSchema) } },
  responses: {
    200: { description: "OK", content: jsonOf(z.object({ data: NotificationReadResultSchema })) },
    401: { description: "Keine Sitzung / kein gültiger API-Key" },
    422: { description: "Ungültiger Body" },
  },
});
