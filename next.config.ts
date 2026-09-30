import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true }, // frames and stills are pre-built by `npm run frames`
};

export default config;
