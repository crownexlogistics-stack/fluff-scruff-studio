export interface InlineEmailAttachment {
  content: string;
  filename: string;
  content_id: string;
}

export interface PreparedEmailHtml {
  html: string;
  attachments: InlineEmailAttachment[];
}

const DATA_IMAGE_PATTERN = /src\s*=\s*(["'])data:(image\/(?:png|jpeg|jpg|gif|webp));base64,([^"']+)\1/gi;

// Browser previews can render data URLs directly, but many inboxes cannot.
// Turn embedded images into CID attachments so the delivered email matches the preview.
export function prepareInlineEmailImages(html: string): PreparedEmailHtml {
  const attachments: InlineEmailAttachment[] = [];
  const seen = new Map<string, string>();

  const preparedHtml = html.replace(
    DATA_IMAGE_PATTERN,
    (_match, quote: string, mimeType: string, rawContent: string) => {
      const content = rawContent.replace(/\s/g, "");
      let contentId = seen.get(content);

      if (!contentId) {
        contentId = `campaign-image-${attachments.length + 1}`;
        const extension = mimeType === "image/jpeg" || mimeType === "image/jpg"
          ? "jpg"
          : mimeType.split("/")[1];
        attachments.push({
          content,
          filename: `${contentId}.${extension}`,
          content_id: contentId,
        });
        seen.set(content, contentId);
      }

      return `src=${quote}cid:${contentId}${quote}`;
    },
  );

  return { html: preparedHtml, attachments };
}