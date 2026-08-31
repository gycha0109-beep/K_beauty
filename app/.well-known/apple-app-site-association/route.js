const TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const IOS_BUNDLE_ID = "com.bejewely.mobile";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export function GET() {
  const teamId = process.env.MOBILE_IOS_APPLE_TEAM_ID?.trim().toUpperCase() || "";

  if (!TEAM_ID_PATTERN.test(teamId)) {
    return json({ error: "mobile_ios_apple_team_id_not_configured" }, 503);
  }

  return json({
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${IOS_BUNDLE_ID}`,
          components: [
            {
              "/": "/r/*",
              comment: "Open public BEJEWELY shared reports in the native app."
            }
          ]
        }
      ]
    }
  });
}
