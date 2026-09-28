"use strict";

const supabaseUrl = "https://mnmcwvzevbkrwqfjpryh.supabase.co";
const publishableKey = "sb_publishable_dPHc8MPc-nIN9TBda-JQDg_KWdlmeB3";
const $ = (id) => document.getElementById(id);

let expiresAt = 0;
let countdownInterval = null;

function setStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.innerHTML = busy ? "Generating…" : 'Generate admin code <span aria-hidden="true">→</span>';
}

function updateCountdown() {
  const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  $("countdown").textContent = seconds ? `Expires in ${minutes}:${remainder}` : "Expired — generate a new code";
  if (!seconds) {
    $("code").textContent = "EXPIRED";
    $("copy-button").disabled = true;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

$("pin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const pin = $("pin").value;
  if (!/^\d{4}$/.test(pin)) {
    setStatus("Enter the four-digit organizer PIN.", true);
    return;
  }

  const button = $("generate-button");
  setBusy(button, true);
  setStatus("Checking PIN and generating a code…");
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/issue-admin-code-pin`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "apikey": publishableKey },
      body: JSON.stringify({ pin }),
    });
    let result = {};
    try { result = await response.json(); } catch { /* Handled as an invalid response. */ }
    if (!response.ok) {
      const error = new Error("Request failed");
      error.status = response.status;
      throw error;
    }
    if (!/^[A-Z2-9]{8}$/.test(result.code) || !result.expires_at) {
      throw new Error("Invalid issuer response");
    }

    expiresAt = Date.parse(result.expires_at);
    $("code").textContent = result.code;
    $("copy-button").disabled = false;
    $("copy-button").textContent = "Copy code";
    $("code-panel").hidden = false;
    $("pin").value = "";
    setStatus("Code created. Enter it on the admin’s phone before it expires.");
    if (countdownInterval) clearInterval(countdownInterval);
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  } catch (error) {
    if (error.status === 403) {
      $("pin").value = "";
      $("pin").focus();
      setStatus("Incorrect PIN or temporarily locked. Check it before trying again.", true);
    } else if (error.status === 429) {
      setStatus("Please wait before generating another code. Existing unused codes may still work.", true);
    } else {
      setStatus("Could not generate a code right now. Please try again.", true);
    }
  } finally {
    setBusy(button, false);
  }
});

$("copy-button").addEventListener("click", async () => {
  if (!expiresAt || Date.now() >= expiresAt) return;
  try {
    await navigator.clipboard.writeText($("code").textContent);
    $("copy-button").textContent = "Copied";
  } catch {
    setStatus("Copy was blocked. Select the code above to copy it manually.", true);
  }
});
