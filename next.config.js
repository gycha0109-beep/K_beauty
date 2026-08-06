const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");
const {
  GLOBAL_SECURITY_HEADERS
} = require("./lib/security/security-headers.js");

module.exports = (phase) => ({
  // Keep dev and production build artifacts separate so local verification
  // (`next build`) does not break the running dev server's asset manifest.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  webpack(config) {
    const existingJavaScriptAliases =
      config.resolve.extensionAlias?.[".js"] || [".js"];

    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [
        ".ts",
        ".tsx",
        ...existingJavaScriptAliases.filter(
          (extension) => extension !== ".ts" && extension !== ".tsx"
        )
      ]
    };

    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: GLOBAL_SECURITY_HEADERS
      }
    ];
  }
});
