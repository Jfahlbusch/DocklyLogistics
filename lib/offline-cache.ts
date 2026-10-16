/** Leert alle Service-Worker-Caches, damit nach dem Abmelden keine Mandantendaten im Gerät bleiben. Scheitert nie. */
export async function clearServiceWorkerCaches(): Promise<void> {
  try {
    if ("caches" in window) {
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    }
  } catch {
    /* Abmelden darf an der Cache-API nie scheitern */
  }
}
