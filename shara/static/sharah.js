const DEMO_CARDS = [
  {
    id: "1",
    platform: "facebook",
    duration: "00:25",
    title: "مشاهد الغروب",
    category: "سفر",
    date: "2024-05-24",
    thumb: "radial-gradient(420px 240px at 30% 30%, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 55%), linear-gradient(135deg, #ffb703, #fb8500 45%, #0b1320)",
  },
  {
    id: "2",
    platform: "facebook",
    duration: "00:18",
    title: "تحدي الرقص 2024",
    category: "لياقة",
    date: "2024-05-24",
    thumb: "radial-gradient(360px 220px at 30% 40%, rgba(147, 51, 234, 0.55), rgba(147, 51, 234, 0) 60%), linear-gradient(135deg, #111827, #4f46e5 55%, #0ea5e9)",
  },
  {
    id: "3",
    platform: "facebook",
    duration: "00:12",
    title: "لحظات كلب مضحكة",
    category: "حيوانات",
    date: "2024-05-24",
    thumb: "radial-gradient(380px 240px at 35% 35%, rgba(245, 158, 11, 0.52), rgba(245, 158, 11, 0) 60%), linear-gradient(135deg, #1f2937, #b45309 55%, #f59e0b)",
  },
  {
    id: "4",
    platform: "facebook",
    duration: "00:30",
    title: "أفكار فطور صحي",
    category: "طعام",
    date: "2024-05-24",
    thumb: "radial-gradient(360px 260px at 35% 35%, rgba(34, 197, 94, 0.52), rgba(34, 197, 94, 0) 62%), linear-gradient(135deg, #0b1320, #16a34a 55%, #a3e635)",
  },
  {
    id: "5",
    platform: "facebook",
    duration: "00:15",
    title: "استكشاف الجبال",
    category: "سفر",
    date: "2024-05-24",
    thumb: "radial-gradient(400px 260px at 30% 35%, rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0) 62%), linear-gradient(135deg, #0b1320, #0284c7 55%, #22c55e)",
  },
  {
    id: "6",
    platform: "facebook",
    duration: "00:15",
    title: "ركوب الأمواج",
    category: "رياضة",
    date: "2024-05-23",
    thumb: "radial-gradient(420px 260px at 35% 35%, rgba(14, 165, 233, 0.5), rgba(14, 165, 233, 0) 60%), linear-gradient(135deg, #0b1320, #0ea5e9 55%, #38bdf8)",
  },
  {
    id: "7",
    platform: "facebook",
    duration: "00:35",
    title: "وصفة باستا سريعة",
    category: "طعام",
    date: "2024-05-22",
    thumb: "radial-gradient(380px 240px at 35% 30%, rgba(251, 146, 60, 0.52), rgba(251, 146, 60, 0) 60%), linear-gradient(135deg, #0b1320, #ea580c 55%, #fde68a)",
  },
  {
    id: "8",
    platform: "facebook",
    duration: "00:28",
    title: "عطلة في المدينة",
    category: "سفر",
    date: "2024-05-21",
    thumb: "radial-gradient(420px 240px at 32% 28%, rgba(244, 114, 182, 0.5), rgba(244, 114, 182, 0) 62%), linear-gradient(135deg, #0b1320, #db2777 55%, #f59e0b)",
  },
  {
    id: "9",
    platform: "facebook",
    duration: "00:18",
    title: "جولة في إعداد تقني",
    category: "تقنية",
    date: "2024-05-20",
    thumb: "radial-gradient(420px 260px at 30% 35%, rgba(139, 92, 246, 0.5), rgba(139, 92, 246, 0) 62%), linear-gradient(135deg, #0b1320, #7c3aed 55%, #06b6d4)",
  },
  {
    id: "10",
    platform: "facebook",
    duration: "00:45",
    title: "تمرين رياضي",
    category: "رياضة",
    date: "2024-05-19",
    thumb: "radial-gradient(420px 260px at 35% 35%, rgba(156, 163, 175, 0.5), rgba(156, 163, 175, 0) 62%), linear-gradient(135deg, #0b1320, #374151 55%, #111827)",
  },
];

const DESKTOP_PAGE_SIZE = 40;
const MOBILE_PAGE_SIZE = 20;
const MOBILE_PAGE_QUERY = "(max-width: 720px)";
const MAX_REELS_TO_LOAD = 10000;
const API_BASE = "/v01/api";
const DEFAULT_POPULAR_TAGS = ["طوب", "برطاشة", "قصارة", "لياسة", "دهان", "شباك", "المنيوم", "تدفئة", "تكييف", "تهوية", "شفاط", "مكيف", "جبصين", "بلاط"];

let CARDS = [...DEMO_CARDS];
let searchTimer = null;
let platformSettings = { facebook: true, tiktok: false };
let platformCounts = { facebook: 0, tiktok: 0 };

const state = {
  draft: { q: "", platform: "facebook", sort: "new" },
  applied: { q: "", platform: "facebook", sort: "new" },
  page: 1,
};

function $(id) {
  return document.getElementById(id);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalize(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .replace(/ـ/g, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ی/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/گ/g, "ك")
    .replace(/[^\w\u0621-\u064a\u0660-\u0669\u06f0-\u06f9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeArabic(value) {
  return normalize(value).split(" ").filter(Boolean);
}

function canonicalTag(value) {
  return tokenizeArabic(value)
    .map((token) => (token.startsWith("ال") && token.length > 4 ? token.slice(2) : token))
    .join(" ")
    .trim();
}

function tagMatchesQuery(tag, query) {
  const tagText = normalize(tag);
  const queryText = normalize(query);
  if (!queryText) return true;
  if (!tagText) return false;
  return tagText === queryText || canonicalTag(tagText) === canonicalTag(queryText);
}

function stripArabicPrefixes(term) {
  const variants = new Set([term]);
  const queue = [term];
  while (queue.length) {
    const current = queue.pop();
    const candidates = [];
    if (current.startsWith("ال") && current.length > 4) candidates.push(current.slice(2));
    if (["و", "ف"].includes(current[0]) && current.length > 3) candidates.push(current.slice(1));
    if (["ب", "ك", "ل"].includes(current[0]) && current.length > 5 && current.slice(1).startsWith("ال")) candidates.push(current.slice(1));
    for (const candidate of candidates) {
      if (candidate.length < 2 || variants.has(candidate)) continue;
      variants.add(candidate);
      queue.push(candidate);
    }
  }
  return variants;
}

function stripArabicSuffixes(term) {
  const variants = new Set([term]);
  const suffixes = ["تان", "تين", "ات", "ون", "ين", "ان", "ها", "هم", "نا", "ة", "ه"];
  const queue = [term];
  while (queue.length) {
    const current = queue.pop();
    for (const suffix of suffixes) {
      if (!current.endsWith(suffix) || current.length <= suffix.length + 1) continue;
      const candidate = current.slice(0, -suffix.length);
      if (candidate.length < 2 || variants.has(candidate)) continue;
      variants.add(candidate);
      queue.push(candidate);
    }
  }
  return variants;
}

function termVariants(term) {
  const bases = stripArabicPrefixes(term);
  const variants = new Set(bases);
  for (const base of bases) {
    const suffixVariants = stripArabicSuffixes(base);
    for (const value of suffixVariants) {
      variants.add(value);
      if (value.endsWith("ة")) {
        variants.add(`${value.slice(0, -1)}ه`);
        variants.add(value.slice(0, -1));
      }
      if (value.endsWith("ه")) {
        variants.add(`${value.slice(0, -1)}ة`);
        variants.add(value.slice(0, -1));
      }
      if (value.length >= 2 && !value.endsWith("ة") && !value.endsWith("ه")) {
        variants.add(`${value}ة`);
        variants.add(`${value}ه`);
        variants.add(`${value}ات`);
        variants.add(`${value}تين`);
        variants.add(`${value}تان`);
      }
      if (value.startsWith("براطي") && value.length > 5) {
        variants.add(`برط${value.slice(5)}`);
      }
      if (value.startsWith("برط") && value.length > 3) {
        variants.add(`براطي${value.slice(3)}`);
      }
      if (["برطاش", "برطاشة", "برطاشه"].includes(value)) {
        ["برطاش", "برطاشة", "برطاشه", "براطيش"].forEach((variant) => variants.add(variant));
      }
      if (value === "براطيش") {
        ["براطيش", "برطاش", "برطاشة", "برطاشه"].forEach((variant) => variants.add(variant));
      }
    }
  }
  return [...variants].filter((value) => value.length >= 2);
}

function textMatchesQuery(text, query) {
  const words = tokenizeArabic(text);
  const queryTokens = tokenizeArabic(query);
  if (!queryTokens.length) return true;
  if (!words.length) return false;
  return queryTokens.every((term) => {
    return termVariants(term).some((variant) => {
      return words.some((word) => termVariants(word).includes(variant));
    });
  });
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map((k) => String(k || "").trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((k) => String(k || "").trim()).filter(Boolean);
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

function setPlatformButtons(platform) {
  const buttons = document.querySelectorAll(".platformPill[data-platform]");
  buttons.forEach((button) => {
    if (button.hidden) return;
    const active = button.dataset.platform === platform;
    button.setAttribute("aria-pressed", String(active));
  });
}

function normalizePlatformSettings(value) {
  const settings = {
    facebook: Boolean(value?.facebook ?? true),
    tiktok: Boolean(value?.tiktok ?? false),
  };
  if (!settings.facebook && !settings.tiktok) settings.facebook = true;
  return settings;
}

function firstEnabledPlatform() {
  return platformSettings.facebook ? "facebook" : "tiktok";
}

function applyPlatformVisibility() {
  document.querySelectorAll(".platformPill[data-platform]").forEach((button) => {
    const platform = button.dataset.platform;
    button.hidden = platform !== "facebook" && platform !== "tiktok" ? true : !platformSettings[platform];
  });
  if (!platformSettings[state.draft.platform]) {
    state.draft.platform = firstEnabledPlatform();
    state.applied.platform = state.draft.platform;
  }
  setPlatformButtons(state.draft.platform);
}

async function loadPlatformSettings() {
  try {
    const resp = await fetch(`${API_BASE}/sharah/platform-settings?_ts=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`status=${resp.status}`);
    platformSettings = normalizePlatformSettings(await resp.json());
  } catch {
    platformSettings = normalizePlatformSettings({});
  }
  applyPlatformVisibility();
}

async function updatePlatformCounts(query = "") {
  const q = encodeURIComponent(query || "");
  const requests = [];
  if (platformSettings.facebook) {
    requests.push(fetch(`${API_BASE}/sharah/reels?limit=${MAX_REELS_TO_LOAD}&q=${q}&_ts=${Date.now()}`, { cache: "no-store" })
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((data) => { platformCounts.facebook = Array.isArray(data) ? data.length : 0; })
      .catch(() => { platformCounts.facebook = 0; }));
  } else {
    platformCounts.facebook = 0;
  }
  if (platformSettings.tiktok) {
    requests.push(fetch(`${API_BASE}/sharah/reels/tiktok?username=shadishirri&limit=${MAX_REELS_TO_LOAD}&q=${q}&_ts=${Date.now()}`, { cache: "no-store" })
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((data) => { platformCounts.tiktok = Array.isArray(data) ? data.length : 0; })
      .catch(() => { platformCounts.tiktok = 0; }));
  } else {
    platformCounts.tiktok = 0;
  }
  await Promise.all(requests);
}

async function applyPlatform(platform) {
  state.draft.platform = platformSettings[platform] ? platform : firstEnabledPlatform();
  state.applied.platform = state.draft.platform;
  setPlatformButtons(state.draft.platform);

  if (state.applied.platform === "tiktok") {
    await loadTikTokReels();
    renderGrid();
  } else if (state.draft.q.trim()) {
    await syncSearchFromDraft();
  } else {
    await loadReels();
    renderGrid();
  }
}

function pageSize() {
  return window.matchMedia(MOBILE_PAGE_QUERY).matches ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
}

function formatArabicDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

function iconSvg(platform) {
  if (platform === "tiktok") {
    return `<img src="/images/tiktok-platform.png" alt="TikTok" loading="lazy" />`;
  }
  if (platform === "instagram") {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="4" stroke="#111827" stroke-width="2" />
        <path d="M9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" stroke="#111827" stroke-width="2" />
        <path d="M16.8 7.5h.01" stroke="#111827" stroke-width="3" stroke-linecap="round" />
      </svg>`;
  }
  return `<img src="/images/facebook-platform.png" alt="Facebook" loading="lazy" />`;
}

function matchesFilters(card, filters) {
  if (filters.platform !== "all" && card.platform !== filters.platform) return false;
  const q = normalize(filters.q);
  if (!q) return true;
  return (card.tags || []).some((tag) => tagMatchesQuery(tag, q));
}

function sortTimestamp(card) {
  const normalizeTimestamp = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n < 1000000000000 ? n * 1000 : n;
  };

  const raw = String(card.uploadDate || card.date || "").trim();
  if (raw) {
    const base = raw.split(" (")[0].trim();
    const parsed = Date.parse(base);
    if (Number.isFinite(parsed)) return parsed;
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
      const parsedDateOnly = Date.parse(`${base}T00:00:00Z`);
      if (Number.isFinite(parsedDateOnly)) return parsedDateOnly;
    }
    const parsedUtc = Date.parse(base.replace(/\s+UTC$/i, "Z").replace(" ", "T"));
    if (Number.isFinite(parsedUtc)) return parsedUtc;
  }

  return normalizeTimestamp(card.createdAt);
}

function sortCards(cards, sortKey) {
  const cloned = [...cards];
  if (sortKey === "popular") {
    cloned.sort((a, b) => {
      const popA = Number(a.popularityScore || 0);
      const popB = Number(b.popularityScore || 0);
      if (popA !== popB) return popB - popA;
      return sortTimestamp(b) - sortTimestamp(a);
    });
    return cloned;
  }
  if (sortKey === "old") {
    cloned.sort((a, b) => sortTimestamp(a) - sortTimestamp(b));
    return cloned;
  }
  cloned.sort((a, b) => sortTimestamp(b) - sortTimestamp(a));
  return cloned;
}

function filteredCards() {
  const cards = CARDS.filter((c) => matchesFilters(c, state.applied));
  return sortCards(cards, state.applied.sort);
}

function escapeHtml(s) {
  return (s || "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderGrid() {
  const grid = $("grid");
  const countEl = $("count");
  const pager = $("pager");
  grid.hidden = false;
  pager.hidden = false;

  const cards = filteredCards();
  countEl.textContent = `عرض ${cards.length} فيديو`;
  updateSearchStats(cards);

  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(cards.length / size));
  state.page = clamp(state.page, 1, totalPages);
  const start = (state.page - 1) * size;
  const pageItems = cards.slice(start, start + size);

  grid.innerHTML = "";
  for (const c of pageItems) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = c.facebookReelUrl || "#";
    a.setAttribute("aria-label", c.title);
    if (c.facebookReelUrl) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      a.addEventListener("click", (e) => e.preventDefault());
    }

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.style.backgroundImage = c.thumb;

    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `
      <div class="title">${escapeHtml(c.title)}</div>
    `;

    const platform = document.createElement("div");
    platform.className = "platform";
    platform.innerHTML = iconSvg(c.platform);

    a.appendChild(thumb);
    a.appendChild(platform);
    a.appendChild(info);
    grid.appendChild(a);
  }

  renderPager(totalPages);
}

function renderPager(totalPages) {
  const pages = $("pages");
  const prev = $("prevPage");
  const next = $("nextPage");
  prev.disabled = state.page <= 1;
  next.disabled = state.page >= totalPages;

  pages.innerHTML = "";
  const visible = [];
  const start = Math.max(1, state.page - 1);
  const end = Math.min(totalPages, state.page + 1);
  for (let i = start; i <= end; i++) visible.push(i);

  if (start > 1) visible.unshift(1);
  if (end < totalPages) visible.push(totalPages);

  const uniq = [...new Set(visible)];
  for (const p of uniq) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pageBtn";
    b.textContent = `${p}`;
    if (p === state.page) b.setAttribute("aria-current", "page");
    b.addEventListener("click", () => {
      state.page = p;
      renderGrid();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    pages.appendChild(b);
  }
}

async function applyFilters() {
  if (!platformSettings[state.draft.platform]) state.draft.platform = firstEnabledPlatform();
  state.applied = { ...state.draft };
  state.page = 1;
  await updatePlatformCounts(state.applied.q);
  if (state.applied.platform === "tiktok") {
    await loadTikTokReels();
  } else if (state.applied.q.trim()) {
    await loadTagSearchResults(state.applied.q);
  } else {
    await loadReels();
  }
  renderGrid();
}

async function syncSearchFromDraft() {
  if (!platformSettings[state.draft.platform]) state.draft.platform = firstEnabledPlatform();
  state.applied = { ...state.draft };
  state.page = 1;
  await updatePlatformCounts(state.applied.q);
  if (state.applied.platform === "tiktok") {
    await loadTikTokReels();
  } else if (state.applied.q.trim()) {
    await loadTagSearchResults(state.applied.q);
  } else {
    await loadReels();
  }
  renderGrid();
}

async function resetFilters() {
  const platform = firstEnabledPlatform();
  state.draft = { q: "", platform, sort: "new" };
  state.applied = { q: "", platform, sort: "new" };
  state.page = 1;
  $("q").value = "";
  setPlatformButtons(platform);
  $("sortSelect").value = "new";
  if (platform === "tiktok") {
    await loadTikTokReels();
  } else {
    await loadReels();
  }
  renderGrid();
}

function updateSearchStats(cards) {
  const facebook = cards.filter((card) => card.platform === "facebook").length;
  const tiktok = cards.filter((card) => card.platform === "tiktok").length;
  const total = cards.length;
  const heroTotal = $("heroTotal");
  const facebookCount = $("facebookCount");
  const tiktokCount = $("tiktokCount");
  const searchMetaLine = $("searchMetaLine");
  if (heroTotal) heroTotal.textContent = `${total}`;
  if (facebookCount) facebookCount.textContent = `${platformSettings.facebook ? platformCounts.facebook || facebook : 0}`;
  if (tiktokCount) tiktokCount.textContent = `${platformSettings.tiktok ? platformCounts.tiktok || tiktok : 0}`;
  if (searchMetaLine) searchMetaLine.innerHTML = `عرض <strong>${total}</strong> من <strong>${CARDS.length}</strong> فيديو`;
}

function bindSuggestionButtons() {
  document.querySelectorAll(".suggestionChip[data-query]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const query = button.dataset.query || "";
      state.draft.q = query;
      $("q").value = query;
      await syncSearchFromDraft();
    });
  });
}

function renderPopularTags(tags) {
  const suggestions = $("suggestions");
  if (!suggestions) return;
  const settings = Array.isArray(tags) ? { enabled: true, tags } : (tags || {});
  const visibleTags = (Array.isArray(settings.tags) ? settings.tags : [])
    .map((item) => (typeof item === "string" ? item : item?.tag))
    .map((tag) => String(tag || "").trim())
    .filter(Boolean);
  if (!settings.enabled || visibleTags.length === 0) {
    suggestions.hidden = true;
    suggestions.innerHTML = "";
    return;
  }
  suggestions.hidden = false;
  suggestions.innerHTML = `<span>شائع:</span>${visibleTags.map((tag) => `<button type="button" class="suggestionChip" data-query="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}`;
  bindSuggestionButtons();
}

async function loadPopularTags() {
  try {
    const resp = await fetch(`${API_BASE}/sharah/popular-tags?_ts=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`status=${resp.status}`);
    renderPopularTags(await resp.json());
  } catch {
    renderPopularTags({ enabled: true, tags: [] });
  }
}

function init() {
  const toolbar = document.querySelector(".toolbar");
  const filterToggle = $("filterToggle");
  if (toolbar && filterToggle) {
    const isOpen = toolbar.classList.contains("filtersOpen");
    filterToggle.setAttribute("aria-expanded", String(isOpen));
    filterToggle.setAttribute("aria-label", isOpen ? "إخفاء الفلاتر" : "عرض الفلاتر");
    filterToggle.addEventListener("click", () => {
      const isOpen = toolbar.classList.toggle("filtersOpen");
      filterToggle.setAttribute("aria-expanded", String(isOpen));
      filterToggle.setAttribute("aria-label", isOpen ? "إخفاء الفلاتر" : "عرض الفلاتر");
    });
  }

  $("q").addEventListener("input", (e) => {
    state.draft.q = e.target.value || "";
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      syncSearchFromDraft();
    }, 250);
  });
  $("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyFilters();
  });

  const clearSearch = $("clearSearch");
  if (clearSearch) {
    clearSearch.addEventListener("click", async () => {
      await applyFilters();
    });
  }

  bindSuggestionButtons();
  loadPopularTags();

  document.querySelectorAll(".platformPill[data-platform]").forEach((button) => {
    button.addEventListener("click", async () => {
      await applyPlatform(button.dataset.platform || "facebook");
    });
  });

  const platformSelect = $("platformSelect");
  if (platformSelect) {
    platformSelect.addEventListener("change", async (e) => {
      state.draft.platform = e.target.value || "facebook";
      state.applied.platform = state.draft.platform;
      if (state.draft.q.trim()) {
        await syncSearchFromDraft();
      } else {
        renderGrid();
      }
    });
  }

  $("sortSelect").addEventListener("change", async (e) => {
    state.draft.sort = e.target.value || "new";
    state.applied.sort = state.draft.sort;
    state.page = 1;
    if (state.draft.q.trim()) {
      await syncSearchFromDraft();
    } else {
      renderGrid();
    }
  });

  const applyBtn = $("applyBtn");
  const resetBtn = $("resetBtn");
  if (applyBtn) applyBtn.addEventListener("click", applyFilters);
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);

  $("prevPage").addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    renderGrid();
  });
  $("nextPage").addEventListener("click", () => {
    state.page = state.page + 1;
    renderGrid();
  });

  window.matchMedia(MOBILE_PAGE_QUERY).addEventListener("change", () => {
    state.page = 1;
    renderGrid();
  });

  loadPlatformSettings().then(() => applyFilters());
}

init();

function reelToCard(r, idx, { searchRanked = false } = {}) {
  const title = r.title || "";
  const category = r.topic || "عام";
  const date = r.uploadDate || "";
  const createdAt = Number(r.createdAt || 0);
  const rawThumb = String(r.thumbnail || "").trim();
  const isLocalThumb = rawThumb.startsWith("/images/") || rawThumb.startsWith("images/");

  const proxiedThumbnail = rawThumb
    ? (isLocalThumb
      ? (rawThumb.startsWith("/") ? rawThumb : `/${rawThumb}`)
      : `${API_BASE}/sharah/thumb?url=${encodeURIComponent(rawThumb)}&reelUrl=${encodeURIComponent(String(r.facebookReelUrl || ""))}`)
    : "";

  const thumb = proxiedThumbnail
    ? `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.35)), url('${proxiedThumbnail.replaceAll("'", "%27")}')`
    : "radial-gradient(420px 260px at 35% 35%, rgba(122, 90, 59, 0.22), rgba(122, 90, 59, 0) 62%), linear-gradient(135deg, #0b1320, #6a4a30 55%, #efe7de)";

  return {
    id: r.id || `${idx + 1}`,
    platform: String(r.platform || "facebook").toLowerCase(),
    duration: r.duration || "",
    title,
    category,
    date,
    createdAt,
    popularityScore: Number(r.popularityScore || 0),
    searchText: r.searchText || "",
    tags: parseTags(r.tags),
    thumb,
    facebookReelUrl: r.facebookReelUrl,
    searchRanked,
  };
}

async function loadReels() {
  try {
    const resp = await fetch(`${API_BASE}/sharah/reels?limit=${MAX_REELS_TO_LOAD}&_ts=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`status=${resp.status}`);
    const data = await resp.json();
    const reels = Array.isArray(data) ? data : [];
    if (reels.length === 0) throw new Error("empty");

    const fetchedCards = reels.filter((r) => r?.facebookReelUrl).map((r, idx) => reelToCard(r, idx));
    CARDS = fetchedCards;
    renderGrid();
  } catch {
    console.warn("Could not fetch Facebook reels");
  }
}

async function loadAllReels() {
  const query = state.applied.q || "";
  const hasQuery = Boolean(query.trim());
  const facebookUrl = `${API_BASE}/sharah/reels?limit=${MAX_REELS_TO_LOAD}&q=${encodeURIComponent(query)}&_ts=${Date.now()}`;
  const tiktokUrl = `${API_BASE}/sharah/reels/tiktok?username=shadishirri&limit=${MAX_REELS_TO_LOAD}&q=${encodeURIComponent(query)}&_ts=${Date.now()}`;
  try {
    const [facebookResult, tiktokResult] = await Promise.allSettled([
      fetch(facebookUrl, { cache: "no-store" }).then((resp) => (resp.ok ? resp.json() : [])),
      fetch(tiktokUrl, { cache: "no-store" }).then((resp) => (resp.ok ? resp.json() : [])),
    ]);
    const facebookData = facebookResult.status === "fulfilled" ? facebookResult.value : [];
    const tiktokData = tiktokResult.status === "fulfilled" ? tiktokResult.value : [];
    const facebookCards = (Array.isArray(facebookData) ? facebookData : [])
      .filter((r) => r?.facebookReelUrl)
      .map((r, idx) => reelToCard(r, idx, { searchRanked: hasQuery }));
    const tiktokCards = (Array.isArray(tiktokData) ? tiktokData : [])
      .filter((r) => r?.facebookReelUrl)
      .map((r, idx) => reelToCard(r, idx + facebookCards.length, { searchRanked: hasQuery }));
    CARDS = [...facebookCards, ...tiktokCards];
  } catch {
    console.warn("Could not fetch all reels");
    CARDS = [];
  }
}

async function loadTikTokReels() {
  try {
    const q = encodeURIComponent(state.applied.q || "");
    const hasQuery = Boolean((state.applied.q || "").trim());
    const resp = await fetch(`${API_BASE}/sharah/reels/tiktok?username=shadishirri&limit=${MAX_REELS_TO_LOAD}&q=${q}&_ts=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`status=${resp.status}`);
    const data = await resp.json();
    const reels = Array.isArray(data) ? data : [];
    if (reels.length === 0) throw new Error("empty");

    CARDS = reels
      .filter((r) => r?.facebookReelUrl)
      .map((r, idx) => reelToCard(r, idx, { searchRanked: hasQuery }));
  } catch {
    console.warn("Could not fetch TikTok reels");
    CARDS = [];
  }
}

async function loadTagSearchResults(query) {
  try {
    const url = `${API_BASE}/sharah/reels/search?limit=${MAX_REELS_TO_LOAD}&q=${encodeURIComponent(query || "")}&_ts=${Date.now()}`;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`status=${resp.status}`);
    const data = await resp.json();
    const reels = Array.isArray(data) ? data : [];
    CARDS = reels.filter((r) => r?.facebookReelUrl).map((r, idx) => reelToCard(r, idx, { searchRanked: Boolean((query || "").trim()) }));
  } catch {
    console.warn("Could not fetch tagged Facebook reels for search");
  }
}
