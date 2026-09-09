(() => {
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  const form = document.getElementById("donate-form");
  const amountInput = document.getElementById("amount");
  const status = document.getElementById("donate-status");
  const submit = document.getElementById("donate-submit");
  const ready = document.getElementById("donate-ready");
  const modeEl = document.getElementById("donate-mode");
  const lede = document.getElementById("donate-lede");
  const sum = document.getElementById("gift-sum");
  const cadenceLabel = document.getElementById("gift-cadence");
  const chips = document.querySelectorAll("#amount-row [data-amount]");
  const cadenceBtns = document.querySelectorAll("#cadence [data-recurring]");
  let checkoutReady = false;
  let recurring = false;

  function money(n) {
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function paintGift() {
    const amount = Number(amountInput.value) || 0;
    if (sum) sum.textContent = amount >= 1 ? `$${money(amount)}` : "$—";
    if (cadenceLabel) cadenceLabel.textContent = recurring ? "monthly · US dollars" : "one-time · US dollars";
    if (submit && checkoutReady) {
      submit.textContent = recurring ? "Continue · monthly" : "Continue to secure checkout";
    }
  }

  function setStatus(msg, err) {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle("err", Boolean(err));
  }

  chips.forEach((btn) => {
    btn.addEventListener("click", () => {
      chips.forEach((b) => b.classList.remove("sel"));
      btn.classList.add("sel");
      amountInput.value = btn.dataset.amount;
      paintGift();
    });
  });

  cadenceBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      cadenceBtns.forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      recurring = btn.dataset.recurring === "true";
      paintGift();
    });
  });

  amountInput?.addEventListener("input", () => {
    const v = String(Math.round(Number(amountInput.value) || 0));
    chips.forEach((b) => b.classList.toggle("sel", b.dataset.amount === v));
    paintGift();
  });

  async function loadReady() {
    try {
      const res = await fetch("/api/donate", { cache: "no-store" });
      const data = await res.json();
      checkoutReady = Boolean(data.ready) || data.mode === "checkout" || data.mode === "link";
      if (ready) ready.textContent = "USD · journalism";
      if (modeEl) modeEl.textContent = "Stripe Checkout live";
      if (lede) {
        lede.textContent =
          "Stripe Checkout is live. Cancel returns here. Paid landings go to a thank-you. Every gift is logged as journalism.";
      }
      if (submit) submit.textContent = "Continue to secure checkout";
      paintGift();
    } catch {
      if (modeEl) modeEl.textContent = "desk will still take the gift";
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount < 1) {
      setStatus("Pick an amount of at least $1.", true);
      return;
    }
    submit.disabled = true;
    setStatus("Opening secure checkout…");
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          name: document.getElementById("name")?.value || "",
          email: document.getElementById("email")?.value || "",
          note: document.getElementById("note")?.value || "",
          recurring
        })
      });
      const data = await res.json();
      if (!res.ok && !data.pledge) {
        setStatus(data.error || "Could not log the gift.", true);
        submit.disabled = false;
        return;
      }
      if (data.stripe) {
        setStatus("Handing you to Stripe…");
        window.location.href = data.stripe;
        return;
      }
      if (data.error) {
        setStatus(data.error, true);
        submit.disabled = false;
        return;
      }
      setStatus(`Gift logged for $${amount}. Thank you.`);
      form.reset();
      amountInput.value = "40";
      recurring = false;
      cadenceBtns.forEach((b) => b.classList.toggle("on", b.dataset.recurring === "false"));
      chips.forEach((b) => b.classList.toggle("sel", b.dataset.amount === "40"));
      paintGift();
    } catch {
      setStatus("Network dropped. Try again.", true);
    }
    submit.disabled = false;
  });

  function tickClock() {
    const el = document.getElementById("donate-clock");
    if (!el) return;
    el.textContent = `UTC ${new Date().toISOString().slice(11, 19)}`;
  }

  tickClock();
  setInterval(tickClock, 1000);
  paintGift();
  loadReady();
})();
