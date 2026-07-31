import assert from "node:assert/strict";
import {
  buildOAuthCallbackUrl,
  resolveOAuthReturnOrigin
} from "../lib/auth/oauth-return-origin.mjs";

const production = "https://k-beauty-two.vercel.app";
const immutablePreview = "https://k-beauty-8h3r65y3e-johnny-self.vercel.app";
const branchPreview =
  "https://k-beauty-git-codex-stage10-hosted-preview-user-flow-johnny-self.vercel.app";

assert.equal(resolveOAuthReturnOrigin(production, production), production);
assert.equal(
  resolveOAuthReturnOrigin(immutablePreview, production),
  immutablePreview
);
assert.equal(resolveOAuthReturnOrigin(branchPreview, production), branchPreview);
assert.equal(
  resolveOAuthReturnOrigin("http://localhost:3001", production),
  "http://localhost:3001"
);
assert.equal(
  resolveOAuthReturnOrigin("https://untrusted.example", production),
  production
);
assert.equal(
  resolveOAuthReturnOrigin("https://other-project-johnny-self.vercel.app", production),
  production
);
assert.equal(resolveOAuthReturnOrigin("https://k-beauty-attacker.vercel.app", production), production);
assert.equal(resolveOAuthReturnOrigin("", production), production);
assert.equal(resolveOAuthReturnOrigin(production), production);
assert.equal(resolveOAuthReturnOrigin(production, "http://insecure.example"), null);

assert.equal(
  buildOAuthCallbackUrl({
    currentOrigin: immutablePreview,
    configuredProductionOrigin: production,
    next: "/en/my"
  }),
  `${immutablePreview}/auth/callback?next=%2Fen%2Fmy`
);
assert.equal(
  buildOAuthCallbackUrl({
    currentOrigin: immutablePreview,
    configuredProductionOrigin: production,
    next: "//evil.example"
  }),
  `${immutablePreview}/auth/callback?next=%2Fmy`
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      productionCanonicalUnchanged: true,
      previewProjectBoundaryVerified: true,
      localhostBoundaryVerified: true,
      untrustedHostFallbackVerified: true,
      localeCallbackVerified: true,
      assertions: 13
    },
    null,
    2
  )
);
