(() => {
  const pip = document.getElementById("world-pip");
  if (!pip) return;
  const btn = document.getElementById("pip-toggle");
  const frame = document.getElementById("pip-frame");
  const label = document.getElementById("pip-label");
  const next = document.getElementById("pip-next");

  const STREAMS = [
    {
      name: "Al Jazeera English",
      src: "https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1&rel=0&modestbranding=1"
    },
    {
      name: "Sky News",
      src: "https://www.youtube.com/embed/9Auq9mYxFEE?autoplay=1&mute=1&rel=0&modestbranding=1"
    }
  ];
  let i = 0;

  function show(n) {
    i = ((n % STREAMS.length) + STREAMS.length) % STREAMS.length;
    const s = STREAMS[i];
    if (frame) frame.src = s.src;
    if (label) label.textContent = `World · ${s.name} · not an ad`;
  }

  btn?.addEventListener("click", () => {
    const min = pip.classList.toggle("min");
    btn.textContent = min ? "+" : "–";
    btn.setAttribute("aria-label", min ? "Expand livestream" : "Minimize livestream");
  });
  next?.addEventListener("click", () => show(i + 1));
  show(0);
})();
