import path from "node:path";

const nextConfig = {
  turbopack: {
    root: path.resolve(process.cwd())
  }
};

const config =
  process.env.NODE_ENV !== "production"
    ? nextConfig
    : (await import("@ducanh2912/next-pwa")).default({
    dest: "public",
    register: true,
    skipWaiting: true
  })(nextConfig);

export default config;
