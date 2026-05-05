import fs from "fs";
import path from "path";

function readDotEnvLocalValue(name) {
  if (process.env.NODE_ENV === "production") {
    return "";
  }

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const raw = fs.readFileSync(envPath, "utf8");
    const line = raw
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${name}=`));

    if (!line) {
      return "";
    }

    return line
      .split("=")
      .slice(1)
      .join("=")
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return "";
  }
}

export function maskSecretText(value = "") {
  return String(value || "").replace(/sk-[^\s"',}]+/g, (token) => `${token.slice(0, 7)}...`);
}

export function previewDiagnosticText(value = "", maxLength = 240) {
  const text = maskSecretText(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function getOpenAiEnvDiagnostics({
  route = "",
  routeUsesOpenAi = false,
  routeUsesOpenRouter = false
} = {}) {
  const openAiApiKey = process.env.OPENAI_API_KEY || "";
  const dotEnvLocalOpenAiApiKey = readDotEnvLocalValue("OPENAI_API_KEY");
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
  const resolved = resolveOpenAiApiKey();

  return {
    route,
    routeUsesOpenAi,
    routeUsesOpenRouter,
    hasOpenAiApiKey: Boolean(openAiApiKey),
    openAiApiKeyPrefix: openAiApiKey ? openAiApiKey.slice(0, 7) : "",
    hasDotEnvLocalOpenAiApiKey: Boolean(dotEnvLocalOpenAiApiKey),
    dotEnvLocalOpenAiApiKeyPrefix: dotEnvLocalOpenAiApiKey ? dotEnvLocalOpenAiApiKey.slice(0, 7) : "",
    processOpenAiMatchesDotEnvLocal: Boolean(
      openAiApiKey &&
        dotEnvLocalOpenAiApiKey &&
        openAiApiKey === dotEnvLocalOpenAiApiKey
    ),
    resolvedOpenAiApiKeySource: resolved.source,
    hasOpenRouterApiKey: Boolean(openRouterApiKey),
    openRouterApiKeyPrefix: openRouterApiKey ? openRouterApiKey.slice(0, 7) : "",
    hasOpenAiOrgId: Boolean(process.env.OPENAI_ORG_ID),
    hasOpenAiProjectId: Boolean(process.env.OPENAI_PROJECT_ID)
  };
}

export function resolveOpenAiApiKey() {
  const processOpenAiApiKey = process.env.OPENAI_API_KEY || "";
  const dotEnvLocalOpenAiApiKey = readDotEnvLocalValue("OPENAI_API_KEY");

  if (
    process.env.NODE_ENV !== "production" &&
    dotEnvLocalOpenAiApiKey &&
    dotEnvLocalOpenAiApiKey !== processOpenAiApiKey
  ) {
    return {
      apiKey: dotEnvLocalOpenAiApiKey,
      source: ".env.local"
    };
  }

  return {
    apiKey: processOpenAiApiKey,
    source: "process.env"
  };
}
