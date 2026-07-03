import crypto from "node:crypto";
import SftpClient from "ssh2-sftp-client";
import { decryptSecret } from "@/lib/crypto/aes";

/**
 * Thin SFTP client for the per-tenant Warenwirtschaft bridge. DocklyLogistics
 * is always the CLIENT (the SFTP server runs separately). Credentials arrive
 * AES-encrypted and are decrypted only here, in memory.
 *
 * Security: when a host-key fingerprint is pinned, every connection verifies
 * the server's key against it (SHA-256, base64) to prevent MITM. The target is
 * an operator-configured, trusted host (usually inside the VPC), so we do NOT
 * apply the outbound SSRF guard here.
 */

export type SftpConfig = {
  host: string;
  port: number;
  username: string;
  authType: string; // KEY | PASSWORD
  privateKeyEncrypted?: string | null;
  passwordEncrypted?: string | null;
  hostKeyFingerprint?: string | null;
};

export class SftpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SftpError";
  }
}

function sha256Base64(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("base64");
}

function connectOptions(cfg: SftpConfig): SftpClient.ConnectOptions {
  const opts: SftpClient.ConnectOptions = {
    host: cfg.host,
    port: cfg.port || 22,
    username: cfg.username,
    readyTimeout: 15_000,
  };
  if (cfg.authType === "KEY") {
    if (!cfg.privateKeyEncrypted) throw new SftpError("Kein privater Schlüssel hinterlegt");
    opts.privateKey = decryptSecret(cfg.privateKeyEncrypted);
  } else {
    if (!cfg.passwordEncrypted) throw new SftpError("Kein Passwort hinterlegt");
    opts.password = decryptSecret(cfg.passwordEncrypted);
  }
  // Host-key pinning (optional but recommended).
  if (cfg.hostKeyFingerprint) {
    const expected = cfg.hostKeyFingerprint.trim().replace(/^SHA256:/i, "");
    opts.hostVerifier = (key: Buffer | { data?: Buffer }) => {
      const buf = Buffer.isBuffer(key) ? key : key?.data;
      if (!buf) return false;
      return sha256Base64(buf).replace(/=+$/, "") === expected.replace(/=+$/, "");
    };
  }
  return opts;
}

export type RemoteFile = { name: string; path: string; size: number; modifyTime: number };

/** Run one operation on a fresh connection, always closing it. */
async function withClient<T>(cfg: SftpConfig, fn: (c: SftpClient) => Promise<T>): Promise<T> {
  const client = new SftpClient();
  try {
    await client.connect(connectOptions(cfg));
    return await fn(client);
  } catch (e) {
    if (e instanceof SftpError) throw e;
    throw new SftpError(e instanceof Error ? e.message : String(e));
  } finally {
    await client.end().catch(() => {});
  }
}

export const sftp = {
  /** Connect + list both directories — used by the "Verbindung testen" button. */
  async test(cfg: SftpConfig, outboxDir: string, inboxDir: string) {
    return withClient(cfg, async (c) => {
      const out = await c.list(outboxDir).catch((e) => {
        throw new SftpError(`Ausgangsordner „${outboxDir}" nicht lesbar: ${(e as Error).message}`);
      });
      const inb = await c.list(inboxDir).catch((e) => {
        throw new SftpError(`Eingangsordner „${inboxDir}" nicht lesbar: ${(e as Error).message}`);
      });
      return { ok: true, outboxCount: out.length, inboxCount: inb.length };
    });
  },

  /** List regular files directly in `dir` (no recursion; skips dot-entries). */
  async listFiles(cfg: SftpConfig, dir: string): Promise<RemoteFile[]> {
    return withClient(cfg, async (c) => {
      const entries = await c.list(dir);
      return entries
        .filter((e) => e.type === "-" && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: `${dir.replace(/\/$/, "")}/${e.name}`, size: e.size, modifyTime: e.modifyTime }));
    });
  },

  /** Immediate sub-directory names of `dir` (for per-partner subfolder routing). */
  async listDirs(cfg: SftpConfig, dir: string): Promise<string[]> {
    return withClient(cfg, async (c) => {
      const entries = await c.list(dir);
      return entries.filter((e) => e.type === "d" && !e.name.startsWith(".")).map((e) => e.name);
    });
  },

  async readFile(cfg: SftpConfig, path: string): Promise<Buffer> {
    return withClient(cfg, async (c) => {
      const data = await c.get(path);
      return Buffer.isBuffer(data) ? data : Buffer.from(data as string);
    });
  },

  async writeFile(cfg: SftpConfig, path: string, content: Buffer | string): Promise<void> {
    await withClient(cfg, async (c) => {
      const dir = path.replace(/\/[^/]+$/, "");
      if (dir && !(await c.exists(dir))) await c.mkdir(dir, true);
      await c.put(Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"), path);
    });
  },

  /** Move a processed file into a sub-folder (sent/ or error/), creating it. */
  async moveToSubfolder(cfg: SftpConfig, filePath: string, subfolder: string): Promise<void> {
    await withClient(cfg, async (c) => {
      const dir = filePath.replace(/\/[^/]+$/, "");
      const name = filePath.replace(/^.*\//, "");
      const targetDir = `${dir}/${subfolder}`;
      if (!(await c.exists(targetDir))) await c.mkdir(targetDir, true);
      const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      await c.rename(filePath, `${targetDir}/${stamp}_${name}`);
    });
  },
};
