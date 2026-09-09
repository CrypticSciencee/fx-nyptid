(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("motion");
  if (reduce) {
    document.documentElement.classList.add("motion-off");
    document.body.classList.add("booted");
    return;
  }

  function splitWordmark() {
    const el = document.querySelector(".wordmark");
    if (!el || el.dataset.split) return;
    el.dataset.split = "1";
    const nodes = [...el.childNodes];
    el.textContent = "";
    nodes.forEach((node) => {
      if (node.nodeType === 3) {
        [...node.textContent].forEach((ch, i) => {
          if (ch === " ") {
            el.appendChild(document.createTextNode(" "));
            return;
          }
          const s = document.createElement("span");
          s.className = "char";
          s.style.setProperty("--i", String(i));
          s.textContent = ch;
          el.appendChild(s);
        });
      } else {
        el.appendChild(node);
      }
    });
  }

  function mark(el, i) {
    if (!el || el.classList.contains("reveal") || el.closest(".world-pip, .fx-wire, .nav")) return;
    el.classList.add("reveal");
    el.style.setProperty("--d", `${Math.min(i, 12) * 70}ms`);
  }

  function collect() {
    const sel =
      ".sec-head, .hero-copy .kicker, .hero-copy .lede, .hero-copy p, .hero-actions, .hero-card, .desk-status, .chat-shell, .gift-panel, .gift-fund, .case-card, .case-open, .person, .shot, .stat, .oil-grid > *, .split > *, .proof-card, .live-status, .donate-band, .fx-ticker, .reason, .desk-note, .clocks, .tv-wrap";
    document.querySelectorAll(sel).forEach((el, i) => mark(el, i));
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
  );

  function observeAll() {
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
  }

  splitWordmark();
  collect();
  observeAll();

  const bg = document.querySelector(".hero-bg");
  if (bg) {
    bg.addEventListener("animationend", () => bg.classList.add("settled"), { once: true });
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY;
          bg.style.setProperty("--py", `${Math.min(y * 0.22, 180)}px`);
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  document.querySelectorAll(".btn, .nav-cta").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--bx", `${e.clientX - r.left}px`);
      btn.style.setProperty("--by", `${e.clientY - r.top}px`);
    });
  });

  const roots = ["exhibit-grid", "people-grid", "ledger-list", "case-index", "wire", "chat-log"].map((id) =>
    document.getElementById(id)
  );
  roots.filter(Boolean).forEach((root) => {
    const mo = new MutationObserver(() => {
      collect();
      observeAll();
    });
    mo.observe(root, { childList: true, subtree: true });
  });

  requestAnimationFrame(() => {
    document.body.classList.add("booted");
    document.querySelectorAll(".hero-copy, .hero-card, .wordmark").forEach((el) => el.classList.add("in"));
  });
})();
