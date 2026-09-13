/**
 * Prerender estático de / y /cv.
 *
 * Corre después de `vite build`: lee los mismos JSON que consume la app
 * (public/data), genera HTML semántico con las mismas clases Tailwind
 * que usan los componentes React e inyecta el contenido en
 * <div id="root"> de dist/index.html y dist/cv/index.html.
 *
 * La SPA sigue funcionando igual: createRoot reemplaza el contenido
 * estático al montar. Sin JavaScript, crawlers y lectores de pantalla
 * ven el contenido real.
 *
 * Nota: las funciones de dominio están duplicadas acá a propósito
 * (espejo de packages/data-model/src/{domain,format}.ts). El dist del
 * paquete usa imports sin extensión (moduleResolution Bundler), que
 * Node ESM no resuelve; son funciones chicas y estables.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- Espejo de @ferpa/data-model (mantener en sync) ---

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthYear(date) {
  const [year, month] = date.split("-");
  const monthIndex = parseInt(month ?? "1", 10) - 1;
  return `${MONTHS[monthIndex] ?? month} ${year}`;
}

function formatDateRange(start, end) {
  const endText = end === null ? "Present" : formatMonthYear(end);
  return `${formatMonthYear(start)} — ${endText}`;
}

function getFeaturedProjects(projects) {
  return projects.filter((p) => p.featured);
}

function getJobProjects(job, projects) {
  const ids = new Set(job.projectIds ?? []);
  return projects.filter((p) => ids.has(p.id));
}

function sortJobsByDateDesc(jobs) {
  return [...jobs].sort((a, b) => {
    const aEnd = a.endDate ?? "9999-12";
    const bEnd = b.endDate ?? "9999-12";
    if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
    return b.startDate.localeCompare(a.startDate);
  });
}

// --- fin espejo ---

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const distDir = path.join(appDir, "dist");
const dataDir = path.join(appDir, "public", "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), "utf8"));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LINK_LABELS = {
  appStore: "App Store",
  playStore: "Play Store",
  github: "GitHub",
  website: "Website",
};

function projectLinks(project) {
  if (Array.isArray(project.links) && project.links.length > 0) {
    return project.links.map((l) => ({
      label: l.label ?? LINK_LABELS[l.type] ?? "Link",
      url: l.url,
    }));
  }
  if (project.link) return [{ label: "Website", url: project.link }];
  return [];
}

function screenshotUrl(project) {
  const shot = project.screenshot;
  if (!shot) return null;
  const rel = shot.startsWith("/") ? shot : `/${shot}`;
  // Solo referenciar si el archivo existe en dist (vite copió public/).
  return fs.existsSync(path.join(distDir, rel.replace(/^\//, ""))) ? rel : null;
}

function textLink(href, label, external = true) {
  const attrs = external ? ' target="_blank" rel="noreferrer"' : "";
  const arrow = external ? '<span aria-hidden="true"> ↗</span>' : "";
  return `<a href="${escapeHtml(href)}"${attrs} class="border-b border-ink font-ui text-ink transition-colors hover:border-gold hover:text-gold">${escapeHtml(label)}${arrow}</a>`;
}

function navHtml(links) {
  const items = links
    .map(
      (l) =>
        `<li><a href="${escapeHtml(l.href)}" class="font-ui text-sm text-ink-dim transition-colors hover:text-ink">${escapeHtml(l.label)}</a></li>`,
    )
    .join("");
  return `<nav aria-label="Main navigation" class="no-print border-b border-line"><div class="mx-auto flex max-w-[880px] justify-end px-[clamp(20px,5vw,32px)] py-4"><ul class="flex items-center gap-6">${items}</ul></div></nav>`;
}

function projectCardHtml(project) {
  const links = projectLinks(project);
  const shot = screenshotUrl(project);
  const title = escapeHtml(project.name);
  const header =
    links.length > 0
      ? `<h3 class="font-display text-lg font-medium text-ink">${textLink(links[0].url, project.name)}</h3>`
      : `<h3 class="font-display text-lg font-medium text-ink">${title}</h3>`;
  const img = shot
    ? `<img src="${escapeHtml(shot)}" alt="${escapeHtml(project.name)} screenshot" class="mb-4 border border-line" />`
    : "";
  const context = project.context
    ? `<p class="mt-1 font-mono text-xs text-ink-faint">${escapeHtml(project.context)}</p>`
    : "";
  const linkList =
    links.length > 0
      ? `<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1">${links
          .map((l) => `<li>${textLink(l.url, l.label)}</li>`)
          .join("")}</ul>`
      : "";
  const tech = (project.tech ?? [])
    .map(
      (t) =>
        `<span class="border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">${escapeHtml(t)}</span>`,
    )
    .join(" ");
  return `<article class="flex h-full flex-col bg-surface-raised p-5">${img}<header>${header}${context}</header><p class="mt-3 flex-1 font-ui text-sm leading-relaxed text-ink-dim">${escapeHtml(project.description)}</p>${linkList}<footer class="mt-4 flex flex-wrap items-center gap-2"><span class="font-mono text-[11px] uppercase tracking-[0.1em] text-gold">${escapeHtml(project.status)}</span>${tech}</footer></article>`;
}

function renderHome(data) {
  const { profile, hero, stats, howIWork, aboutAside, projects, contact } = data;
  const photoRel = aboutAside.photo ?? "";
  const photoPath = path.join(distDir, photoRel.replace(/^\//, ""));
  const photoHtml = fs.existsSync(photoPath)
    ? `<img src="/${escapeHtml(photoRel.replace(/^\/+/, ""))}" alt="Portrait of Fernando Pailhe" class="w-full max-w-[220px] border border-line" />`
    : `<span class="inline-flex aspect-square w-full max-w-[220px] items-center justify-center border border-line bg-gold-soft font-display text-gold" role="img" aria-label="FP initials avatar">FP</span>`;

  const ctas = (hero.ctas ?? [])
    .map((c) => textLink(c.href, c.label, Boolean(c.external)))
    .join("");
  const statsHtml = (stats ?? [])
    .map(
      (s) =>
        `<div class="bg-surface-raised px-5 py-6"><div class="font-mono text-[clamp(2rem,4vw,2.6rem)] font-semibold leading-none text-ink">${escapeHtml(s.value)}</div><div class="mt-3 font-ui text-sm font-medium text-ink">${escapeHtml(s.label)}</div><div class="mt-1 font-ui text-xs text-ink-dim">${escapeHtml(s.sublabel)}</div></div>`,
    )
    .join("");
  const panels = (howIWork.panels ?? [])
    .map(
      (p, i) =>
        `<li class="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-6"><span class="pt-1 font-mono text-xs text-ink-faint">${String(i + 1).padStart(2, "0")}</span><div class="min-w-0"><h3 class="font-display text-lg font-medium text-ink">${escapeHtml(p.heading)}</h3><p class="mt-2 font-ui text-sm leading-relaxed text-ink-dim">${escapeHtml(p.body)}</p></div></li>`,
    )
    .join("");
  const featured = getFeaturedProjects(projects ?? []);
  const cards = featured.map(projectCardHtml).join("");

  const nav = navHtml([
    { label: "Home", href: "/" },
    { label: "Work", href: "#work" },
    { label: "Projects", href: "#projects" },
    { label: "CV", href: "/cv" },
    { label: "Contact", href: "#contact" },
  ]);

  return `${nav}<main id="main-content" tabindex="-1" class="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]"><section class="pb-16 pt-20"><p class="font-mono text-xs uppercase tracking-[0.12em] text-ink-faint">${escapeHtml(hero.kicker)}</p><h1 class="mt-6 font-display text-[clamp(2.3rem,5.5vw,4.3rem)] font-medium leading-[1.14] text-ink">${escapeHtml(hero.headlineLead)} <em class="text-gold">${escapeHtml(hero.headlineEmphasis)}</em></h1><p class="mt-6 max-w-[62ch] font-ui text-base leading-relaxed text-ink-dim">${escapeHtml(hero.subhead)}</p><div class="mt-8 flex flex-wrap gap-6">${ctas}</div></section></main><section class="border-y border-line bg-surface-raised"><div class="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]"><div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px bg-line">${statsHtml}</div></div></section><main class="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]"><section id="work" class="py-16"><h2 class="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">How I work</h2><ol class="mt-6">${panels}</ol><p class="mt-4 max-w-[62ch] font-ui text-sm leading-relaxed text-ink-dim">${escapeHtml(howIWork.closingNote)}</p></section><section class="border-t border-line py-16"><div class="grid grid-cols-[1fr_220px] items-start gap-8"><p class="font-ui text-base leading-relaxed text-ink-dim">${escapeHtml(aboutAside.text)}</p>${photoHtml}</div></section><section id="projects" class="py-16"><h2 class="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">Projects</h2><div class="mt-6 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-px border border-line bg-line">${cards}</div></section></main><section id="contact" class="bg-parchment py-20 text-parchment-ink"><div class="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]"><h2 class="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium">${escapeHtml(contact.heading)}</h2><p class="mt-4 max-w-[60ch] font-ui text-base leading-relaxed text-parchment-ink-dim">${escapeHtml(contact.body)}</p><a href="mailto:${escapeHtml(profile.email)}" class="mt-8 inline-block border-b border-parchment-ink font-ui text-base text-parchment-ink">${escapeHtml(profile.email)}</a></div></section>`;
}

function jobHtml(job, projects) {
  const dateRange = formatDateRange(job.startDate, job.endDate ?? null);
  const location = job.location ? ` · ${escapeHtml(job.location)}` : "";
  const bullets = (job.bullets ?? [])
    .map((b) => `<li class="font-ui text-sm leading-relaxed text-ink-dim">${escapeHtml(b)}</li>`)
    .join("");
  const bulletsHtml = bullets ? `<ul class="mt-3 list-disc space-y-1.5 pl-5">${bullets}</ul>` : "";
  const tech = (job.tech ?? [])
    .map(
      (t) =>
        `<span class="border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">${escapeHtml(t)}</span>`,
    )
    .join(" ");
  const techHtml = tech ? `<div class="mt-3 flex flex-wrap gap-2">${tech}</div>` : "";
  const related = getJobProjects(job, projects ?? []);
  const relatedHtml =
    related.length > 0
      ? `<p class="mt-3 font-mono text-xs text-ink-faint">Projects: ${related.map((p) => escapeHtml(p.name)).join(" · ")}</p>`
      : "";
  return `<div class="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-6"><div class="pt-1 font-mono text-xs leading-relaxed text-ink-faint">${escapeHtml(dateRange)}</div><div class="min-w-0"><h3 class="font-display text-lg font-medium text-ink">${escapeHtml(job.title)}</h3><p class="mt-0.5 font-ui text-sm text-ink-dim">${escapeHtml(job.company)}${location}</p>${bulletsHtml}${techHtml}${relatedHtml}</div></div>`;
}

function renderCV(data) {
  const { profile, experience, education, courses, projects } = data;
  const jobs = sortJobsByDateDesc(experience ?? [])
    .map((j) => jobHtml(j, projects))
    .join("");
  const edu = (education ?? [])
    .map(
      (e) =>
        `<div class="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-5"><span class="pt-1 font-mono text-xs text-ink-faint">${escapeHtml(formatDateRange(e.startDate, e.endDate))}</span><div class="min-w-0"><h3 class="font-ui text-sm font-semibold text-ink">${escapeHtml(e.degree)}</h3><p class="mt-0.5 font-ui text-sm text-ink-dim">${escapeHtml(e.institution)}</p></div></div>`,
    )
    .join("");
  const courseItems = (courses ?? [])
    .map(
      (c) =>
        `<li class="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-4"><span class="pt-0.5 font-mono text-xs text-ink-faint">${escapeHtml(c.date)}</span><div class="min-w-0"><h3 class="font-ui text-sm font-semibold text-ink">${escapeHtml(c.name)}</h3><p class="mt-0.5 font-ui text-sm text-ink-dim">${escapeHtml(c.institution)}</p></div></li>`,
    )
    .join("");

  const nav = navHtml([
    { label: "Home", href: "/" },
    { label: "CV", href: "/cv" },
  ]);

  return `${nav}<main id="main-content" tabindex="-1" class="mx-auto max-w-[760px] px-[clamp(20px,5vw,32px)] pb-16"><header class="border-b border-line py-12"><h1 class="font-display text-3xl font-medium text-ink">${escapeHtml(profile.name)}</h1><p class="mt-2 font-ui text-base text-ink-dim">${escapeHtml(profile.role)} — ${escapeHtml(profile.location)} · ${escapeHtml(profile.remoteNote)}</p><div class="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-faint"><a href="mailto:${escapeHtml(profile.email)}" class="hover:text-ink">${escapeHtml(profile.email)}</a><a href="${escapeHtml(profile.linkedin)}" target="_blank" rel="noreferrer" class="hover:text-ink">LinkedIn</a><a href="${escapeHtml(profile.github)}" target="_blank" rel="noreferrer" class="hover:text-ink">GitHub</a><span>${escapeHtml(profile.domain)}</span></div></header><section class="py-16"><h2 class="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">Experience</h2><div class="mt-6">${jobs}</div></section><section class="py-16"><h2 class="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">Education</h2><div class="mt-6">${edu}</div></section><section class="py-16"><h2 class="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">Courses</h2><ul class="mt-6">${courseItems}</ul></section></main>`;
}

function main() {
  const templatePath = path.join(distDir, "index.html");
  const template = fs.readFileSync(templatePath, "utf8");
  if (!template.includes('<div id="root"></div>')) {
    throw new Error('prerender: dist/index.html no contiene <div id="root"></div>');
  }

  const data = {
    profile: readJson("profile"),
    hero: readJson("hero"),
    stats: readJson("stats"),
    howIWork: readJson("how-i-work"),
    aboutAside: readJson("about-aside"),
    projects: readJson("projects"),
    experience: readJson("experience"),
    education: readJson("education"),
    courses: readJson("courses"),
    contact: readJson("contact"),
  };

  const pages = [
    { route: "/", html: renderHome(data) },
    { route: "/cv", html: renderCV(data) },
  ];

  for (const { route, html } of pages) {
    const outDir = route === "/" ? distDir : path.join(distDir, route.replace(/^\//, ""));
    fs.mkdirSync(outDir, { recursive: true });
    const output = template.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
    fs.writeFileSync(path.join(outDir, "index.html"), output, "utf8");
  }

  console.log("Prerendered / and /cv");
}

main();
