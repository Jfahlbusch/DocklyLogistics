import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl ohne i18n-Routing: Sprache fix Deutsch, URLs bleiben unverändert (siehe i18n/request.ts).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // ssh2 (via ssh2-sftp-client) has an OPTIONAL native binding (cpu-features →
  // cpufeatures.node) it require()s in a try/catch and falls back to pure JS.
  // Bundling it makes Turbopack try to resolve that .node file and fail, so keep
  // it external — loaded from node_modules at runtime instead.
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"],
};

export default withNextIntl(nextConfig);
