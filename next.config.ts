import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the project's existing Tailwind/Turbopack CSS loader configuration.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
