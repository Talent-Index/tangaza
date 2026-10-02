/** How people reach the founder. WhatsApp is shown only when a link is configured. */
export const CONTACT = {
  email: "danielmwihoti@ubutangaza.biz",
  /** e.g. https://wa.me/2547XXXXXXXX — set NEXT_PUBLIC_WHATSAPP_URL; hidden when blank. */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim() || null,
} as const;
