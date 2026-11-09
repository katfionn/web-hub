/* AI Evals 站点交互：导航高亮 / 主题 / 搜索 / 灯箱 / 阅读进度 */
(function () {
  // theme
  const saved = localStorage.getItem("evals-theme");
  if (saved) document.documentElement.dataset.theme = saved;
  const tBtn = document.getElementById("themeBtn");
  if (tBtn) tBtn.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme === "dark" ? "" : "dark";
    document.documentElement.dataset.theme = cur;
    localStorage.setItem("evals-theme", cur);
    tBtn.textContent = cur ? "☀" : "◐";
  });
  if (tBtn) tBtn.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "◐";

  // mobile nav
  const nBtn = document.getElementById("navBtn");
  if (nBtn) nBtn.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));

  // scroll spy
  const links = [...document.querySelectorAll(".sidebar a[href^='#']")];
  const sections = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const onScroll = () => {
    let idx = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top < 120) idx = i; });
    links.forEach((a, i) => a.classList.toggle("active", i === idx));
  };
  if (sections.length) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }

  // lightbox
  const lb = document.getElementById("lightbox");
  if (lb) {
    document.querySelectorAll("figure img").forEach(img => {
      img.addEventListener("click", () => {
        const im = lb.querySelector("img");
        im.src = img.src;
        lb.classList.add("open");
      });
    });
    lb.addEventListener("click", () => lb.classList.remove("open"));
    document.addEventListener("keydown", e => { if (e.key === "Escape") { lb.classList.remove("open"); closeSearch(); } });
  }

  // search overlay
  const box = document.getElementById("searchbox");
  const input = box ? box.querySelector("input") : null;
  const resultsEl = box ? box.querySelector(".results") : null;
  function openSearch() { if (!box) return; box.classList.add("open"); input.value = ""; input.focus(); render(""); }
  function closeSearch() { if (box) box.classList.remove("open"); }
  window.openSearch = openSearch;

  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.addEventListener("click", openSearch);
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
  });
  if (box) box.addEventListener("click", e => { if (e.target === box) closeSearch(); });

  function render(q) {
    if (!window.SEARCH_INDEX || !resultsEl) return;
    const qq = q.trim().toLowerCase();
    const rows = window.SEARCH_INDEX.filter(r => !qq || (r.t + " " + r.d + " " + r.h).toLowerCase().includes(qq));
    resultsEl.innerHTML = rows.slice(0, 40).map(r =>
      `<a href="${r.u}"><span class="p">${r.p}</span> ${r.t}<br><span class="muted">${r.d}</span></a>`
    ).join("") || `<div style="padding:16px;color:var(--ink-3)">没有匹配结果</div>`;
    resultsEl.querySelectorAll("a").forEach(a => a.addEventListener("click", closeSearch));
  }
  if (input) input.addEventListener("input", () => render(input.value));

  // reading progress bar
  const prog = document.getElementById("progress");
  if (prog) window.addEventListener("scroll", () => {
    const h = document.documentElement;
    const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
    prog.style.width = (p * 100).toFixed(1) + "%";
  }, { passive: true });
})();