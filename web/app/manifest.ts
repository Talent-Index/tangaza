import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

/**
 * /manifest.webmanifest: the name, colours and icon a phone uses when someone saves
 * the site to their home screen. `display: "browser"` keeps a saved shortcut opening
 * in the normal browser, exactly as it does without this file.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "browser",
    // The dark look's page colour, same as the viewport themeColor in app/layout.tsx.
    background_color: "#131008",
    theme_color: "#131008",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
