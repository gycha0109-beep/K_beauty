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
  return value ? "[redacted]" : "";
}

export function previewDiagnosticText(value = "") {
  return value ? "diagnostic_redacted" : "";
}

export function getOpenAiEnvDiagnostics({
  route: _route = "",
  routeUsesOpenAi = false,
  routeUsesOpenRouter = false
} = {}) {
  const openAiApiKey = process.env.OPENAI_API_KEY || "";
  const dotEnvLocalOpenAiApiKey = readDotEnvLocalValue("OPENAI_API_KEY");
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
  void _route;

  return {
    routeUsesOpenAi,
    routeUsesOpenRouter,
    hasOpenAiApiKey: Boolean(openAiApiKey),
    hasDotEnvLocalOpenAiApiKey: Boolean(dotEnvLocalOpenAiApiKey),
    hasOpenRouterApiKey: Boolean(openRouterApiKey),
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
