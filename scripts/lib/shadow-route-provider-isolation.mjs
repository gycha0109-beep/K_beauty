import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const KEY_LINE_PATTERN = /^\s*OPENAI_API_KEY\s*=/m;

export function inspectShadowRouteProviderIsolation(root = process.cwd()) {
  const routePath = path.join(root, "app", "api", "analyze", "route.js");
  const diagnosticsPath = path.join(root, "lib", "openai-env-diagnostics.js");
  const envPath = path.join(root, ".env.local");
  const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : "";
  const diagnosticsSource = existsSync(diagnosticsPath) ? readFileSync(diagnosticsPath, "utf8") : "";
  const envSource = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  const routeCallsExternalProvider = routeSource.includes("api.openai.com") && routeSource.includes("fetch(");
  const dotenvFallbackPresent =
    diagnosticsSource.includes('readDotEnvLocalValue("OPENAI_API_KEY")') &&
    diagnosticsSource.includes("process.env.NODE_ENV !== \"production\"");
  const keyNamePresentInDotEnvLocal = KEY_LINE_PATTERN.test(envSource);
  const deterministicFallbackPresent =
    routeSource.includes("buildFallbackPhotoAnalysis") && routeSource.includes("if (apiKey && imageDataUrl)");
  const existingTestAdapterPresent =
    routeSource.includes('resolveLocalShadowProviderStub') &&
    routeSource.includes('localShadowProviderStub.enabled') &&
    routeSource.includes('? { apiKey: "" }') &&
    routeSource.includes('providerIsolation: localShadowProviderStub.reasonCode');
  const processEnvClearSufficient = !(dotenvFallbackPresent && keyNamePresentInDotEnvLocal);
  const canGuaranteeZeroProductionProviderCalls =
    !routeCallsExternalProvider || existingTestAdapterPresent || processEnvClearSufficient;

  return {
    checked: true,
    routeCallsExternalProvider,
    deterministicFallbackPresent,
    dotenvFallbackPresent,
    keyNamePresentInDotEnvLocal,
    existingTestAdapterPresent,
    processEnvClearSufficient,
    canGuaranteeZeroProductionProviderCalls,
    providerStubbed: existingTestAdapterPresent,
    externalProductionProviderInvoked: false,
    reasonCode: canGuaranteeZeroProductionProviderCalls
      ? "provider_calls_can_be_disabled_without_runtime_change"
      : "development_dotenv_fallback_requires_approved_isolation_seam",
    requiredSeam: canGuaranteeZeroProductionProviderCalls
      ? null
      : {
          targetFile: "lib/openai-env-diagnostics.js",
          contract: "default_off_test_only_provider_disable_or_injected_key_resolver",
          productionImpactGuard: "development_and_explicit_test_harness_only"
        },
    secretsPrinted: false,
    envValuesPrinted: false
  };
}
