import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Base64url encode */
function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlStr(s: string): string {
  return base64url(new TextEncoder().encode(s));
}

/** Import a PEM private key for RS256 signing */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/** Create a signed JWT for Google service account auth */
async function createSignedJwt(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64urlStr(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(credentials.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput)
    )
  );
  return `${signingInput}.${base64url(sig)}`;
}

/** Exchange JWT for access token */
async function getAccessToken(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const jwt = await createSignedJwt(credentials);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent(
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    )}&assertion=${jwt}`,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.access_token;
}

/** Run a GA4 report */
async function runReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GA API error: ${res.status} ${txt}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialsRaw = Deno.env.get("GOOGLE_ANALYTICS_CREDENTIALS");
    if (!credentialsRaw) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_ANALYTICS_CREDENTIALS not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Support both GA_NUMERIC_PROPERTY_ID and GA_PROPERTY_ID
    const propertyId =
      Deno.env.get("GA_NUMERIC_PROPERTY_ID") || Deno.env.get("GA_PROPERTY_ID");
    if (!propertyId) {
      return new Response(
        JSON.stringify({
          error: "GA_NUMERIC_PROPERTY_ID not configured",
          hint: "Add your numeric GA4 property ID as a secret named GA_NUMERIC_PROPERTY_ID",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { startDate, endDate } = await req.json();
    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "startDate and endDate required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = JSON.parse(credentialsRaw);
    const accessToken = await getAccessToken(credentials);
    const dateRange = { startDate, endDate };

    // Run all 5 reports in parallel
    const [summaryReport, sourcesReport, devicesReport, locationsReport, pagesReport] =
      await Promise.all([
        // 1) Summary + daily breakdown
        runReport(accessToken, propertyId, {
          dateRanges: [dateRange],
          metrics: [
            { name: "activeUsers" },
            { name: "newUsers" },
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
            { name: "sessions" },
            { name: "bounceRate" },
          ],
          dimensions: [{ name: "date" }],
          orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
        }),
        // 2) Traffic sources
        runReport(accessToken, propertyId, {
          dateRanges: [dateRange],
          metrics: [{ name: "sessions" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 10,
        }),
        // 3) Device categories
        runReport(accessToken, propertyId, {
          dateRanges: [dateRange],
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "deviceCategory" }],
        }),
        // 4) Locations
        runReport(accessToken, propertyId, {
          dateRanges: [dateRange],
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "city" }, { name: "country" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 50,
        }),
        // 5) Top pages
        runReport(accessToken, propertyId, {
          dateRanges: [dateRange],
          metrics: [{ name: "screenPageViews" }],
          dimensions: [{ name: "pagePath" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 10,
        }),
      ]);

    // Parse summary — aggregate across all date rows
    const sRows = (summaryReport as any).rows || [];
    let totalUsers = 0,
      totalNew = 0,
      totalViews = 0,
      totalSessions = 0,
      totalDuration = 0,
      totalBounce = 0;
    const dailyUsers: { date: string; users: number; pageViews: number }[] = [];

    for (const row of sRows) {
      const date = row.dimensionValues?.[0]?.value || "";
      const users = Number(row.metricValues?.[0]?.value || 0);
      const newU = Number(row.metricValues?.[1]?.value || 0);
      const views = Number(row.metricValues?.[2]?.value || 0);
      const dur = Number(row.metricValues?.[3]?.value || 0);
      const sess = Number(row.metricValues?.[4]?.value || 0);
      const bounce = Number(row.metricValues?.[5]?.value || 0);
      totalUsers += users;
      totalNew += newU;
      totalViews += views;
      totalSessions += sess;
      totalDuration += dur * sess; // weighted
      totalBounce += bounce * sess;
      dailyUsers.push({ date, users, pageViews: views });
    }

    const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    const avgBounce = totalSessions > 0 ? totalBounce / totalSessions : 0;

    // Format average duration as Xm Ys
    const mins = Math.floor(avgDuration / 60);
    const secs = Math.round(avgDuration % 60);
    const avgDurationFormatted = `${mins}m ${secs}s`;

    // Parse traffic sources
    const trafficSources = ((sourcesReport as any).rows || []).map((r: any) => ({
      name: r.dimensionValues?.[0]?.value || "Unknown",
      value: Number(r.metricValues?.[0]?.value || 0),
    }));

    // Parse devices
    const deviceRows = ((devicesReport as any).rows || []);
    const totalDeviceUsers = deviceRows.reduce(
      (s: number, r: any) => s + Number(r.metricValues?.[0]?.value || 0),
      0
    );
    const devices = deviceRows.map((r: any) => {
      const name = r.dimensionValues?.[0]?.value || "Unknown";
      const count = Number(r.metricValues?.[0]?.value || 0);
      return {
        name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
        value: totalDeviceUsers > 0 ? Math.round((count / totalDeviceUsers) * 100) : 0,
        count,
      };
    });

    // Parse locations
    const locations = ((locationsReport as any).rows || [])
      .map((r: any) => ({
        city: r.dimensionValues?.[0]?.value || "Unknown",
        country: r.dimensionValues?.[1]?.value || "Unknown",
        visitors: Number(r.metricValues?.[0]?.value || 0),
      }))
      .filter((l: any) => l.city !== "(not set)" && l.visitors > 0);

    // Parse top pages
    const topPages = ((pagesReport as any).rows || []).map((r: any) => ({
      page: r.dimensionValues?.[0]?.value || "/",
      views: Number(r.metricValues?.[0]?.value || 0),
    }));

    const result = {
      summary: {
        totalVisitors: totalUsers,
        uniqueVisitors: totalNew,
        pageViews: totalViews,
        avgSessionDuration: avgDurationFormatted,
        sessions: totalSessions,
        bounceRate: Math.round(avgBounce * 100) / 100,
      },
      dailyUsers,
      trafficSources,
      devices,
      locations,
      topPages,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-analytics-data error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
