/**
 * Guides: plain how-to pages for business owners (/guides/<slug>).
 *
 * A guide is data, not markup, so every guide looks the same and a writer cannot break
 * the layout. Text fields marked "inline" accept two bits of markup and nothing else:
 *   **bold**            for the one phrase in a paragraph that must stand out
 *   [label](/path)      a link; site paths start with "/", outside links with "https://"
 */

/** A paragraph. Inline markup allowed. */
export interface ParagraphBlock {
  type: "p";
  text: string;
}

/** A bulleted list. Inline markup allowed in each item. */
export interface ListBlock {
  type: "list";
  items: string[];
}

/** Numbered steps, each with a short title and one or two sentences. Inline markup allowed in `text`. */
export interface StepsBlock {
  type: "steps";
  items: { title: string; text: string }[];
}

/**
 * A worked example shown as a card, e.g. a sample campaign for a salon.
 * `rows` are label/value pairs such as ["Reward", "KES 200 airtime"]. Plain text only.
 */
export interface ExampleBlock {
  type: "example";
  title: string;
  rows: [label: string, value: string][];
  /** One line under the card, e.g. what the owner should watch for. Inline markup allowed. */
  note?: string;
}

/** Text a reader can copy and send, e.g. a WhatsApp message. Plain text; line breaks are kept. */
export interface TemplateBlock {
  type: "template";
  label: string;
  text: string;
}

/** A small comparison table. Plain text cells. Keep it to 2-4 columns so it fits a phone. */
export interface TableBlock {
  type: "table";
  head: string[];
  rows: string[][];
}

/** A highlighted tip or warning. Inline markup allowed. */
export interface NoteBlock {
  type: "note";
  text: string;
}

export type GuideBlock =
  | ParagraphBlock
  | ListBlock
  | StepsBlock
  | ExampleBlock
  | TemplateBlock
  | TableBlock
  | NoteBlock;

export interface GuideSection {
  /** Anchor for the "On this page" links: lowercase words joined by hyphens, unique in the guide. */
  id: string;
  /** Shown as an H2. */
  heading: string;
  blocks: GuideBlock[];
}

export interface Guide {
  /** The URL: /guides/<slug>. Lowercase words joined by hyphens. */
  slug: string;
  /** The H1. Says what the reader will be able to do. */
  title: string;
  /** The search-result title, without the brand (the site adds " | Ubu-Tangaza"). At most 48 characters. */
  metaTitle: string;
  /** The search-result description. 120-155 characters, plain text. */
  description: string;
  /** One line for the card on /guides. Plain text, at most 110 characters. */
  summary: string;
  /** Who it is for, shown above the title, e.g. "For salons and barbershops". */
  audience: string;
  /** Dates as YYYY-MM-DD. */
  published: string;
  updated: string;
  /** Opening paragraphs, before the first heading. The first one answers the search directly. Inline markup allowed. */
  intro: string[];
  sections: GuideSection[];
  /** Questions people ask about this topic. Plain text answers, two or three sentences each. */
  faqs: { q: string; a: string }[];
  /** Slugs of other guides to read next. */
  related: string[];
}
