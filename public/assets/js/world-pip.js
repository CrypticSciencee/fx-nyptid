(() => {
  const pip = document.getElementById("world-pip");
  const btn = document.getElementById("pip-toggle");
  if (!pip || !btn) return;
  btn.addEventListener("click", () => {
    const min = pip.classList.toggle("min");
    btn.textContent = min ? "+" : "–";
    btn.setAttribute("aria-label", min ? "Expand livestream" : "Minimize livestream");
  });
})();
