/* shared behaviors: theme, progress, collapse, search */
(function () {
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('dsh-theme'); } catch (e) {}
  if (saved) root.setAttribute('data-theme', saved);

  function paintThemeBtn() {
    var b = document.getElementById('themeBtn');
    if (!b) return;
    var dark = root.getAttribute('data-theme') !== 'light';
    b.textContent = dark ? '☀ 浅色模式' : '☾ 深色模式';
  }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'themeBtn') {
      var dark = root.getAttribute('data-theme') !== 'light';
      root.setAttribute('data-theme', dark ? 'light' : 'dark');
      try { localStorage.setItem('dsh-theme', dark ? 'light' : 'dark'); } catch (err) {}
      paintThemeBtn();
    }
  });

  // scroll progress
  var bar = document.getElementById('progress');
  if (bar) {
    window.addEventListener('scroll', function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    }, { passive: true });
  }

  // collapsible lecture cards
  document.querySelectorAll('.lecture-head').forEach(function (head) {
    head.addEventListener('click', function (ev) {
      if (ev.target.closest('a,code,button')) return;
      head.parentElement.classList.toggle('collapsed');
    });
  });

  // in-page search
  var input = document.getElementById('search');
  var empty = document.querySelector('.no-result');
  if (input) {
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      document.querySelectorAll('.lecture').forEach(function (card) {
        var hit = !q || card.textContent.toLowerCase().indexOf(q) !== -1;
        card.style.display = hit ? '' : 'none';
        if (hit) { shown++; if (q) card.classList.remove('collapsed'); }
      });
      if (empty) empty.style.display = shown === 0 ? 'block' : 'none';
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); } });
  }

  // smooth jump: highlight target card
  if (location.hash) {
    var t = document.querySelector(location.hash);
    if (t) {
      t.style.borderColor = 'var(--accent)';
      setTimeout(function () { t.style.borderColor = ''; }, 2200);
    }
  }
  paintThemeBtn();
})();