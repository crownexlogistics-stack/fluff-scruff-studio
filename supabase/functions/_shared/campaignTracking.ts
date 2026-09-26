// Single source of truth for campaign email tracking.
// Every campaign send path (Send Now, Scheduled, A/B winner) MUST use this so
// opens, clicks, bookings and revenue can be attributed to the campaign.
export function applyCampaignTracking(html: string, campaignId: string, email: string, supabaseUrl: string): string {
  let out = html.replace(/href="(https?:\/\/[^"]+)"/g, (match: string, url: string) => {
    if (url.includes("handle-unsubscribe") || url.includes("email-track") || url.includes("/unsubscribe")) return match;
    let dest = url;
    if (/\/book(\?|$|\/|#)/.test(dest) && !dest.includes("utm_campaign=")) {
      dest += (dest.includes("?") ? "&" : "?") + `utm_campaign=${campaignId}`;
    }
    const track = `${supabaseUrl}/functions/v1/email-track?t=click&c=${encodeURIComponent(campaignId)}&e=${encodeURIComponent(email)}&url=${encodeURIComponent(dest)}`;
    return `href="${track}"`;
  });
  out += `<img src="${supabaseUrl}/functions/v1/email-track?t=open&c=${encodeURIComponent(campaignId)}&e=${encodeURIComponent(email)}" width="1" height="1" style="display:none" alt="" />`;
  return out;
}
