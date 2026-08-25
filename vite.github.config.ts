import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createGithubPwaManifest } from "./github-pages/pwaManifest";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "CR3-TIX-ADVENTURE-";
const base = process.env.GITHUB_ACTIONS === "true" ? `/${repositoryName}/` : "/";
const githubManifest = createGithubPwaManifest(base);

export default defineConfig({
  root: "github-pages",
  base,
  publicDir: "../public",
  plugins: [
    react(),
    {
      name: "cr3atix-github-pwa-manifest",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest-github.webmanifest",
          source: `${JSON.stringify(githubManifest, null, 2)}\n`,
        });
      },
    },
  ],
  build: {
    outDir: "../gh-pages-dist",
    emptyOutDir: true,
  },
  preview: {
    host: "0.0.0.0",
  },
});
