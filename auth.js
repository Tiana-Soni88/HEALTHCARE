import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const loginForm = document.getElementById("loginForm");

// If user is already logged in and on the login page, redirect to dashboard
onAuthStateChanged(auth, (user) => {
  if (user) {
    const path = window.location.pathname;
    if (path.endsWith("/") || path.endsWith("index.html")) {
      window.location.href = "dashboard.html";
    }
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const btn = document.getElementById("loginBtn");
    const err = document.getElementById("errorMsg");

    btn.disabled = true;
    btn.textContent = "Signing in...";
    err.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("FULL ERROR:", error);
      err.textContent = `❌ ${error.code} — ${error.message}`;
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });
}

window.logout = async () => {
  await signOut(auth);
  window.location.href = "index.html";
};

// ---------- Password Show / Hide Toggle ----------
const toggleBtn = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");
const eyeIcon = document.getElementById("eyeIcon");

if (toggleBtn && passwordInput && eyeIcon) {
  const EYE_OPEN = `
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  `;
  const EYE_OFF = `
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  `;

  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";

    // Swap type
    passwordInput.type = isPassword ? "text" : "password";

    // Swap icon
    eyeIcon.innerHTML = isPassword ? EYE_OFF : EYE_OPEN;

    // Style + a11y
    toggleBtn.classList.toggle("revealed", isPassword);
    toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");

    // Keep the cursor focus in the password field
    passwordInput.focus();
  });

  // Bonus: Hold the icon down (mousedown) to reveal while pressed
  toggleBtn.addEventListener("mousedown", (e) => e.preventDefault()); // prevents focus loss
}