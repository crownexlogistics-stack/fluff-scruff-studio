import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logoUrl = "https://fluffandscruff.co.uk/logo-transparent.png";
const siteUrl = "https://fluffandscruff.co.uk";

const TC_POINTS = [
  "Full payment is required upfront at time of booking.",
  "All session dates must be agreed at the time of purchase.",
  "Sessions may be rescheduled with a minimum of 48 hours notice. Sessions missed without 48 hours notice may be counted as used at the salon's discretion.",
  "If you do not attend a session without notice (no-show), that session is counted as used with no refund or replacement.",
  "If you cancel your package, a refund will be issued for remaining unused sessions at the package price per session.",
  "Packages are non-transferable to another person or dog.",
  "Sessions do not expire whilst the package is active.",
  "The discounted price is locked in at the time of purchase and will not be affected by future price increases.",
  "Fluff & Scruff Studio reserves the right to decline a session if there are welfare or behavioural concerns regarding your dog.",
  "These terms are governed by English law.",
];

function parseBrowserFromUA(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Edg")) return "Microsoft Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Unknown Browser";
}

function generateAgreementPdfHtml(
  pb: any,
  tcSig: any,
  signedDate: string,
  sessions: any[]
): string {
  const browser = parseBrowserFromUA(tcSig.user_agent);
  const tcList = TC_POINTS.map((p, i) => `<li style="margin-bottom:6px;">${i + 1}. ${p}</li>`).join("");
  const sessionRows = sessions.map((s: any) => {
    const date = s.scheduled_date
      ? new Date(s.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "TBC";
    const time = s.scheduled_time ? s.scheduled_time.substring(0, 5) : "TBC";
    const svc = (s.service_type || "").replace("_", " ");
    return `<tr><td style="padding:4px 8px;border:1px solid #ddd;">Session ${s.session_number}</td><td style="padding:4px 8px;border:1px solid #ddd;">${date}</td><td style="padding:4px 8px;border:1px solid #ddd;">${time}</td><td style="padding:4px 8px;border:1px solid #ddd;text-transform:capitalize;">${svc}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; margin: 40px; line-height: 1.5; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  .detail-table td { padding: 4px 0; }
  .detail-table td:first-child { color: #666; width: 140px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; }
</style></head>
<body>
  <div style="text-align:center;margin-bottom:24px;">
    <h1>Fluff & Scruff Studio</h1>
    <p style="color:#666;margin:0;">138 Hillview Avenue, Hornchurch RM11 2DL</p>
    <p style="color:#666;margin:4px 0 0 0;">Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
  </div>

  <h2>SIGNED AGREEMENT</h2>

  <table class="detail-table">
    <tr><td>Full Name:</td><td><strong>${tcSig.signature_text}</strong></td></tr>
    <tr><td>Email:</td><td>${tcSig.customer_email || pb.customer_email}</td></tr>
    <tr><td>Package:</td><td>${pb.packages?.name || "Package Deal"}</td></tr>
    <tr><td>Sessions:</td><td>${pb.sessions_total} sessions</td></tr>
    <tr><td>Total Paid:</td><td>£${Number(pb.total_paid).toFixed(2)}</td></tr>
    <tr><td>Signed At:</td><td>${signedDate}</td></tr>
    <tr><td>IP Address:</td><td>${tcSig.ip_address || "Unknown"}</td></tr>
    <tr><td>Browser:</td><td>${browser}</td></tr>
    <tr><td>T&C Version:</td><td>1.0</td></tr>
  </table>

  ${sessions.length > 0 ? `
  <h2>BOOKED SESSIONS</h2>
  <table>
    <tr style="background:#f0f0f0;"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Session</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Date</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Time</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Service</th></tr>
    ${sessionRows}
  </table>` : ""}

  <h2>TERMS & CONDITIONS</h2>
  <ol style="padding-left:0;list-style:none;">${tcList}</ol>

  <div class="footer">
    <p>This document was electronically signed under the Electronic Communications Act 2000. The signature, timestamp and IP address above constitute a legally binding electronic signature.</p>
  </div>
</body>
</html>`;
}

async function generateAndStorePdf(
  supabase: any,
  pb: any,
  tcSig: any,
  signedDate: string,
  sessions: any[],
  packageBookingId: string
): Promise<string | null> {
  try {
    // Generate HTML for the PDF
    const html = generateAgreementPdfHtml(pb, tcSig, signedDate, sessions);

    // Use a headless HTML-to-PDF service or encode as data
    // Since Deno edge functions can't run Puppeteer, we'll store the HTML as a styled PDF-like document
    // We'll use the jsPDF approach via a minimal text-based PDF

    // Actually, the best approach for Deno is to use a PDF generation library
    // We'll create a well-formatted HTML and convert it using the built-in approach
    // For now, store as HTML-rendered content that can be viewed as PDF

    // Use a simple approach: create PDF bytes using a basic PDF structure
    const pdfBytes = createSimplePdf(pb, tcSig, signedDate, sessions);

    const signedAtDate = new Date(tcSig.signed_at).toISOString().split("T")[0];
    const filePath = `${packageBookingId}/signed-agreement-${signedAtDate}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("package-agreements")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      return null;
    }

    // Save path to tc_signatures
    await supabase
      .from("package_tc_signatures")
      .update({ pdf_storage_path: filePath })
      .eq("id", tcSig.id);

    return filePath;
  } catch (err) {
    console.error("PDF generation error:", err);
    return null;
  }
}

function createSimplePdf(pb: any, tcSig: any, signedDate: string, sessions: any[]): Uint8Array {
  const browser = parseBrowserFromUA(tcSig.user_agent);
  const generatedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // Build text content for the PDF
  const lines: string[] = [];
  lines.push("Fluff & Scruff Studio");
  lines.push("138 Hillview Avenue, Hornchurch RM11 2DL");
  lines.push(`Generated: ${generatedDate}`);
  lines.push("");
  lines.push("SIGNED AGREEMENT");
  lines.push("================");
  lines.push("");
  lines.push(`Full Name: ${tcSig.signature_text}`);
  lines.push(`Email: ${tcSig.customer_email || pb.customer_email}`);
  lines.push(`Package: ${pb.packages?.name || "Package Deal"}`);
  lines.push(`Sessions: ${pb.sessions_total} sessions`);
  lines.push(`Total Paid: GBP ${Number(pb.total_paid).toFixed(2)}`);
  lines.push(`Signed At: ${signedDate}`);
  lines.push(`IP Address: ${tcSig.ip_address || "Unknown"}`);
  lines.push(`Browser: ${browser}`);
  lines.push(`T&C Version: 1.0`);
  lines.push("");

  if (sessions.length > 0) {
    lines.push("BOOKED SESSIONS");
    lines.push("===============");
    sessions.forEach((s: any) => {
      const date = s.scheduled_date
        ? new Date(s.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "TBC";
      const time = s.scheduled_time ? s.scheduled_time.substring(0, 5) : "TBC";
      const svc = (s.service_type || "").replace("_", " ");
      lines.push(`  Session ${s.session_number}: ${date} at ${time} - ${svc}`);
    });
    lines.push("");
  }

  lines.push("TERMS & CONDITIONS");
  lines.push("==================");
  TC_POINTS.forEach((p, i) => {
    lines.push(`${i + 1}. ${p}`);
  });
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("This document was electronically signed under the Electronic");
  lines.push("Communications Act 2000. The signature, timestamp and IP address");
  lines.push("above constitute a legally binding electronic signature.");

  // Create a proper PDF document manually
  const textContent = lines.join("\n");
  const encoder = new TextEncoder();

  // PDF structure - simple single page text document
  const pageWidth = 595; // A4 width in points
  const pageHeight = 842; // A4 height in points
  const margin = 50;
  const lineHeight = 14;
  const maxCharsPerLine = 80;

  // Word-wrap and prepare final lines
  const wrappedLines: Array<{ text: string; bold: boolean; size: number }> = [];
  for (const line of lines) {
    const isBold = line === "Fluff & Scruff Studio" || line === "SIGNED AGREEMENT" ||
      line === "BOOKED SESSIONS" || line === "TERMS & CONDITIONS" ||
      line.startsWith("===");
    const isHeader = line === "Fluff & Scruff Studio";
    const isSubHeader = line === "SIGNED AGREEMENT" || line === "BOOKED SESSIONS" || line === "TERMS & CONDITIONS";

    if (line.startsWith("===")) continue; // skip separator lines

    const size = isHeader ? 16 : isSubHeader ? 13 : 10;

    if (line.length <= maxCharsPerLine) {
      wrappedLines.push({ text: line, bold: isBold || isSubHeader, size });
    } else {
      // Word wrap
      const words = line.split(" ");
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + " " + word).trim().length > maxCharsPerLine) {
          wrappedLines.push({ text: currentLine.trim(), bold: false, size });
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + " " + word : word;
        }
      }
      if (currentLine.trim()) {
        wrappedLines.push({ text: currentLine.trim(), bold: false, size });
      }
    }
  }

  // Calculate pages needed
  const usableHeight = pageHeight - 2 * margin;
  const linesPerPage = Math.floor(usableHeight / lineHeight);
  const totalPages = Math.ceil(wrappedLines.length / linesPerPage);

  // Build PDF objects
  let objCount = 0;
  const objects: string[] = [];
  const offsets: number[] = [];

  function addObj(content: string): number {
    objCount++;
    objects.push(`${objCount} 0 obj\n${content}\nendobj\n`);
    return objCount;
  }

  // Object 1: Catalog
  addObj("<< /Type /Catalog /Pages 2 0 R >>");

  // We'll add pages tree after creating pages
  const pagesObjNum = 2;
  objects.push(""); // placeholder for pages object

  // Object 3: Font
  const fontObj = objCount + 1;
  addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  const boldFontObj = objCount + 1;
  addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  // Create pages
  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];

  for (let p = 0; p < totalPages; p++) {
    const startLine = p * linesPerPage;
    const endLine = Math.min(startLine + linesPerPage, wrappedLines.length);
    const pageLines = wrappedLines.slice(startLine, endLine);

    // Build content stream
    let stream = "BT\n";
    let y = pageHeight - margin;

    for (const line of pageLines) {
      const fontName = line.bold ? "/F2" : "/F1";
      const escapedText = line.text
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/£/g, "\\243");

      stream += `${fontName} ${line.size} Tf\n`;
      stream += `${margin} ${y} Td\n`;
      stream += `(${escapedText}) Tj\n`;
      y -= lineHeight;

      // Reset position for next absolute positioning
      stream += `${-margin} ${-y - lineHeight + y + lineHeight} Td\n`;
    }
    stream += "ET\n";

    // Use a simpler approach for text positioning
    stream = "";
    y = pageHeight - margin;
    for (const line of pageLines) {
      const fontName = line.bold ? "/F2" : "/F1";
      const escapedText = line.text
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/£/g, "\\243");

      stream += `BT ${fontName} ${line.size} Tf ${margin} ${y} Td (${escapedText}) Tj ET\n`;
      y -= lineHeight;
    }

    const contentObj = objCount + 1;
    addObj(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    contentObjNums.push(contentObj);

    const pageObj = objCount + 1;
    addObj(`<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${fontObj} 0 R /F2 ${boldFontObj} 0 R >> >> >>`);
    pageObjNums.push(pageObj);
  }

  // Now fill in the pages object
  const kidsStr = pageObjNums.map(n => `${n} 0 R`).join(" ");
  objects[1] = `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj\n`;

  // Build final PDF
  let pdf = "%PDF-1.4\n";

  const computedOffsets: number[] = [];
  for (const obj of objects) {
    computedOffsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 0; i < objCount; i++) {
    const offset = computedOffsets[i].toString().padStart(10, "0");
    pdf += `${offset} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, package_booking_id, tc_signature_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load package booking with package info
    const { data: pb, error: pbErr } = await supabase
      .from("package_bookings")
      .select("*, packages(name, package_type, session_count, discount_percentage)")
      .eq("id", package_booking_id)
      .single();

    if (pbErr || !pb) {
      return new Response(JSON.stringify({ error: "Package booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "invite") {
      // Generate signing token and create TC record
      const signingToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase.from("package_tc_signatures").insert({
        package_booking_id,
        customer_email: pb.customer_email,
        customer_name: pb.customer_name,
        signing_token: signingToken,
        token_expires_at: expiresAt.toISOString(),
        status: "pending",
      });

      // Update email_sent_at
      await supabase.from("package_tc_signatures")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("signing_token", signingToken);

      const signUrl = `${siteUrl}/sign-package-tc?token=${signingToken}`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
          to: [pb.customer_email],
          reply_to: "info@fluffandscruff.co.uk",
          subject: "Action Required — Please Sign Your Package Agreement | Fluff & Scruff Studio",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; padding: 16px 0;">
                <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
              </div>
              <h2 style="color: #1a1a1a;">Your Package Agreement</h2>
              <p>Hi <strong>${pb.customer_name}</strong>,</p>
              <p>Thank you for purchasing your package deal with Fluff & Scruff Studio! Here are your package details:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Package</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${pb.packages?.name || "Package Deal"}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Sessions</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${pb.sessions_total} sessions</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Total Paid</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">£${Number(pb.total_paid).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px; color: #666;">Discount</td><td style="padding: 8px; font-weight: bold;">${pb.packages?.discount_percentage}% off</td></tr>
              </table>
              <p>Before we can confirm your sessions, we need you to review and sign our Package Deal Terms & Conditions.</p>
              <p style="margin: 24px 0; text-align: center;">
                <a href="${signUrl}" style="background-color: #3d4147; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                  Sign Your Agreement
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">Please note: your sessions cannot be confirmed until the agreement is signed.</p>
              <p style="color: #666; font-size: 14px;">If you have any questions, please contact us at <a href="mailto:info@fluffandscruff.co.uk">info@fluffandscruff.co.uk</a> or call us at the salon.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
            </div>
          `,
        }),
      });

      return new Response(JSON.stringify({ success: true, token: signingToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "signed_confirmation") {
      // Load the TC signature
      const { data: tcSig } = await supabase
        .from("package_tc_signatures")
        .select("*")
        .eq("id", tc_signature_id)
        .single();

      if (!tcSig) {
        return new Response(JSON.stringify({ error: "Signature not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load sessions for listing dates
      const { data: sessions } = await supabase
        .from("package_sessions")
        .select("session_number, scheduled_date, scheduled_time, service_type")
        .eq("package_booking_id", package_booking_id)
        .order("session_number");

      const signedDate = new Date(tcSig.signed_at).toLocaleString("en-GB", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });

      // Generate and store PDF (non-blocking — don't fail signing if PDF fails)
      let pdfBase64: string | null = null;
      let pdfStoragePath: string | null = null;
      try {
        pdfStoragePath = await generateAndStorePdf(
          supabase, pb, tcSig, signedDate, sessions || [], package_booking_id
        );

        // If PDF was stored, download it for email attachment
        if (pdfStoragePath) {
          const { data: pdfData } = await supabase.storage
            .from("package-agreements")
            .download(pdfStoragePath);
          if (pdfData) {
            const arrayBuffer = await pdfData.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            // Base64 encode for email attachment
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            pdfBase64 = btoa(binary);
          }
        }
      } catch (pdfErr) {
        console.error("PDF generation/storage failed (non-blocking):", pdfErr);
      }

      const sessionRows = (sessions || []).map((s: any) => {
        const date = s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "TBC";
        const time = s.scheduled_time ? s.scheduled_time.substring(0, 5) : "TBC";
        const svc = (s.service_type || "").replace("_", " ");
        return `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #eee;">Session ${s.session_number}</td><td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${date}</td><td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${time}</td><td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-transform: capitalize;">${svc}</td></tr>`;
      }).join("");

      const tcHtml = TC_POINTS.map((p, i) => `<li style="margin-bottom: 8px;">${p}</li>`).join("");

      // Build email payload with optional PDF attachment
      const emailPayload: any = {
        from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
        to: [pb.customer_email],
        reply_to: "info@fluffandscruff.co.uk",
        subject: "Package Agreement Signed — Fluff & Scruff Studio",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; padding: 16px 0;">
              <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
            </div>
            <h2 style="color: #1a1a1a;">Agreement Signed ✓</h2>
            <p>Hi <strong>${pb.customer_name}</strong>,</p>
            <p>Thank you for signing your Package Deal Agreement. Here's a summary for your records:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Signed as</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${tcSig.signature_text}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Date & Time</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${signedDate}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Package</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${pb.packages?.name || "Package Deal"}</td></tr>
              <tr><td style="padding: 8px; color: #666;">Total Paid</td><td style="padding: 8px; font-weight: bold;">£${Number(pb.total_paid).toFixed(2)}</td></tr>
            </table>
            <h3 style="color: #1a1a1a; margin-top: 24px;">Your Booked Sessions</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 14px;">
              <tr style="background: #f9f9f9;"><th style="padding: 6px 8px; text-align: left;">Session</th><th style="padding: 6px 8px; text-align: left;">Date</th><th style="padding: 6px 8px; text-align: left;">Time</th><th style="padding: 6px 8px; text-align: left;">Service</th></tr>
              ${sessionRows}
            </table>
            <h3 style="color: #1a1a1a; margin-top: 24px;">Terms & Conditions Agreed</h3>
            <ol style="font-size: 13px; color: #555; line-height: 1.6;">${tcHtml}</ol>
            ${pdfBase64 ? '<p style="color: #666; font-size: 14px;">A copy of your signed agreement is attached to this email as a PDF.</p>' : ''}
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #666; font-size: 14px;">If you have any questions about your package, please contact us at <a href="mailto:info@fluffandscruff.co.uk">info@fluffandscruff.co.uk</a>.</p>
            <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
          </div>
        `,
      };

      // Attach PDF if available
      if (pdfBase64) {
        const signedAtDate = new Date(tcSig.signed_at).toISOString().split("T")[0];
        emailPayload.attachments = [
          {
            filename: `Package-Agreement-${signedAtDate}.pdf`,
            content: pdfBase64,
            type: "application/pdf",
          },
        ];
      }

      // Send confirmation to customer
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(emailPayload),
      });

      // Send notification to salon
      const profileUrl = `${siteUrl}/admin/customers/${encodeURIComponent(pb.customer_email)}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
          to: ["info@fluffandscruff.co.uk"],
          reply_to: "info@fluffandscruff.co.uk",
          subject: `✅ Package T&C Signed — ${pb.customer_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; padding: 16px 0;">
                <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
              </div>
              <h2 style="color: #1a1a1a;">Package T&C Signed ✓</h2>
              <ul style="line-height: 2;">
                <li><strong>Customer:</strong> ${pb.customer_name} (${pb.customer_email})</li>
                <li><strong>Package:</strong> ${pb.packages?.name || "Package Deal"}</li>
                <li><strong>Signed on:</strong> ${signedDate}</li>
                <li><strong>IP Address:</strong> ${tcSig.ip_address || "Unknown"}</li>
              </ul>
              <p style="margin: 24px 0;">
                <a href="${profileUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Customer Profile
                </a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
            </div>
          `,
        }),
      });

      // Log to audit
      await supabase.from("booking_audit_log").insert({
        booking_id: package_booking_id,
        event_type: "package_tc_signed",
        note: `Package T&C signed by ${pb.customer_name} (${pb.customer_email})${pdfStoragePath ? " — PDF stored" : " — PDF generation skipped"}`,
        performed_by: pb.customer_name,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "resend_invite") {
      // Delete old pending tokens and create new one
      await supabase
        .from("package_tc_signatures")
        .delete()
        .eq("package_booking_id", package_booking_id)
        .eq("status", "pending");

      // Re-invoke with invite type
      const response = await fetch(`${supabaseUrl}/functions/v1/send-package-tc-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ type: "invite", package_booking_id }),
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
