export const GITHUB_PWA_NAME = "CR3@TIX ADVENTURE";

function normalizeBase(base: string) {
  const withLeadingSlash = base.startsWith("/") ? base : `/${base}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function createGithubPwaManifest(base: string) {
  const appBase = normalizeBase(base);

  return {
    id: appBase,
    name: GITHUB_PWA_NAME,
    short_name: "CR3@TIX",
    description: "Jeu de plateforme et de combat en 110 niveaux avec 10 boss uniques.",
    lang: "fr",
    start_url: `${appBase}?source=installed-app`,
    scope: appBase,
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "landscape",
    background_color: "#02030b",
    theme_color: "#02030b",
    categories: ["games", "entertainment"],
    prefer_related_applications: false,
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
