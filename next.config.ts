import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  /** `/builder` was the agent workspace the workbench replaced. */
  redirects: async () => [
    { source: "/builder", destination: "/workbench", permanent: true },
  ],
};

export default nextConfig;
