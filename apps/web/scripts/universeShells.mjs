/**
 * Shells HTML de /lab/universes para el prerender.
 *
 * Lee src/lab/universes/content/<slug>/game.json (Node fs; sin fixtures),
 * conserva los `published` y emite un shell por ruta, con el mismo formato
 * de clases Tailwind que el shell de /lab/trymate en prerender.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../src/lab/universes/content");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MAIN =
  '<main id="main-content" tabindex="-1" class="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)] py-20">';
const KICKER = '<p class="font-ui text-xs uppercase tracking-widest text-gold-bright">Lab</p>';
const H1 = 'mt-2 font-display text-3xl font-bold text-ink';
const LEAD = "mt-2 font-ui text-base leading-relaxed text-ink-dim";
const LINK =
  "border-b border-ink font-ui text-ink transition-colors hover:border-gold hover:text-gold";

function publishedGames() {
  if (!fs.existsSync(contentDir)) return [];
  const games = [];
  for (const dirent of fs.readdirSync(contentDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const gamePath = path.join(contentDir, dirent.name, "game.json");
    if (!fs.existsSync(gamePath)) continue;
    try {
      const game = JSON.parse(fs.readFileSync(gamePath, "utf8"));
      if (game.status === "published" && game.slug === dirent.name) games.push(game);
    } catch {
      console.warn(`universeShells: no se pudo leer ${gamePath}, se omite`);
    }
  }
  return games.sort((a, b) =>
    (a.title?.default ?? "").localeCompare(b.title?.default ?? ""),
  );
}

function pageShell({ title, body }) {
  return `${MAIN}${KICKER}<h1 class="${H1}">${escapeHtml(title)}</h1>${body}</main>`;
}

function universeShell(games) {
  const items = games
    .map(
      (g) =>
        `<li class="mt-4"><a href="/lab/universes/${escapeHtml(g.slug)}" class="${LINK}">${escapeHtml(g.title?.default ?? g.slug)}</a><p class="mt-1 font-ui text-sm leading-relaxed text-ink-dim">${escapeHtml(g.description?.default ?? "")}</p></li>`,
    )
    .join("");
  const list = games.length
    ? `<ul class="mt-6">${items}</ul>`
    : `<p class="${LEAD}">Todavía no hay universos publicados.</p>`;
  return {
    route: "/lab/universes",
    title: "Universos — Fernando Pailhe",
    html: pageShell({
      title: "Universos",
      body: `<p class="${LEAD}">Historias de decisiones. Cada universo es un juego interactivo que requiere JavaScript.</p>${list}`,
    }),
  };
}

function gameShell(game, suffix, heading, backLabel) {
  const base = `/lab/universes/${game.slug}`;
  return {
    route: `${base}${suffix}`,
    title: `${game.title?.default ?? game.slug} — Universos — Fernando Pailhe`,
    html: pageShell({
      title: heading,
      body: `<p class="${LEAD}">${escapeHtml(game.description?.default ?? "")}</p><p class="${LEAD}">Este universo interactivo requiere JavaScript.</p><p class="mt-6"><a href="${base}" class="${LINK}">${escapeHtml(backLabel)}</a></p>`,
    }),
  };
}

/** Shells de prerender: la lista + home/jugar/final de cada universo publicado. */
export function buildUniverseShells() {
  const games = publishedGames();
  const shells = [universeShell(games)];
  for (const game of games) {
    const title = game.title?.default ?? game.slug;
    shells.push(
      gameShell(game, "", title, "← Volver"),
      gameShell(game, "/jugar", `${title} — partida`, "← Volver"),
      gameShell(game, "/final", `${title} — final`, "← Volver"),
    );
  }
  return shells;
}
