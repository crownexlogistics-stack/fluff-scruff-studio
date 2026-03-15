

## Add Edit Button for Scheduled/Draft Campaigns

### What you get
An "Edit" button on draft and scheduled campaigns in the Library. Clicking it loads the campaign into the editor with a "Save Changes" button (instead of creating a new campaign). You can update the subject, HTML content, segment, and scheduled time, then save back to the same record.

### Technical approach

**File: `src/components/marketing/EmailMarketingSection.tsx`**

1. Add state: `editingCampaignId` (string | null) to track which campaign is being edited

2. In the campaign list (line ~905-918), add an **Edit** button (with Pencil icon) for `draft` and `scheduled` campaigns, between "View" and "Send". It will:
   - Call `loadCampaignToEditor(c)` to populate subject/html/prompt/segment
   - Set `editingCampaignId = c.id`
   - If the campaign has a `scheduled_at`, pre-populate the schedule date/time fields and open the scheduler

3. Add an `updateCampaignMutation` that calls:
   ```ts
   supabase.from("email_campaigns").update({
     subject, html_body, segment, prompt, scheduled_at
   }).eq("id", editingCampaignId)
   ```

4. In the Send/Schedule area (line ~760-800), when `editingCampaignId` is set:
   - Show a "Save Changes" button instead of (or alongside) "Send Now"
   - The schedule "Confirm Schedule" button will update instead of insert
   - After saving, clear `editingCampaignId` and show a success toast

5. Add a banner at the top of the Create tab when editing, showing "Editing: [subject]" with a cancel link to clear editing state

6. Clear `editingCampaignId` when the user switches away from the create tab or starts a fresh generation

No database changes needed -- the existing RLS policy already allows managers/directors to update `email_campaigns`.

