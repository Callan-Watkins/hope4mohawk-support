"use strict";

const supabaseUrl = "https://mnmcwvzevbkrwqfjpryh.supabase.co";
const publishableKey = "sb_publishable_dPHc8MPc-nIN9TBda-JQDg_KWdlmeB3";
const ownerEmail = "callans.creations1@gmail.com";
const redirectUrl = "https://callan-watkins.github.io/hope4mohawk-support/admin/";

const $ = (id) => document.getElementById(id);
const emailForm = $("email-form");
const otpForm = $("otp-form");
const signinPanel = $("signin-panel");
const verifyPanel = $("verify-panel");
const issuerPanel = $("issuer-panel");
const codePanel = $("code-panel");
let accessToken = null;
let expiresAt = 0;
let countdownInterval = null;

function setStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

function setBusy(button, busy, waitingLabel) {
  if (busy) button.dataset.originalLabel = button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy ? waitingLabel : button.dataset.originalLabel;
}

function showSignedIn(token) {
  accessToken = token;
  signinPanel.hidden = true;
  issuerPanel.hidden = false;
  setStatus("Ready to create a code.");
  $("generate-button").focus();
}

function signOut() {
  accessToken = null;
  expiresAt = 0;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = null;
  $("code").textContent = "";
  codePanel.hidden = true;
  issuerPanel.hidden = true;
  signinPanel.hidden = false;
  verifyPanel.hidden = true;
  $("otp").value = "";
  setStatus("Signed out. Sign in to create a code.");
}

function consumeLinkSession() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get("access_token");
  const error = hash.get("error_description") || hash.get("error");
  if (hash.size) history.replaceState(null, "", window.location.pathname);
  if (token) showSignedIn(token);
  else if (error) setStatus("That sign-in link could not be used. Request a new one.", true);
}

async function api(path, body, token = null) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "apikey": publishableKey,
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let result = {};
  try { result = await response.json(); } catch { /* Invalid response is handled below. */ }
  if (!response.ok) {
    const error = new Error(result.error || result.msg || result.message || "Request failed");
    error.status = response.status;
    throw error;
  }
  return result;
}

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim().toLowerCase();
  if (email !== ownerEmail) {
    setStatus("Use the approved organizer email address.", true);
    return;
  }
  const button = $("email-button");
  setBusy(button, true, "Sending…");
  setStatus("Sending a sign-in email…");
  try {
    await api(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectUrl)}`, { email, create_user: true });
    verifyPanel.hidden = false;
    setStatus("Check your email for a sign-in link or code.");
    $("otp").focus();
  } catch (error) {
    setStatus(error.status === 429 ? "Too many requests. Try again later." : "Could not send the email. Check the address and try again.", true);
  } finally {
    setBusy(button, false);
  }
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("verify-button");
  const token = $("otp").value.trim();
  if (!/^\d{6,8}$/.test(token)) {
    setStatus("Enter the six- or eight-digit code from the email.", true);
    return;
  }
  setBusy(button, true, "Verifying…");
  setStatus("Checking the sign-in code…");
  try {
    const result = await api("/auth/v1/verify", { email: ownerEmail, token, type: "email" });
    if (!result.access_token) throw new Error("No session returned");
    showSignedIn(result.access_token);
  } catch {
    setStatus("That sign-in code was not accepted. Check it or request a new email.", true);
  } finally {
    setBusy(button, false);
    $("otp").value = "";
  }
});

function updateCountdown() {
  const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  $("countdown").textContent = seconds ? `Expires in ${minutes}:${remainder}` : "Expired — create a new code";
  if (!seconds) {
    $("code").textContent = "EXPIRED";
    $("copy-button").disabled = true;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

$("generate-button").addEventListener("click", async () => {
  if (!accessToken) return signOut();
  const button = $("generate-button");
  setBusy(button, true, "Creating…");
  setStatus("Creating a single-use code…");
  try {
    const result = await api("/functions/v1/issue-admin-code-web", {}, accessToken);
    if (!/^[A-Z2-9]{8}$/.test(result.code) || !result.expires_at) throw new Error("Invalid issuer response");
    expiresAt = Date.parse(result.expires_at);
    $("code").textContent = result.code;
    $("copy-button").disabled = false;
    $("copy-button").textContent = "Copy code";
    codePanel.hidden = false;
    setStatus("Code created. Enter it on the admin’s phone before it expires.");
    if (countdownInterval) clearInterval(countdownInterval);
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      signOut();
      setStatus("Your sign-in has expired or is not approved. Sign in again.", true);
    } else if (error.status === 429) {
      setStatus("Please wait before creating another code. Existing unused codes may still work.", true);
    } else {
      setStatus("Could not create a code right now. Please try again.", true);
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

$("signout-button").addEventListener("click", signOut);
consumeLinkSession();
