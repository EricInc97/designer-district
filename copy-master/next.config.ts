import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  /*
   * Hide the floating dev-tools badge. It sits bottom-left, where it covers
   * the mobile stats strip. Dev only; it was never in a production build.
   */
  devIndicators: false,
  turbopack: {
    /*
     * This project sits inside another repository that has its own lockfile, so
     * Turbopack's root inference picks the parent directory and then tries to
     * compile the parent's source. Pin the root to this folder.
     */
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
