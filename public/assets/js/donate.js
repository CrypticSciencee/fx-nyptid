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
  const lede = document.getElementById("donate-lede");
  const chips = document.querySelectorAll("#amount-row [data-amount]");

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
    });
  });

  amountInput?.addEventListener("input", () => {
    const v = String(Math.round(Number(amountInput.value) || 0));
    chips.forEach((b) => b.classList.toggle("sel", b.dataset.amount === v));
  });

  async function loadReady() {
    try {
      const res = await fetch("/api/donate", { cache: "no-store" });
      const data = await res.json();
      if (ready) ready.textContent = data.ready ? "Stripe checkout is live" : "Pledges logging · Stripe next";
      if (lede) {
        lede.textContent = data.ready
          ? "Pick an amount. We log the pledge, then Stripe takes the payment."
          : "Pick an amount. Jackson is wiring Stripe. Until checkout is live, the pledge is logged so nothing is lost.";
      }
      if (submit) submit.textContent = data.ready ? "Donate with Stripe" : "Pledge and continue";
    } catch {
      if (ready) ready.textContent = "Desk will still take the pledge";
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
    setStatus("Logging the pledge…");
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          name: document.getElementById("name")?.value || "",
          email: document.getElementById("email")?.value || "",
          note: document.getElementById("note")?.value || ""
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Could not log the pledge.", true);
        submit.disabled = false;
        return;
      }
      if (data.stripe) {
        setStatus("Sending you to Stripe…");
        window.location.href = data.stripe;
        return;
      }
      setStatus(`Pledge logged for $${amount}. Checkout is being wired. Thank you.`);
      form.reset();
      amountInput.value = "40";
      chips.forEach((b) => b.classList.toggle("sel", b.dataset.amount === "40"));
    } catch {
      setStatus("Network dropped. Try again.", true);
    }
    submit.disabled = false;
  });

  loadReady();
})();
