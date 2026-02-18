import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@xenova/transformers", "@huggingface/transformers", "onnxruntime-node", "sharp"],
};

export default nextConfig;
