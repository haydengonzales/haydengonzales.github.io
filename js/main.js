import { site, projects, reviews, reviewsBackground } from "./content.js";
import { WavePlayer, ABPlayer, setUiSound, uiSound, resume, onStateChange, getContext, pauseAll } from "./audio.js";
import { heroScope, drawCover } from "./visuals.js";
import { spatialLab } from "./spatial.js";

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- static content ----------

$("#heroLede").textContent = site.lede;
$("#year").textContent = new Date().getFullYear();
$("#aboutBio").innerHTML = site.bio.map(p => `<p>${esc(p)}</p>`).join("");
if (site.photo) {
  $("#aboutPhoto img").src = site.photo;
  $("#aboutPhoto").hidden = false;
}
$("#aboutSkills").innerHTML = site.skills.map(s => `
  <div class="skill-group">
    <h3>${esc(s.group)}</h3>
    <ul class="tags">${s.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
  </div>`).join("");
$("#contactLinks").innerHTML = [
  site.email && `<a class="btn btn--primary" href="mailto:${esc(site.email)}">${esc(site.email)}</a>`,
  ...site.links.map(l => `<a class="btn" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} <span aria-hidden="true">↗</span></a>`),
].filter(Boolean).join("");

// ---------- reviews ----------

$("#reviewsGrid").innerHTML = reviews.map(r => `
  <figure class="review">
    <svg class="review__mark" viewBox="0 0 32 24" aria-hidden="true"><path d="M0 24V14C0 6 4 1.5 12 0l1.5 3C9 4.5 7 7.5 7 11h6v13zm18 0V14c0-8 4-12.5 12-14l1.5 3C27 4.5 25 7.5 25 11h6v13z"/></svg>
    <blockquote>${esc(r.quote)}</blockquote>
    <figcaption><strong>${esc(r.name)}</strong><span class="mono">${esc(r.role)}</span></figcaption>
  </figure>`).join("");
const reviewsBg = $("#reviewsBg");
if (reviewsBackground.video) {
  reviewsBg.insertAdjacentHTML("afterbegin", `<video src="${esc(reviewsBackground.video)}" autoplay muted loop playsinline></video>`);
  reviewsBg.classList.add("has-video");
} else if (reviewsBackground.image) {
  // Resolve against the page; a url() inside a custom property resolves against the stylesheet.
  reviewsBg.style.setProperty("--bg-image", `url("${new URL(reviewsBackground.image, document.baseURI)}")`);
}

// ---------- project grid ----------

const HUES = [20, 195, 280, 140];
const grid = $("#projectGrid");
const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
projects.forEach((p, i) => {
  // The thumbnail plays the project's video; the rest of the card opens its page.
  const hasPage = !p.comingSoon && !p.videoOnly;
  const openPage = () => { location.hash = `#/${p.id}`; };
  const badge = p.comingSoon ? p.badge || "In progress" : !p.video && p.videoOnly ? "Video coming soon" : "";
  const mediaTag = p.video || hasPage ? "button" : "div";
  const card = document.createElement("article");
  card.className = "card";
  if (!p.video && !hasPage) card.setAttribute("aria-disabled", "true");
  card.innerHTML = `
    <${mediaTag} class="card__media"${mediaTag === "button" ? ` aria-label="${p.video ? "Play" : "Open"} ${esc(p.title)}${p.video ? " video" : ""}"` : ""}>
      ${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : `<canvas aria-hidden="true"></canvas>`}
      ${p.hoverVideo ? `<video src="${esc(p.hoverVideo)}" muted loop playsinline preload="none"></video>` : ""}
      ${p.video ? `<span class="card__play" aria-hidden="true">${PLAY}</span>` : ""}
      ${badge ? `<span class="badge mono">${esc(badge)}</span>` : ""}
    </${mediaTag}>
    <div class="card__body">
      <div class="card__meta mono"><span>${esc(p.category)}</span><span>${esc(p.year)}</span></div>
      <h3 class="card__title">${esc(p.title)}</h3>
      <p class="card__summary">${esc(p.summary)}</p>
      <ul class="tags">${p.tags.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      ${hasPage ? `<a class="card__more" href="#/${esc(p.id)}">Project details →</a>` : ""}
    </div>`;
  grid.append(card);
  card.querySelector(".card__media").addEventListener("click", () => {
    if (p.video) playVideo(p);
    else if (hasPage) openPage();
  });
  if (hasPage) {
    card.querySelector(".card__body").addEventListener("click", e => { if (!e.target.closest("a")) openPage(); });
    card.classList.add("card--linked");
  }
  const cv = card.querySelector("canvas");
  if (cv) requestAnimationFrame(() => drawCover(cv, p.id, HUES[i % HUES.length]));
  const vid = card.querySelector("video");
  if (vid) {
    card.addEventListener("mouseenter", () => vid.play().catch(() => {}));
    card.addEventListener("mouseleave", () => vid.pause());
  }
  card.addEventListener("mouseenter", () => uiSound("tick"));
});

// ---------- video player ----------

const videoDialog = $("#videoDialog");
function playVideo(p) {
  pauseAll();
  lab.stop();
  $("#videoTitle").textContent = p.title;
  $("#videoFrame").innerHTML = videoBlock(p.video, p.title, true);
  videoDialog.showModal();
  uiSound("open");
}
// Emptying the frame on close is what stops playback.
videoDialog.addEventListener("close", () => { $("#videoFrame").innerHTML = ""; });
videoDialog.addEventListener("click", e => { if (e.target === videoDialog) videoDialog.close(); });
$("#videoClose").addEventListener("click", () => videoDialog.close());

// ---------- project detail ----------

const dialog = $("#projectDialog");
const body = $("#projectBody");
let mounted = [];

function videoBlock(v, title, autoplay = false) {
  if (!v) return "";
  const auto = autoplay ? "&autoplay=1" : "";
  if (v.provider === "vimeo") return `<div class="video"><iframe src="https://player.vimeo.com/video/${esc(v.id)}?dnt=1&title=0&byline=0&portrait=0&color=ff6a2b${auto}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(title)}"></iframe></div>`;
  if (v.provider === "youtube") return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.id)}?rel=0&modestbranding=1${auto}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${esc(title)}"></iframe></div>`;
  return `<div class="video"><video src="${esc(v.src)}" ${v.poster ? `poster="${esc(v.poster)}"` : ""} ${autoplay ? "autoplay " : ""}controls playsinline preload="metadata"></video></div>`;
}

function openProject(id) {
  const p = projects.find(x => x.id === id && !x.comingSoon);
  if (!p) return closeProject();
  unmount();
  body.innerHTML = `
    <div class="project__top">
      <span class="mono eyebrow" style="margin:0">${esc(p.category)}</span>
      <button class="project__close" id="closeProject">Close ✕</button>
    </div>
    <h2 id="projectTitle">${esc(p.title)}</h2>
    <p class="project__subtitle">${esc(p.subtitle)}</p>
    <dl class="facts" style="--n:${(p.facts || []).length}">${(p.facts || []).map(([k, v]) => `<div><dt class="mono">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${p.links?.length ? `<div class="project__links">${p.links.map(l => `<a class="btn btn--primary" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join("")}</div>` : ""}
    ${videoBlock(p.video, p.title)}
    <div data-compare hidden><h3 class="block-title">Before / after</h3><p class="block-sub">Both versions play in sync. Switch at any point to compare the same moment.</p><div class="stack"></div></div>
    <div class="prose">${p.body || ""}</div>
    ${p.demo ? `<div data-demo><h3 class="block-title">Try it: Atmos panner</h3><p class="block-sub">The same idea by hand: drag a sound around the room, raise it toward the ceiling and hear it move, in the X/Y/Z coordinates the tool exports. It renders binaurally, so use headphones; on speakers it plays as plain stereo.</p></div>` : ""}
    <div data-audio hidden><h3 class="block-title">Listen</h3><p class="block-sub">Click the waveform to seek.</p><div class="stack"></div></div>
    ${p.gallery?.length ? `<h3 class="block-title">Gallery</h3><div class="gallery">${p.gallery.map(g => `<figure class="figure"><img src="${esc(g.src)}" alt="${esc(g.caption || "")}" loading="lazy"><figcaption>${esc(g.caption || "")}</figcaption></figure>`).join("")}</div>` : ""}
  `;
  // Only show players whose files exist, so unfinished slots stay invisible.
  mountPlayers(body.querySelector("[data-audio]"), p.audio, a => [a.src], a => new WavePlayer(a));
  // The panner is built once on load; it moves into whichever page shows it.
  body.querySelector("[data-demo]")?.append($("#labEmbed"));
  mountPlayers(body.querySelector("[data-compare]"), p.compare, c => [c.a.src, c.b.src], c => new ABPlayer(c));
  body.querySelector("#closeProject").addEventListener("click", () => { location.hash = "#work"; });
  if (!dialog.open) { dialog.showModal(); uiSound("open"); }
  dialog.scrollTop = 0;
  document.title = `${p.title} — ${site.name}`;
  requestAnimationFrame(() => body.querySelectorAll("canvas[data-cover]").forEach(c => drawCover(c, p.id, 20)));
}

const exists = src => fetch(src, { method: "HEAD" }).then(r => r.ok, () => false);

async function mountPlayers(block, items = [], sources, create) {
  const ready = await Promise.all(items.map(async it => (await Promise.all(sources(it).map(exists))).every(Boolean)));
  if (!block.isConnected) return; // another project was opened meanwhile
  const stack = block.querySelector(".stack");
  items.forEach((it, i) => {
    if (!ready[i]) return;
    const pl = create(it);
    stack.append(pl.el);
    mounted.push(pl);
  });
  block.hidden = !stack.children.length;
}

function unmount() {
  pauseAll();
  lab.stop();
  $("#labHome").append($("#labEmbed"));
  mounted.forEach(m => m.destroy?.());
  mounted = [];
}

function closeProject() {
  if (!dialog.open) return;
  unmount();
  dialog.close();
  uiSound("close");
  document.title = `${site.name} — ${site.role}`;
}

dialog.addEventListener("cancel", e => { e.preventDefault(); location.hash = "#work"; });
dialog.addEventListener("click", e => { if (e.target === dialog) location.hash = "#work"; });

function route() {
  const m = location.hash.match(/^#\/([\w-]+)/);
  if (m) openProject(m[1]); else closeProject();
}
addEventListener("hashchange", route);

// ---------- engine status + UI sound toggle ----------

const dot = $("#engineDot"), status = $("#engineStatus");
onStateChange(state => {
  const live = state === "running";
  dot.classList.toggle("is-live", live);
  status.textContent = live ? "Audio engine live" : "Audio engine on standby";
});

const toggle = $("#soundToggle");
toggle.addEventListener("click", async () => {
  const on = toggle.getAttribute("aria-pressed") !== "true";
  toggle.setAttribute("aria-pressed", String(on));
  toggle.querySelector(".sound-toggle__label").textContent = on ? "UI sound on" : "UI sound off";
  getContext();
  setUiSound(on);
  await resume();
  uiSound("toggle");
});
document.querySelectorAll(".btn, .nav__links a").forEach(el => el.addEventListener("mouseenter", () => uiSound("tick")));

// ---------- visuals ----------

heroScope($("#heroScope"), { l: $("#meterL"), r: $("#meterR") });

const lab = spatialLab({
  canvas: $("#labCanvas"),
  play: $("#labPlay"),
  source: $("#labSource"),
  file: $("#labFile"),
  height: $("#labHeight"),
  heightOut: $("#labHeightOut"),
  orbit: $("#labOrbit"),
  ro: { x: $("#roX"), y: $("#roY"), z: $("#roZ"), az: $("#roAz"), el: $("#roEl"), dist: $("#roDist") },
});

// Open a project linked by URL once everything it may mount exists.
route();
