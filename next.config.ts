import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ssh2 (via ssh2-sftp-client) has an OPTIONAL native binding (cpu-features →
  // cpufeatures.node) it require()s in a try/catch and falls back to pure JS.
  // Bundling it makes Turbopack try to resolve that .node file and fail, so keep
  // it external — loaded from node_modules at runtime instead.
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"],
};

export default nextConfig;
