(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("motion");
  if (reduce) {
    document.documentElement.classList.add("motion-off");
    return;
  }

  const pick = document.querySelectorAll(
    ".sec-head, .hero-copy, .hero-card, .desk-status, .chat-shell, .gift-panel, .gift-fund, .case-card, .case-open, .person, .shot, .stat, .oil-grid > *, .split > *, .proof-card, .live-status, .donate-band, .fx-ticker, .reason, .desk-note"
  );
  pick.forEach((el, i) => {
    if (el.closest(".world-pip")) return;
    el.classList.add("reveal");
    el.style.setProperty("--d", `${Math.min(i % 8, 7) * 60}ms`);
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  requestAnimationFrame(() => document.body.classList.add("booted"));
})();
