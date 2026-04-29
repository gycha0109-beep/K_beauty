const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => ({
  // Keep dev and production build artifacts separate so local verification
  // (`next build`) does not break the running dev server's asset manifest.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
});
