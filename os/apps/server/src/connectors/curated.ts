// The first list of apps people see. The slugs were checked against the provider's
// catalogue. Each line says only what Debo does for real: it can look things up, and
// anything that changes something waits for the person's yes.

export interface Curated {
  slug: string;
  name: string;
  blurb: string;
  /** Debo's built-in Google connection already reaches this app. */
  google?: boolean;
}

const ASK = "Anything that changes something waits for your yes.";

export const CURATED: Curated[] = [
  {
    slug: "gmail",
    name: "Gmail",
    google: true,
    blurb: `Search and read your email. Sending, replying or deleting waits for your yes.`,
  },
  {
    slug: "googlecalendar",
    name: "Google Calendar",
    google: true,
    blurb: `Look at your events and free time. Adding, changing or cancelling an event waits for your yes.`,
  },
  {
    slug: "googledrive",
    name: "Google Drive",
    blurb: `Find and read your files. Creating, sharing or deleting a file waits for your yes.`,
  },
  {
    slug: "googledocs",
    name: "Google Docs",
    blurb: `Read your documents. Writing or editing one waits for your yes.`,
  },
  {
    slug: "googlesheets",
    name: "Google Sheets",
    blurb: `Read your spreadsheets. Changing a cell or sheet waits for your yes.`,
  },
  {
    slug: "notion",
    name: "Notion",
    blurb: `Search and read your pages. Creating or editing a page waits for your yes.`,
  },
  {
    slug: "slack",
    name: "Slack",
    blurb: `Read channels and messages you can see. Posting a message waits for your yes.`,
  },
  {
    slug: "github",
    name: "GitHub",
    blurb: `Look at repositories, issues and pull requests. Opening, commenting or merging waits for your yes.`,
  },
  {
    slug: "linear",
    name: "Linear",
    blurb: `Look up your issues and projects. Creating or changing an issue waits for your yes.`,
  },
  {
    slug: "outlook",
    name: "Outlook",
    blurb: `Search and read your email and calendar. Sending or changing anything waits for your yes.`,
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    blurb: `Uses a WhatsApp Business account. Sending a message waits for your yes.`,
  },
  {
    slug: "telegram",
    name: "Telegram",
    blurb: `Uses a Telegram bot. Sending a message waits for your yes.`,
  },
  {
    slug: "spotify",
    name: "Spotify",
    blurb: `Look at your playlists and what you listen to. Changing a playlist or playback waits for your yes.`,
  },
  {
    slug: "youtube",
    name: "YouTube",
    blurb: `Search videos and look at your channel and playlists. Uploading or changing anything waits for your yes.`,
  },
  {
    slug: "todoist",
    name: "Todoist",
    blurb: `Look at your tasks and projects. Adding, finishing or deleting a task waits for your yes.`,
  },
  {
    slug: "trello",
    name: "Trello",
    blurb: `Look at your boards and cards. Creating, moving or deleting a card waits for your yes.`,
  },
];

/** The line for an app that is not in the first list. */
export function genericBlurb(name: string) {
  return `Debo can look things up in ${name} for you. ${ASK}`;
}
