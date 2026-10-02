// ================================================================
//  MediCare ERP — core.js
//  Single JavaScript file for the entire hospital system.
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  get,
  set,
  update,
  push,
  remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ----------------------------------------------------------------
   1. FIREBASE CONFIG
---------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCWrZo-O2H9EoR69MiB9vCZqGNJFBboOu8",
  authDomain: "hospital-epr.firebaseapp.com",
  databaseURL: "https://hospital-epr-default-rtdb.firebaseio.com",
  projectId: "hospital-epr",
  storageBucket: "hospital-epr.firebasestorage.app",
  messagingSenderId: "792475150915",
  appId: "1:792475150915:web:4f43dd08b8ef3ee7ae82f6",
  measurementId: "G-68LYGDG0EF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ----------------------------------------------------------------
   2. GLOBAL STATE
---------------------------------------------------------------- */
const State = {
  user: null,
  profile: null,
  page: document.body.dataset.page || "dashboard",
  collection: null,
  rawData: {},
  searchTerm: "",
  filterValue: "",
  bedsData: {},
  historyData: {},
  calendarMonth: new Date()
};

/* ----------------------------------------------------------------
   3. ROLE PERMISSIONS  (Phase 3 updated)
---------------------------------------------------------------- */
const ROLE_PERMISSIONS = {
  admin:        ["dashboard", "patients", "appointments", "records", "beds", "staff", "billing", "pharmacy", "lab", "audit"],
  doctor:       ["dashboard", "patients", "appointments", "records", "beds", "lab"],
  nurse:        ["dashboard", "patients", "appointments", "records", "beds", "pharmacy", "lab"],
  receptionist: ["dashboard", "patients", "appointments", "billing"]
};

/* ----------------------------------------------------------------
   4. UTILITIES
---------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fmtDate(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

function fmtDateTime(ms) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

function toast(message, type = "info") {
  let container = $("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 2600);
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal active";
    overlay.innerHTML = `
      <div class="modal-content" style="max-width:420px;">
        <h2>Confirm Action</h2>
        <p style="color:#475569;margin-bottom:24px;line-height:1.55;">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-act="cancel">Cancel</button>
          <button class="btn btn-danger" data-act="ok">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      const act = e.target.dataset.act;
      if (act === "ok") { overlay.remove(); resolve(true); }
      if (act === "cancel" || e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

function debounce(fn, wait = 180) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ----------------------------------------------------------------
   5. USER PROFILE + ROLE HELPERS
---------------------------------------------------------------- */
async function loadUserProfile(uid) {
  if (!uid) return null;
  try {
    const snap = await get(ref(db, `users/${uid}`));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.error("Failed to load user profile:", err);
    return null;
  }
}

function canAccess(page) {
  const role = State.profile?.role;
  if (!role) return true;
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(page);
}

function applyRolePermissions() {
  const role = State.profile?.role || "unknown";
  const perms = ROLE_PERMISSIONS[role] || [];

  $$(".sidebar-nav a[data-nav]").forEach((link) => {
    const page = link.dataset.nav;
    if (!perms.includes(page)) link.style.display = "none";
  });

  const label = $("userRole");
  if (label) label.textContent = role.charAt(0).toUpperCase() + role.slice(1);
}

/* ----------------------------------------------------------------
   6. LOGIN PAGE
---------------------------------------------------------------- */
function initLogin() {
  const form = $("loginForm");
  if (!form) return;

  const remembered = localStorage.getItem("mc_remember_email");
  if (remembered && $("email")) {
    $("email").value = remembered;
    if ($("rememberMe")) $("rememberMe").checked = true;
  }

  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
  });

  const toggle = $("togglePassword");
  const pass = $("password");
  const eye = $("eyeIcon");
  if (toggle && pass && eye) {
    const EYE = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    const EYE_OFF = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    toggle.addEventListener("click", () => {
      const hidden = pass.type === "password";
      pass.type = hidden ? "text" : "password";
      eye.innerHTML = hidden ? EYE_OFF : EYE;
      toggle.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
      pass.focus();
    });
    toggle.addEventListener("mousedown", (e) => e.preventDefault());
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("email").value.trim();
    const password = $("password").value;
    const remember = $("rememberMe")?.checked;
    const btn = $("loginBtn");
    const err = $("errorMsg");

    btn.disabled = true;
    btn.textContent = "Signing in...";
    err.textContent = "";

    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );

      if (remember) localStorage.setItem("mc_remember_email", email);
      else localStorage.removeItem("mc_remember_email");

      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (error) {
      err.textContent = friendlyAuthError(error.code);
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });

  const forgotLink = $("forgotLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      const emailField = $("email");
      if (emailField?.value) $("resetEmail").value = emailField.value;
      const msg = $("resetMsg");
      if (msg) { msg.textContent = ""; msg.style.color = "var(--c-danger)"; }
      $("resetModal")?.classList.add("active");
    });
  }

  const resetForm = $("resetForm");
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("resetEmail").value.trim();
      const btn = $("resetBtn");
      const msg = $("resetMsg");

      btn.disabled = true;
      btn.textContent = "Sending...";
      msg.textContent = "";
      msg.style.color = "var(--c-danger)";

      try {
        await sendPasswordResetEmail(auth, email);
        msg.style.color = "var(--c-success)";
        msg.textContent = "Reset link sent. Check your inbox.";
        btn.textContent = "Sent";
        setTimeout(() => {
          closeModal();
          btn.disabled = false;
          btn.textContent = "Send Reset Link";
        }, 2200);
      } catch (error) {
        msg.textContent = friendlyAuthError(error.code);
        btn.disabled = false;
        btn.textContent = "Send Reset Link";
      }
    });
  }
}

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/missing-email": "Please enter your email address.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "Configuration error. Contact administrator."
  };
  return map[code] || "Unable to sign in. Please try again.";
}

/* ----------------------------------------------------------------
   7. LAYOUT
---------------------------------------------------------------- */
function initLayout() {
  const emailBadge = $("userEmail");
  const avatar = $("userAvatar");

  if (emailBadge || avatar) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      State.user = user;

      State.profile = await loadUserProfile(user.uid);
      if (!State.profile) {
        State.profile = { email: user.email, name: user.email, role: "admin" };
      }

      if (emailBadge) {
        emailBadge.textContent = State.profile.name || user.email;
        emailBadge.title = user.email;
      }
      if (avatar) {
        const initials = (State.profile.name || user.email)
          .split(" ")
          .map((s) => s[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        avatar.textContent = initials;
      }

      applyRolePermissions();

      if (!canAccess(State.page)) {
        toast("Access denied for your role", "error");
        setTimeout(() => (window.location.href = "dashboard.html"), 900);
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='logout']")) {
      signOut(auth).then(() => (window.location.href = "index.html"));
    }
  });

  const menuBtn = $("menuToggle");
  const sidebar = document.querySelector(".sidebar");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 900 && sidebar.classList.contains("open")) {
        if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
          sidebar.classList.remove("open");
        }
      }
    });
  }

  const clock = $("liveClock");
  if (clock) {
    const tick = () => {
      const now = new Date();
      clock.textContent = now.toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    };
    tick();
    setInterval(tick, 30000);
  }
}

/* ----------------------------------------------------------------
   8. DASHBOARD
---------------------------------------------------------------- */
function initDashboard() {
  if (State.page !== "dashboard") return;

  ["patients", "appointments", "staff", "records"].forEach((c) => {
    onValue(ref(db, c), (snap) => {
      const el = $(`kpi-${c}`);
      if (el) el.textContent = snap.exists() ? Object.keys(snap.val()).length : 0;
    });
  });

  onValue(ref(db, "beds"), (snap) => {
    let total = 0, occupied = 0;
    if (snap.exists()) {
      Object.values(snap.val()).forEach((ward) => {
        const beds = ward.beds || {};
        Object.values(beds).forEach((b) => {
          total++;
          if (b.status === "occupied") occupied++;
        });
      });
    }
    const o = $("kpi-occupied"), a = $("kpi-available"),
          t = $("kpi-totalBeds"), r = $("kpi-rate");
    if (o) o.textContent = occupied;
    if (a) a.textContent = total - occupied;
    if (t) t.textContent = total;
    if (r) r.textContent = total === 0 ? "0%" : Math.round((occupied / total) * 100) + "%";
  });

  onValue(ref(db, "bedHistory"), (snap) => {
    const feed = $("activityFeed");
    if (!feed) return;
    feed.innerHTML = "";
    if (!snap.exists()) {
      feed.innerHTML = `<div class="empty-state">No recent activity.</div>`;
      return;
    }
    const events = Object.values(snap.val())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);

    events.forEach((ev) => {
      const row = document.createElement("div");
      row.className = "activity-row";
      row.innerHTML = `
        <div class="activity-dot ${ev.action}"></div>
        <div class="activity-info">
          <div class="activity-title">
            <strong>${escapeHtml(ev.patientName || "-")}</strong>
            <span class="pill ${ev.action}">${ev.action === "admit" ? "Admitted" : ev.action === "discharge" ? "Discharged" : "Transferred"}</span>
          </div>
          <div class="activity-meta">
            ${escapeHtml(ev.wardLabel || ev.ward || "")} · ${escapeHtml(ev.bedId || "")} · ${fmtDateTime(ev.timestamp)}
          </div>
        </div>`;
      feed.appendChild(row);
    });
  });
}

/* ----------------------------------------------------------------
   9. CRUD PAGES
---------------------------------------------------------------- */
const COLLECTION_CONFIG = {
  patients: {
    title: "Patients",
    singular: "Patient",
    columns: [
      { key: "name", label: "Name", highlight: true },
      { key: "age", label: "Age" },
      { key: "gender", label: "Gender" },
      { key: "diagnosis", label: "Diagnosis", highlight: true }
    ],
    fields: [
      { id: "name", label: "Full Name", type: "text", required: true },
      { id: "age", label: "Age", type: "number", required: true, min: 0, max: 130 },
      { id: "gender", label: "Gender", type: "select", required: true, options: ["Male", "Female", "Other"] },
      { id: "diagnosis", label: "Diagnosis", type: "text" }
    ],
    filter: { key: "gender", label: "All Genders", values: ["Male", "Female", "Other"] },
    searchKeys: ["name", "diagnosis", "gender"],
    extraActions: "patient"
  },
  staff: {
    title: "Staff",
    singular: "Staff Member",
    columns: [
      { key: "name", label: "Name", highlight: true },
      { key: "role", label: "Role" },
      { key: "department", label: "Department" },
      { key: "email", label: "Email", highlight: true },
      { key: "phone", label: "Phone" }
    ],
    fields: [
      { id: "name", label: "Full Name", type: "text", required: true },
      { id: "role", label: "Role", type: "select", required: true, options: ["Doctor", "Nurse", "Admin", "Technician", "Receptionist"] },
      { id: "department", label: "Department", type: "text", required: true },
      { id: "email", label: "Email", type: "email", required: true },
      { id: "phone", label: "Phone", type: "tel" }
    ],
    filter: { key: "role", label: "All Roles", values: ["Doctor", "Nurse", "Admin", "Technician", "Receptionist"] },
    searchKeys: ["name", "role", "department", "email", "phone"]
  },
  appointments: {
    title: "Appointments",
    singular: "Appointment",
    columns: [
      { key: "patient", label: "Patient", highlight: true },
      { key: "doctor", label: "Doctor", highlight: true },
      { key: "date", label: "Date", format: fmtDate },
      { key: "time", label: "Time" },
      { key: "reason", label: "Reason" }
    ],
    fields: [
      { id: "patient", label: "Patient Name", type: "text", required: true },
      { id: "doctor", label: "Doctor Name", type: "text", required: true },
      { id: "date", label: "Date", type: "date", required: true },
      { id: "time", label: "Time", type: "time", required: true },
      { id: "reason", label: "Reason / Notes", type: "text" }
    ],
    filter: { key: "_dateRange", label: "All Dates", values: ["Today", "Upcoming", "Past"] },
    searchKeys: ["patient", "doctor", "reason"],
    hasCalendar: true
  },
  records: {
    title: "Medical Records",
    singular: "Record",
    columns: [
      { key: "patient", label: "Patient", highlight: true },
      { key: "diagnosis", label: "Diagnosis", highlight: true },
      { key: "prescription", label: "Prescription" },
      { key: "date", label: "Date", format: fmtDate }
    ],
    fields: [
      { id: "patient", label: "Patient Name", type: "text", required: true },
      { id: "diagnosis", label: "Diagnosis", type: "text", required: true },
      { id: "prescription", label: "Prescription", type: "text" },
      { id: "notes", label: "Notes", type: "textarea" },
      { id: "date", label: "Date", type: "date", required: true }
    ],
    filter: { key: "_recency", label: "All Records", values: ["Last 30 days", "Older"] },
    searchKeys: ["patient", "diagnosis", "prescription"],
    extraActions: "record"
  }
};

function initCRUD() {
  const cfg = COLLECTION_CONFIG[State.page];
  if (!cfg) return;
  State.collection = State.page;

  buildForm(cfg);
  buildFilter(cfg);

  onValue(ref(db, State.collection), (snap) => {
    State.rawData = snap.exists() ? snap.val() : {};
    renderTable();
  });

  const searchInput = $("searchInput");
  const searchBox = $("searchBox");
  const clearBtn = $("clearSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      State.searchTerm = e.target.value;
      searchBox.classList.toggle("has-value", State.searchTerm.length > 0);
      renderTable();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      State.searchTerm = "";
      searchBox.classList.remove("has-value");
      searchInput.focus();
      renderTable();
    });
  }

  const addBtn = $("addBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => openModal(cfg, null));
  }

  const form = $("dataForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("recordId").value;
      const data = {};
      cfg.fields.forEach((f) => {
        const el = $(`f_${f.id}`);
        if (el) {
          const raw = el.value;
          if (f.type === "number") {
            data[f.id] = raw === "" ? null : Number(raw);
          } else {
            data[f.id] = (raw || "").trim();
          }
        }
      });
      data.updatedAt = Date.now();

      try {
        if (id) {
          await update(ref(db, `${State.collection}/${id}`), data);
          toast(`${cfg.singular} updated`, "success");
          recordAudit(`${State.collection}.updated`, { id, ...data });
        } else {
          data.createdAt = Date.now();
          const newRef = push(ref(db, State.collection));
          await set(newRef, data);
          toast(`${cfg.singular} created`, "success");
          recordAudit(`${State.collection}.created`, { id: newRef.key, ...data });
        }
        closeModal();
      } catch (err) {
        toast("Save failed: " + err.message, "error");
      }
    });
  }

  if (cfg.hasCalendar) initCalendarToggle();
}

function buildForm(cfg) {
  const form = $("dataForm");
  if (!form) return;
  const fieldsHtml = cfg.fields.map((f) => {
    if (f.type === "select") {
      return `<label for="f_${f.id}">${f.label}</label>
        <select id="f_${f.id}" ${f.required ? "required" : ""}>
          <option value="">Select ${f.label}</option>
          ${f.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
        </select>`;
    }
    if (f.type === "textarea") {
      return `<label for="f_${f.id}">${f.label}</label>
        <textarea id="f_${f.id}" rows="3" placeholder="Optional..."></textarea>`;
    }
    const extra = [
      f.min !== undefined ? `min="${f.min}"` : "",
      f.max !== undefined ? `max="${f.max}"` : ""
    ].filter(Boolean).join(" ");
    return `<label for="f_${f.id}">${f.label}</label>
      <input id="f_${f.id}" type="${f.type}" ${extra} ${f.required ? "required" : ""} placeholder="Enter ${f.label.toLowerCase()}">`;
  }).join("");

  form.innerHTML = `
    <input type="hidden" id="recordId">
    ${fieldsHtml}
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="closeModal">Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button>
    </div>`;
}

function buildFilter(cfg) {
  const sel = $("filterSelect");
  if (!sel || !cfg.filter) return;
  sel.innerHTML = `<option value="">${cfg.filter.label}</option>` +
    cfg.filter.values.map((v) => `<option value="${v}">${v}</option>`).join("");
  sel.addEventListener("change", (e) => {
    State.filterValue = e.target.value;
    renderTable();
  });
}

function renderTable() {
  const cfg = COLLECTION_CONFIG[State.collection];
  if (!cfg) return;
  const tbody = $("tableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let entries = Object.entries(State.rawData);
  entries = applyFilter(entries, cfg);
  entries = applySearch(entries, cfg);

  entries.sort((a, b) => {
    const ka = a[1].name || a[1].patient || a[1].date || "";
    const kb = b[1].name || b[1].patient || b[1].date || "";
    return String(ka).localeCompare(String(kb));
  });

  const total = Object.keys(State.rawData).length;
  const countEl = $("resultCount");
  if (countEl) {
    countEl.innerHTML = `Showing <strong>${entries.length}</strong> of <strong>${total}</strong> ${total === 1 ? cfg.singular.toLowerCase() : cfg.title.toLowerCase()}`;
  }

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cfg.columns.length + 1}" class="empty-state">
      ${total === 0 ? `No ${cfg.title.toLowerCase()} yet. Click "Add ${cfg.singular}" to create one.` : "No results match your search."}
    </td></tr>`;
    return;
  }

  entries.forEach(([id, item]) => {
    const tr = document.createElement("tr");
    let extraBtn = "";
    if (cfg.extraActions === "patient") {
      extraBtn = `<button class="btn-icon timeline" data-id="${id}" title="View Timeline" aria-label="Timeline">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </button>`;
    } else if (cfg.extraActions === "record") {
      extraBtn = `<button class="btn-icon print-record" data-id="${id}" title="Print Prescription" aria-label="Print">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </button>`;
    }

    tr.innerHTML = cfg.columns.map((col) => {
      const raw = item[col.key];
      const val = col.format ? col.format(raw) : (raw ?? "-");
      const cell = col.highlight ? highlight(String(val)) : escapeHtml(String(val));
      return `<td>${cell}</td>`;
    }).join("") +
      `<td class="actions">
        ${extraBtn}
        <button class="btn-icon edit" data-id="${id}" title="Edit" aria-label="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="btn-icon delete" data-id="${id}" title="Delete" aria-label="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-icon.edit").forEach((b) =>
    b.addEventListener("click", () => openModal(cfg, b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.delete").forEach((b) =>
    b.addEventListener("click", () => deleteItem(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.timeline").forEach((b) =>
    b.addEventListener("click", () => openPatientTimeline(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.print-record").forEach((b) =>
    b.addEventListener("click", () => printPrescription(b.dataset.id)));
}

function applyFilter(entries, cfg) {
  if (!State.filterValue) return entries;
  const f = cfg.filter;
  if (f.key === "_dateRange") {
    const today = new Date().toISOString().split("T")[0];
    return entries.filter(([, item]) => {
      const d = item.date || "";
      if (State.filterValue === "Today") return d === today;
      if (State.filterValue === "Upcoming") return d > today;
      if (State.filterValue === "Past") return d < today;
      return true;
    });
  }
  if (f.key === "_recency") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cut = cutoff.toISOString().split("T")[0];
    return entries.filter(([, item]) => {
      const d = item.date || "";
      return State.filterValue === "Last 30 days" ? d >= cut : d < cut;
    });
  }
  return entries.filter(([, item]) => item[f.key] === State.filterValue);
}

function applySearch(entries, cfg) {
  const q = State.searchTerm.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(([, item]) =>
    cfg.searchKeys.some((k) => String(item[k] || "").toLowerCase().includes(q))
  );
}

function highlight(text) {
  const safe = escapeHtml(text);
  const q = State.searchTerm.trim();
  if (!q) return safe;
  return safe.replace(new RegExp(`(${escapeRegex(q)})`, "ig"), "<mark>$1</mark>");
}

function openModal(cfg, id) {
  const modal = $("modal");
  const title = $("modalTitle");
  const form = $("dataForm");
  form.reset();
  $("recordId").value = "";

  if (id) {
    title.textContent = `Edit ${cfg.singular}`;
    const item = State.rawData[id];
    $("recordId").value = id;
    cfg.fields.forEach((f) => {
      const el = $(`f_${f.id}`);
      if (el) el.value = item[f.id] ?? "";
    });
  } else {
    title.textContent = `Add ${cfg.singular}`;
  }
  modal.classList.add("active");
}

function closeModal() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.remove("active"));
}

async function deleteItem(id) {
  const cfg = COLLECTION_CONFIG[State.collection];
  const item = State.rawData[id];
  const ok = await confirmDialog(`Delete this ${cfg.singular.toLowerCase()}? This cannot be undone.`);
  if (!ok) return;
  try {
    await remove(ref(db, `${State.collection}/${id}`));
    toast(`${cfg.singular} deleted`, "success");
    recordAudit(`${State.collection}.deleted`, { id, name: item?.name || item?.patient || "" });
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
}

/* ----------------------------------------------------------------
   10. PATIENT TIMELINE
---------------------------------------------------------------- */
async function openPatientTimeline(patientId) {
  const patient = State.rawData[patientId];
  if (!patient) return;

  let modal = $("timelineModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "timelineModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width:720px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
          <div>
            <h2 id="timelineName" style="margin-bottom:4px;">Patient</h2>
            <div id="timelineMeta" style="font-size:13px;color:var(--c-text-muted);"></div>
          </div>
          <button class="btn-icon" data-action="closeModal" style="width:auto;padding:6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="timelineBody" style="max-height:520px;overflow-y:auto;"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  $("timelineName").textContent = patient.name || "Patient";
  $("timelineMeta").textContent =
    `${patient.age || "-"} yrs · ${patient.gender || "-"} · ${patient.diagnosis || "No diagnosis"}`;

  const [appts, recs] = await Promise.all([
    get(ref(db, "appointments")),
    get(ref(db, "records"))
  ]);

  const events = [];

  if (appts.exists()) {
    Object.values(appts.val()).forEach((a) => {
      if ((a.patient || "").toLowerCase() === (patient.name || "").toLowerCase()) {
        events.push({
          type: "appointment",
          when: a.date || "",
          title: `Appointment with ${a.doctor || "doctor"}`,
          desc: `${a.time || ""}${a.reason ? " · " + a.reason : ""}`
        });
      }
    });
  }

  if (recs.exists()) {
    Object.values(recs.val()).forEach((r) => {
      if ((r.patient || "").toLowerCase() === (patient.name || "").toLowerCase()) {
        events.push({
          type: "record",
          when: r.date || "",
          title: `Diagnosis: ${r.diagnosis || "—"}`,
          desc: r.prescription ? `Rx: ${r.prescription}` : ""
        });
      }
    });
  }

  if (patient.bedId && patient.admittedAt) {
    events.push({
      type: "bed",
      when: new Date(patient.admittedAt).toISOString().split("T")[0],
      title: `Admitted to ${patient.bedId}`,
      desc: `Ward: ${patient.ward || "—"}`
    });
  }

  events.sort((a, b) => (b.when || "").localeCompare(a.when || ""));

  const body = $("timelineBody");
  if (events.length === 0) {
    body.innerHTML = `<div class="empty-state">No history yet for this patient.</div>`;
  } else {
    body.innerHTML = events.map((ev) => `
      <div class="timeline-item">
        <div class="timeline-dot timeline-${ev.type}"></div>
        <div class="timeline-content">
          <div class="timeline-date">${fmtDate(ev.when)}</div>
          <div class="timeline-title">${escapeHtml(ev.title)}</div>
          ${ev.desc ? `<div class="timeline-desc">${escapeHtml(ev.desc)}</div>` : ""}
        </div>
      </div>
    `).join("");
  }

  modal.classList.add("active");
}
window.openPatientTimeline = openPatientTimeline;

/* ----------------------------------------------------------------
   11. PRESCRIPTION PRINT
---------------------------------------------------------------- */
async function printPrescription(recordId) {
  const record = State.rawData[recordId];
  if (!record) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Prescription — ${escapeHtml(record.patient)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Georgia, serif; }
        body { padding: 40px; color: #0f172a; }
        .letterhead {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 16px; border-bottom: 3px solid #0284c7;
          margin-bottom: 30px;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-mark {
          width: 46px; height: 46px;
          background: linear-gradient(135deg, #0ea5e9, #0f172a);
          border-radius: 10px; display: grid; place-items: center;
          color: white; font-size: 22px; font-weight: 700;
        }
        .brand h1 { font-size: 22px; color: #0f172a; letter-spacing: -0.02em; }
        .brand p { font-size: 12px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
        .letterhead-meta { font-size: 12px; color: #64748b; text-align: right; }
        h2 { font-size: 18px; color: #0284c7; margin-bottom: 20px; letter-spacing: 0.05em; text-transform: uppercase; }
        .patient-box {
          background: #f8fafc; border-left: 4px solid #0ea5e9;
          padding: 16px 20px; margin-bottom: 26px;
        }
        .patient-box .row { display: flex; gap: 24px; margin-bottom: 6px; font-size: 14px; }
        .patient-box .row strong { color: #64748b; font-weight: 600; min-width: 90px; }
        .section { margin-bottom: 26px; }
        .section h3 { font-size: 13px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .section p { font-size: 15px; line-height: 1.7; color: #0f172a; }
        .rx-symbol { font-size: 22px; font-weight: 700; color: #0284c7; margin-right: 6px; }
        .signature { margin-top: 60px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
        .signature-line { width: 220px; height: 1px; background: #0f172a; margin-bottom: 6px; }
        .signature-label { font-size: 12px; color: #64748b; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <div class="brand">
          <div class="brand-mark">+</div>
          <div>
            <h1>MediCare Hospital</h1>
            <p>Hospital ERP System</p>
          </div>
        </div>
        <div class="letterhead-meta">
          Date: ${fmtDate(record.date)}<br>
          Ref: ${String(recordId).slice(-8).toUpperCase()}
        </div>
      </div>
      <h2>Prescription</h2>
      <div class="patient-box">
        <div class="row"><strong>Patient:</strong> ${escapeHtml(record.patient || "-")}</div>
        <div class="row"><strong>Diagnosis:</strong> ${escapeHtml(record.diagnosis || "-")}</div>
      </div>
      <div class="section">
        <h3><span class="rx-symbol">℞</span>Prescription</h3>
        <p>${escapeHtml(record.prescription || "No prescription specified.")}</p>
      </div>
      ${record.notes ? `
        <div class="section">
          <h3>Clinical Notes</h3>
          <p>${escapeHtml(record.notes)}</p>
        </div>
      ` : ""}
      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-label">Prescribing Physician — Signature & Date</div>
      </div>
      <div class="footer">
        This is a computer-generated prescription · MediCare Hospital ERP
      </div>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}
window.printPrescription = printPrescription;

/* ----------------------------------------------------------------
   12. CALENDAR VIEW (Appointments)
---------------------------------------------------------------- */
function initCalendarToggle() {
  const toggle = $("calendarToggle");
  const listView = $("listView");
  const calendarView = $("calendarView");
  const prevBtn = $("calPrev");
  const nextBtn = $("calNext");
  if (!toggle || !listView || !calendarView) return;

  toggle.addEventListener("click", () => {
    const showingCalendar = calendarView.style.display !== "none";
    calendarView.style.display = showingCalendar ? "none" : "block";
    listView.style.display = showingCalendar ? "block" : "none";
    toggle.textContent = showingCalendar ? "Calendar View" : "List View";
    if (!showingCalendar) renderCalendar();
  });

  if (prevBtn) prevBtn.addEventListener("click", () => {
    State.calendarMonth.setMonth(State.calendarMonth.getMonth() - 1);
    renderCalendar();
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    State.calendarMonth.setMonth(State.calendarMonth.getMonth() + 1);
    renderCalendar();
  });
}

function renderCalendar() {
  const container = $("calendarGrid");
  const label = $("calendarLabel");
  if (!container) return;

  const year = State.calendarMonth.getFullYear();
  const month = State.calendarMonth.getMonth();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  label.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const apptsByDate = {};
  Object.values(State.rawData).forEach((a) => {
    if (!a.date) return;
    apptsByDate[a.date] = apptsByDate[a.date] || [];
    apptsByDate[a.date].push(a);
  });

  let html = `
    <div class="cal-header">
      <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
    </div>
    <div class="cal-grid">`;

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const appts = apptsByDate[dateStr] || [];
    const isToday = dateStr === today;
    html += `
      <div class="cal-cell ${isToday ? "today" : ""}">
        <div class="cal-day">${d}</div>
        ${appts.slice(0, 3).map((a) => `
          <div class="cal-event" title="${escapeHtml(a.patient)} — ${escapeHtml(a.doctor)}">
            ${escapeHtml(a.time || "")} ${escapeHtml(a.patient || "")}
          </div>
        `).join("")}
        ${appts.length > 3 ? `<div class="cal-more">+${appts.length - 3} more</div>` : ""}
      </div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

/* ----------------------------------------------------------------
   13. BEDS PAGE
---------------------------------------------------------------- */
const WARDS = {
  generalMale:   { label: "General Ward — Male",   prefix: "GM", capacity: 20, group: "general" },
  generalFemale: { label: "General Ward — Female", prefix: "GF", capacity: 20, group: "general" },
  icuMale:       { label: "ICU — Male",            prefix: "IM", capacity: 8,  group: "icu" },
  icuFemale:     { label: "ICU — Female",          prefix: "IF", capacity: 8,  group: "icu" }
};

function initBeds() {
  if (State.page !== "beds") return;

  const bedsRef = ref(db, "beds");
  get(bedsRef).then(async (snap) => {
    if (!snap.exists()) {
      const seed = {};
      Object.entries(WARDS).forEach(([key, cfg]) => {
        seed[key] = {
          label: cfg.label,
          prefix: cfg.prefix,
          capacity: cfg.capacity,
          beds: buildEmptyBeds(cfg.prefix, cfg.capacity)
        };
      });
      await set(bedsRef, seed);
    }
  });

  onValue(bedsRef, (snap) => {
    State.bedsData = snap.val() || {};
    renderBeds();
    renderBedSummary();
  });

  onValue(ref(db, "bedHistory"), (snap) => {
    State.historyData = snap.val() || {};
    renderHistory();
  });

  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $$(".tab-pane").forEach((p) => p.classList.toggle("active", p.dataset.tab === tab));
    });
  });

  const bedForm = $("bedForm");
  if (bedForm) {
    bedForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const wardKey = $("mWardKey").value;
      const bedId = $("mBedId").value;
      const action = $("mAction").value;

      if (action === "admit") {
        await handleAdmit(wardKey, bedId);
      } else if (action === "discharge") {
        await handleDischarge(wardKey, bedId);
      } else if (action === "edit") {
        await handleEditBed(wardKey, bedId);
      } else if (action === "transfer") {
        await handleTransfer(wardKey, bedId);
      }

      closeModal();
    });
  }

  const capForm = $("capacityForm");
  if (capForm) {
    capForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const wardKey = $("cWardKey").value;
      const newCap = Number($("cCapacity").value);
      const ward = State.bedsData[wardKey];
      if (!ward) return;
      const occupied = Object.values(ward.beds || {}).filter((b) => b.status === "occupied").length;
      if (newCap < occupied) {
        toast(`Cannot reduce below ${occupied} occupied beds`, "error");
        return;
      }
      const current = Object.keys(ward.beds || {}).length;
      const updates = {};
      if (newCap > current) {
        for (let i = current + 1; i <= newCap; i++) {
          const id = `${ward.prefix}-${String(i).padStart(2, "0")}`;
          updates[`beds/${wardKey}/beds/${id}`] = { status: "available" };
        }
      } else if (newCap < current) {
        const toRemove = [];
        for (let i = current; i > newCap; i--) {
          const id = `${ward.prefix}-${String(i).padStart(2, "0")}`;
          if (ward.beds[id]?.status === "available") toRemove.push(id);
        }
        if (toRemove.length < current - newCap) {
          toast("Discharge patients before removing their beds", "error");
          return;
        }
        toRemove.forEach((id) => { updates[`beds/${wardKey}/beds/${id}`] = null; });
      }
      updates[`beds/${wardKey}/capacity`] = newCap;
      await update(ref(db), updates);
      toast("Capacity updated", "success");
      closeModal();
    });
  }
}

async function handleAdmit(wardKey, bedId) {
  const name = $("mPatientName").value.trim();
  const age = $("mPatientAge").value;
  const diagnosis = $("mPatientDiagnosis").value.trim();
  if (!name) return;

  const now = Date.now();
  const gender = wardKey === "generalFemale" || wardKey === "icuFemale" ? "Female" : "Male";

  const patientRef = push(ref(db, "patients"));
  await set(patientRef, {
    name,
    age: age ? Number(age) : null,
    gender,
    diagnosis: diagnosis || "",
    bedId,
    ward: wardKey,
    admittedAt: now,
    createdAt: now,
    updatedAt: now
  });

  await update(ref(db, `beds/${wardKey}/beds/${bedId}`), {
    status: "occupied",
    patientName: name,
    patientId: patientRef.key,
    patientAge: age ? Number(age) : null,
    patientDiagnosis: diagnosis || "",
    admittedAt: now,
    admittedBy: State.user.email
  });

  await push(ref(db, "bedHistory"), {
    ward: wardKey,
    wardLabel: State.bedsData[wardKey]?.label,
    bedId,
    action: "admit",
    patientName: name,
    staff: State.user.email,
    timestamp: now
  });

  recordAudit("bed.admitted", { ward: wardKey, bed: bedId, patient: name });
  toast(`${name} admitted to ${bedId}`, "success");
}

async function handleDischarge(wardKey, bedId) {
  const ward = State.bedsData[wardKey];
  const bed = ward?.beds?.[bedId];
  const name = bed?.patientName || "Patient";
  const now = Date.now();

  await update(ref(db, `beds/${wardKey}/beds/${bedId}`), {
    status: "available",
    patientName: null,
    patientId: null,
    patientAge: null,
    patientDiagnosis: null,
    admittedAt: null,
    admittedBy: null
  });

  await push(ref(db, "bedHistory"), {
    ward: wardKey,
    wardLabel: ward.label,
    bedId,
    action: "discharge",
    patientName: name,
    staff: State.user.email,
    timestamp: now
  });

  recordAudit("bed.discharged", { ward: wardKey, bed: bedId, patient: name });
  toast(`${name} discharged from ${bedId}`, "success");
}

async function handleEditBed(wardKey, bedId) {
  const name = $("mPatientName").value.trim();
  const age = $("mPatientAge").value;
  const diagnosis = $("mPatientDiagnosis").value.trim();
  if (!name) return;

  const updates = { patientName: name };
  if (age !== "") updates.patientAge = Number(age);
  if (diagnosis !== undefined) updates.patientDiagnosis = diagnosis;

  await update(ref(db, `beds/${wardKey}/beds/${bedId}`), updates);

  const bed = State.bedsData[wardKey]?.beds?.[bedId];
  if (bed?.patientId) {
    const pUpdates = { name };
    if (age !== "") pUpdates.age = Number(age);
    if (diagnosis !== undefined) pUpdates.diagnosis = diagnosis;
    pUpdates.updatedAt = Date.now();
    await update(ref(db, `patients/${bed.patientId}`), pUpdates);
  }

  recordAudit("bed.edited", { ward: wardKey, bed: bedId, patient: name });
  toast(`Bed ${bedId} updated`, "success");
}

async function handleTransfer(wardKey, bedId) {
  const destWard = $("mDestWard").value;
  const destBed = $("mDestBed").value;
  if (!destWard || !destBed) {
    toast("Select destination ward and bed", "error");
    return;
  }

  const sourceWard = State.bedsData[wardKey];
  const sourceBed = sourceWard?.beds?.[bedId];
  const destWardData = State.bedsData[destWard];
  const destBedData = destWardData?.beds?.[destBed];

  if (!sourceBed || sourceBed.status !== "occupied") return;
  if (!destBedData || destBedData.status !== "available") {
    toast("Destination bed is not available", "error");
    return;
  }

  const now = Date.now();
  const patientData = {
    status: "occupied",
    patientName: sourceBed.patientName,
    patientId: sourceBed.patientId,
    patientAge: sourceBed.patientAge,
    patientDiagnosis: sourceBed.patientDiagnosis,
    admittedAt: sourceBed.admittedAt,
    admittedBy: sourceBed.admittedBy,
    transferredAt: now,
    transferredBy: State.user.email
  };

  await update(ref(db, `beds/${destWard}/beds/${destBed}`), patientData);
  await update(ref(db, `beds/${wardKey}/beds/${bedId}`), {
    status: "available",
    patientName: null,
    patientId: null,
    patientAge: null,
    patientDiagnosis: null,
    admittedAt: null,
    admittedBy: null
  });

  if (sourceBed.patientId) {
    await update(ref(db, `patients/${sourceBed.patientId}`), {
      bedId: destBed,
      ward: destWard,
      updatedAt: now
    });
  }

  await push(ref(db, "bedHistory"), {
    ward: wardKey,
    wardLabel: sourceWard.label,
    bedId,
    action: "transfer",
    patientName: sourceBed.patientName,
    toWard: destWard,
    toBed: destBed,
    staff: State.user.email,
    timestamp: now
  });

  recordAudit("bed.transferred", {
    from: `${wardKey}/${bedId}`,
    to: `${destWard}/${destBed}`,
    patient: sourceBed.patientName
  });
  toast(`${sourceBed.patientName} transferred to ${destBed}`, "success");
}

function buildEmptyBeds(prefix, capacity) {
  const beds = {};
  for (let i = 1; i <= capacity; i++) {
    const id = `${prefix}-${String(i).padStart(2, "0")}`;
    beds[id] = { status: "available" };
  }
  return beds;
}

function renderBeds() {
  const general = $("generalWards");
  const icu = $("icuWards");
  if (!general || !icu) return;
  general.innerHTML = "";
  icu.innerHTML = "";

  Object.entries(WARDS).forEach(([key, cfg]) => {
    const ward = State.bedsData[key];
    if (!ward) return;
    const card = buildWardCard(key, ward);
    if (cfg.group === "general") general.appendChild(card);
    else icu.appendChild(card);
  });
}

function buildWardCard(wardKey, ward) {
  const beds = ward.beds || {};
  const bedList = Object.entries(beds);
  const occupied = bedList.filter(([, b]) => b.status === "occupied").length;
  const total = bedList.length;
  const available = total - occupied;

  const wrapper = document.createElement("div");
  wrapper.className = "ward-card";
  wrapper.innerHTML = `
    <div class="ward-header">
      <div>
        <h3>${escapeHtml(ward.label)}</h3>
        <div class="ward-stats">
          <span>Total <strong>${total}</strong></span>
          <span>Occupied <strong class="text-red">${occupied}</strong></span>
          <span>Available <strong class="text-green">${available}</strong></span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm edit-capacity-btn" data-key="${wardKey}">
        Edit Capacity
      </button>
    </div>
    <div class="bed-tiles">
      ${bedList.map(([bedId, bed]) => renderBedTile(wardKey, bedId, bed)).join("")}
    </div>`;

  wrapper.querySelectorAll(".bed-tile").forEach((tile) => {
    tile.addEventListener("click", () =>
      openBedModal(tile.dataset.ward, tile.dataset.bed, tile.dataset.status));
  });
  wrapper.querySelector(".edit-capacity-btn").addEventListener("click", () => openCapacityModal(wardKey));
  return wrapper;
}

function renderBedTile(wardKey, bedId, bed) {
  const isOccupied = bed.status === "occupied";
  return `
    <div class="bed-tile ${isOccupied ? "occupied" : ""}"
         data-ward="${wardKey}" data-bed="${bedId}" data-status="${bed.status}"
         role="button" tabindex="0">
      <div class="bed-id">${bedId}</div>
      <div class="bed-patient">${isOccupied ? escapeHtml(bed.patientName || "-") : "Available"}</div>
      <div class="bed-status">${isOccupied ? "Occupied" : "Free"}</div>
    </div>`;
}

function renderBedSummary() {
  let total = 0, occupied = 0;
  Object.values(State.bedsData).forEach((ward) => {
    const list = Object.values(ward.beds || {});
    total += list.length;
    occupied += list.filter((b) => b.status === "occupied").length;
  });
  const available = total - occupied;
  const rate = total === 0 ? 0 : Math.round((occupied / total) * 100);

  if ($("sumTotal")) $("sumTotal").textContent = total;
  if ($("sumOccupied")) $("sumOccupied").textContent = occupied;
  if ($("sumAvailable")) $("sumAvailable").textContent = available;
  if ($("sumRate")) $("sumRate").textContent = rate + "%";
}

function openBedModal(wardKey, bedId, status) {
  const modal = $("bedModal");
  if (!modal) return;

  const patientFields = $("patientFields");
  const dischargeMsg = $("dischargeMessage");
  const editInfo = $("editInfo");
  const transferInfo = $("transferInfo");
  const submitBtn = $("bedSubmitBtn");
  const title = $("bedModalTitle");
  const form = $("bedForm");
  form.reset();

  $("mWardKey").value = wardKey;
  $("mBedId").value = bedId;
  $("mBedIdDisplay").value = bedId;
  if (patientFields) patientFields.style.display = "none";
  if (dischargeMsg) dischargeMsg.style.display = "none";
  if (editInfo) editInfo.style.display = "none";
  if (transferInfo) transferInfo.style.display = "none";

  const bed = State.bedsData[wardKey]?.beds?.[bedId];
  const occupant = bed?.patientName;
  const showEdit = !!$("editBtn");
  const showTransfer = !!$("transferBtn");

  if (status === "available") {
    $("mAction").value = "admit";
    title.textContent = "Admit Patient";
    submitBtn.textContent = "Admit";
    submitBtn.className = "btn btn-primary";
    if (patientFields) patientFields.style.display = "block";
    if ($("mPatientName")) $("mPatientName").required = true;
  } else {
    $("mAction").value = "discharge";
    title.textContent = "Manage Bed " + bedId;
    submitBtn.textContent = "Discharge";
    submitBtn.className = "btn btn-danger";
    if (dischargeMsg) {
      dischargeMsg.style.display = "block";
      $("dischargePatientName").textContent = occupant || "-";
      $("dischargeMeta").textContent = `Admitted ${fmtDateTime(bed.admittedAt)} · By ${bed.admittedBy || "-"}`;
    }
    if ($("mPatientName")) $("mPatientName").required = false;

    const actionBar = $("bedActionBar");
    if (actionBar) {
      actionBar.style.display = "flex";
      actionBar.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bed-action="edit">Edit Info</button>
        <button type="button" class="btn btn-secondary" data-bed-action="transfer">Transfer</button>
      `;
      actionBar.querySelectorAll("[data-bed-action]").forEach((b) => {
        b.addEventListener("click", () => switchBedAction(b.dataset.bedAction, wardKey, bedId, bed));
      });
    }
  }

  modal.classList.add("active");
}

function switchBedAction(action, wardKey, bedId, bed) {
  const patientFields = $("patientFields");
  const dischargeMsg = $("dischargeMessage");
  const editInfo = $("editInfo");
  const transferInfo = $("transferInfo");
  const submitBtn = $("bedSubmitBtn");
  const title = $("bedModalTitle");
  const actionBar = $("bedActionBar");

  if (dischargeMsg) dischargeMsg.style.display = "none";
  if (editInfo) editInfo.style.display = "none";
  if (transferInfo) transferInfo.style.display = "none";
  if (patientFields) patientFields.style.display = "none";
  if (actionBar) actionBar.style.display = "none";

  if (action === "edit") {
    $("mAction").value = "edit";
    title.textContent = "Edit Patient Info";
    submitBtn.textContent = "Save Changes";
    submitBtn.className = "btn btn-primary";
    if (patientFields) patientFields.style.display = "block";
    if ($("mPatientName")) {
      $("mPatientName").value = bed.patientName || "";
      $("mPatientName").required = true;
    }
    if ($("mPatientAge")) $("mPatientAge").value = bed.patientAge ?? "";
    if ($("mPatientDiagnosis")) $("mPatientDiagnosis").value = bed.patientDiagnosis ?? "";
  } else if (action === "transfer") {
    $("mAction").value = "transfer";
    title.textContent = "Transfer Patient";
    submitBtn.textContent = "Transfer";
    submitBtn.className = "btn btn-primary";
    if (transferInfo) transferInfo.style.display = "block";

    const wardSelect = $("mDestWard");
    const bedSelect = $("mDestBed");
    if (wardSelect && bedSelect) {
      wardSelect.innerHTML = `<option value="">Select ward</option>` +
        Object.entries(WARDS)
          .filter(([k]) => k !== wardKey)
          .map(([k, cfg]) => `<option value="${k}">${cfg.label}</option>`).join("");
      bedSelect.innerHTML = `<option value="">Select ward first</option>`;

      wardSelect.addEventListener("change", (e) => {
        const destWard = e.target.value;
        if (!destWard) {
          bedSelect.innerHTML = `<option value="">Select ward first</option>`;
          return;
        }
        const destBeds = State.bedsData[destWard]?.beds || {};
        const available = Object.entries(destBeds).filter(([, b]) => b.status === "available");
        bedSelect.innerHTML = `<option value="">Select bed</option>` +
          available.map(([id]) => `<option value="${id}">${id}</option>`).join("");
        if (available.length === 0) {
          bedSelect.innerHTML = `<option value="">No beds available</option>`;
        }
      });
    }
  }
}

function openCapacityModal(wardKey) {
  const ward = State.bedsData[wardKey];
  if (!ward) return;
  $("cWardKey").value = wardKey;
  $("cLabel").value = ward.label;
  $("cCapacity").value = ward.capacity;
  $("capacityModal").classList.add("active");
}

function renderHistory() {
  const tbody = $("historyBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const entries = Object.values(State.historyData || {})
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No activity yet.</td></tr>`;
    return;
  }
  entries.forEach((h) => {
    const tr = document.createElement("tr");
    const actionLabel = h.action === "admit" ? "Admitted" :
                       h.action === "discharge" ? "Discharged" :
                       h.action === "transfer" ? "Transferred" : h.action;
    const destInfo = h.action === "transfer"
      ? ` → ${escapeHtml(h.toBed || "")} (${escapeHtml(h.toWard || "")})`
      : "";
    tr.innerHTML = `
      <td>${fmtDateTime(h.timestamp)}</td>
      <td><span class="pill ${h.action}">${actionLabel}</span></td>
      <td>${escapeHtml(h.wardLabel || h.ward || "-")}</td>
      <td>${escapeHtml(h.bedId || "-")}${destInfo}</td>
      <td>${escapeHtml(h.patientName || "-")}</td>
      <td>${escapeHtml(h.staff || "-")}</td>`;
    tbody.appendChild(tr);
  });
}

/* ----------------------------------------------------------------
   13B. AUDIT LOG (Phase 3)
---------------------------------------------------------------- */
async function recordAudit(action, details = {}) {
  try {
    if (!State.user) return;
    await push(ref(db, "auditLog"), {
      action,
      user: State.user.email,
      userName: State.profile?.name || State.user.email,
      role: State.profile?.role || "unknown",
      page: State.page,
      details,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn("Audit log failed (non-blocking):", err);
  }
}
window.recordAudit = recordAudit;

/* ----------------------------------------------------------------
   13C. AUDIT LOG PAGE (Phase 3)
---------------------------------------------------------------- */
function initAudit() {
  if (State.page !== "audit") return;

  const auditRef = ref(db, "auditLog");
  onValue(auditRef, (snap) => {
    State.rawData = snap.exists() ? snap.val() : {};
    renderAuditTable();
  });

  const searchInput = $("searchInput");
  const searchBox = $("searchBox");
  const clearBtn = $("clearSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      State.searchTerm = e.target.value.toLowerCase();
      searchBox.classList.toggle("has-value", State.searchTerm.length > 0);
      renderAuditTable();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      State.searchTerm = "";
      searchBox.classList.remove("has-value");
      renderAuditTable();
    });
  }

  const sel = $("filterSelect");
  if (sel) {
    sel.innerHTML = `
      <option value="">All Roles</option>
      <option value="admin">Admin</option>
      <option value="doctor">Doctor</option>
      <option value="nurse">Nurse</option>
      <option value="receptionist">Receptionist</option>
    `;
    sel.addEventListener("change", (e) => {
      State.filterValue = e.target.value;
      renderAuditTable();
    });
  }
}

function renderAuditTable() {
  const tbody = $("tableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let entries = Object.entries(State.rawData);

  if (State.filterValue) {
    entries = entries.filter(([, e]) => e.role === State.filterValue);
  }

  const q = (State.searchTerm || "").trim().toLowerCase();
  if (q) {
    entries = entries.filter(([, e]) =>
      (e.user || "").toLowerCase().includes(q) ||
      (e.userName || "").toLowerCase().includes(q) ||
      (e.action || "").toLowerCase().includes(q) ||
      (e.page || "").toLowerCase().includes(q)
    );
  }

  entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
  entries = entries.slice(0, 500);

  const total = Object.keys(State.rawData).length;
  const countEl = $("resultCount");
  if (countEl) {
    countEl.innerHTML = `Showing <strong>${entries.length}</strong> of <strong>${total}</strong> events`;
  }

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No audit events yet. Perform an action to log one.</td></tr>`;
    return;
  }

  entries.forEach(([, ev]) => {
    const tr = document.createElement("tr");
    const detailStr = Object.entries(ev.details || {})
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
      .join(" · ");

    tr.innerHTML = `
      <td style="white-space:nowrap;">${fmtDateTime(ev.timestamp)}</td>
      <td>${escapeHtml(ev.userName || ev.user || "-")}</td>
      <td><span class="pill role-${ev.role || "unknown"}">${escapeHtml(ev.role || "-")}</span></td>
      <td><code style="font-family:var(--font-mono); font-size:12px; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${escapeHtml(ev.action || "-")}</code></td>
      <td style="font-size:12.5px; color:var(--c-text-muted);">${escapeHtml(detailStr || "-")}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ----------------------------------------------------------------
   13D. BILLING (Phase 3B)
---------------------------------------------------------------- */
const BILLING_FIELDS = [
  { id: "patient", label: "Patient Name", type: "text", required: true },
  { id: "amount", label: "Amount (KES)", type: "number", required: true, min: 0 },
  { id: "status", label: "Status", type: "select", required: true, options: ["Pending", "Paid", "Cancelled"] },
  { id: "method", label: "Payment Method", type: "select", options: ["Cash", "Card", "Insurance", "M-Pesa", "Bank Transfer"] },
  { id: "description", label: "Description", type: "textarea" },
  { id: "date", label: "Date", type: "date", required: true }
];

function initBilling() {
  if (State.page !== "billing") return;
  State.collection = "billing";

  buildBillingForm();
  buildBillingFilter();

  onValue(ref(db, "billing"), (snap) => {
    State.rawData = snap.exists() ? snap.val() : {};
    renderBillingTable();
    renderBillingSummary();
  });

  const searchInput = $("searchInput");
  const searchBox = $("searchBox");
  const clearBtn = $("clearSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      State.searchTerm = e.target.value;
      searchBox.classList.toggle("has-value", State.searchTerm.length > 0);
      renderBillingTable();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      State.searchTerm = "";
      searchBox.classList.remove("has-value");
      searchInput.focus();
      renderBillingTable();
    });
  }

  const addBtn = $("addBtn");
  if (addBtn) addBtn.addEventListener("click", () => openBillingModal(null));

  const form = $("dataForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("recordId").value;
      const data = {};
      BILLING_FIELDS.forEach((f) => {
        const el = $(`f_${f.id}`);
        if (!el) return;
        const raw = el.value;
        if (f.type === "number") data[f.id] = raw === "" ? 0 : Number(raw);
        else data[f.id] = (raw || "").trim();
      });
      data.updatedAt = Date.now();

      try {
        if (id) {
          await update(ref(db, `billing/${id}`), data);
          toast("Invoice updated", "success");
          recordAudit("billing.updated", { id, ...data });
        } else {
          data.createdAt = Date.now();
          const newRef = push(ref(db, "billing"));
          await set(newRef, data);
          toast("Invoice created", "success");
          recordAudit("billing.created", { id: newRef.key, ...data });
        }
        closeModal();
      } catch (err) {
        toast("Save failed: " + err.message, "error");
      }
    });
  }
}

function buildBillingForm() {
  const form = $("dataForm");
  if (!form) return;
  const fieldsHtml = BILLING_FIELDS.map((f) => {
    if (f.type === "select") {
      return `<label for="f_${f.id}">${f.label}</label>
        <select id="f_${f.id}" ${f.required ? "required" : ""}>
          <option value="">Select ${f.label}</option>
          ${f.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
        </select>`;
    }
    if (f.type === "textarea") {
      return `<label for="f_${f.id}">${f.label}</label>
        <textarea id="f_${f.id}" rows="3" placeholder="Optional..."></textarea>`;
    }
    const extra = [
      f.min !== undefined ? `min="${f.min}"` : "",
      f.max !== undefined ? `max="${f.max}"` : ""
    ].filter(Boolean).join(" ");
    return `<label for="f_${f.id}">${f.label}</label>
      <input id="f_${f.id}" type="${f.type}" ${extra} ${f.required ? "required" : ""} placeholder="Enter ${f.label.toLowerCase()}">`;
  }).join("");

  form.innerHTML = `
    <input type="hidden" id="recordId">
    ${fieldsHtml}
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="closeModal">Cancel</button>
      <button type="submit" class="btn btn-primary">Save Invoice</button>
    </div>`;
}

function buildBillingFilter() {
  const sel = $("filterSelect");
  if (!sel) return;
  sel.innerHTML = `
    <option value="">All Statuses</option>
    <option value="Pending">Pending</option>
    <option value="Paid">Paid</option>
    <option value="Cancelled">Cancelled</option>
  `;
  sel.addEventListener("change", (e) => {
    State.filterValue = e.target.value;
    renderBillingTable();
  });
}

function renderBillingTable() {
  const tbody = $("tableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let entries = Object.entries(State.rawData);

  if (State.filterValue) {
    entries = entries.filter(([, b]) => b.status === State.filterValue);
  }

  const q = (State.searchTerm || "").trim().toLowerCase();
  if (q) {
    entries = entries.filter(([, b]) =>
      (b.patient || "").toLowerCase().includes(q) ||
      (b.description || "").toLowerCase().includes(q) ||
      (b.method || "").toLowerCase().includes(q)
    );
  }

  entries.sort((a, b) => (b[1].date || "").localeCompare(a[1].date || ""));

  const total = Object.keys(State.rawData).length;
  const countEl = $("resultCount");
  if (countEl) {
    countEl.innerHTML = `Showing <strong>${entries.length}</strong> of <strong>${total}</strong> invoice${total === 1 ? "" : "s"}`;
  }

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
      ${total === 0 ? 'No invoices yet. Click "New Invoice" to create one.' : "No invoices match your search."}
    </td></tr>`;
    return;
  }

  entries.forEach(([id, b]) => {
    const tr = document.createElement("tr");
    const statusClass = b.status === "Paid" ? "discharge" :
                       b.status === "Cancelled" ? "admit" : "transfer";
    tr.innerHTML = `
      <td>${highlight(b.patient || "-")}</td>
      <td style="font-family:var(--font-mono);font-size:13px;">KES ${Number(b.amount || 0).toLocaleString()}</td>
      <td><span class="pill ${statusClass}">${escapeHtml(b.status || "-")}</span></td>
      <td>${escapeHtml(b.method || "-")}</td>
      <td>${fmtDate(b.date)}</td>
      <td style="font-size:12.5px;color:var(--c-text-muted);">${escapeHtml((b.description || "-").slice(0, 40))}</td>
      <td class="actions">
        <button class="btn-icon print-invoice" data-id="${id}" title="Print Invoice">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
        <button class="btn-icon edit" data-id="${id}" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="btn-icon delete" data-id="${id}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-icon.edit").forEach((b) =>
    b.addEventListener("click", () => openBillingModal(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.delete").forEach((b) =>
    b.addEventListener("click", () => deleteBilling(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.print-invoice").forEach((b) =>
    b.addEventListener("click", () => printInvoice(b.dataset.id)));
}

function renderBillingSummary() {
  const entries = Object.values(State.rawData);
  let paid = 0, pending = 0, cancelled = 0;
  entries.forEach((b) => {
    const amt = Number(b.amount || 0);
    if (b.status === "Paid") paid += amt;
    else if (b.status === "Pending") pending += amt;
    else if (b.status === "Cancelled") cancelled += amt;
  });

  if ($("sumPaid")) $("sumPaid").textContent = "KES " + paid.toLocaleString();
  if ($("sumPending")) $("sumPending").textContent = "KES " + pending.toLocaleString();
  if ($("sumCancelled")) $("sumCancelled").textContent = "KES " + cancelled.toLocaleString();
  if ($("sumTotal")) $("sumTotal").textContent = "KES " + (paid + pending + cancelled).toLocaleString();
}

function openBillingModal(id) {
  const modal = $("modal");
  const title = $("modalTitle");
  const form = $("dataForm");
  form.reset();
  $("recordId").value = "";

  if (id) {
    title.textContent = "Edit Invoice";
    const item = State.rawData[id];
    $("recordId").value = id;
    BILLING_FIELDS.forEach((f) => {
      const el = $(`f_${f.id}`);
      if (el) el.value = item[f.id] ?? "";
    });
  } else {
    title.textContent = "New Invoice";
    const dateEl = $("f_date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];
  }
  modal.classList.add("active");
}

async function deleteBilling(id) {
  const item = State.rawData[id];
  const ok = await confirmDialog(`Delete invoice for ${item?.patient || "this patient"}? This cannot be undone.`);
  if (!ok) return;
  try {
    await remove(ref(db, `billing/${id}`));
    toast("Invoice deleted", "success");
    recordAudit("billing.deleted", { id, patient: item?.patient, amount: item?.amount });
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
}

async function printInvoice(id) {
  const inv = State.rawData[id];
  if (!inv) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice — ${escapeHtml(inv.patient)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { padding: 40px; color: #0f172a; }
        .letterhead {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 16px; border-bottom: 3px solid #0284c7;
          margin-bottom: 30px;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-mark {
          width: 46px; height: 46px;
          background: linear-gradient(135deg, #0ea5e9, #0f172a);
          border-radius: 10px; display: grid; place-items: center;
          color: white; font-size: 22px; font-weight: 700;
        }
        .brand h1 { font-size: 22px; color: #0f172a; letter-spacing: -0.02em; }
        .brand p { font-size: 12px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
        .letterhead-meta { font-size: 12px; color: #64748b; text-align: right; }
        h2 { font-size: 20px; color: #0284c7; margin-bottom: 6px; letter-spacing: 0.05em; text-transform: uppercase; }
        .inv-num { font-size: 12px; color: #64748b; margin-bottom: 24px; font-family: monospace; }
        .bill-box {
          background: #f8fafc; border-left: 4px solid #0ea5e9;
          padding: 18px 22px; margin-bottom: 26px;
        }
        .bill-box .row { display: flex; gap: 24px; margin-bottom: 8px; font-size: 14px; }
        .bill-box .row strong { color: #64748b; font-weight: 600; min-width: 110px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
        td.amount { text-align: right; font-family: monospace; font-size: 15px; font-weight: 600; }
        .total-row td { border-top: 2px solid #0f172a; border-bottom: none; font-weight: 700; font-size: 16px; background: #f8fafc; }
        .status-badge {
          display: inline-block; padding: 4px 12px; border-radius: 20px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .status-Paid { background: #dcfce7; color: #166534; }
        .status-Pending { background: #fef3c7; color: #92400e; }
        .status-Cancelled { background: #fee2e2; color: #991b1b; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <div class="brand">
          <div class="brand-mark">+</div>
          <div>
            <h1>MediCare Hospital</h1>
            <p>Hospital ERP System</p>
          </div>
        </div>
        <div class="letterhead-meta">
          Issued: ${fmtDate(inv.date)}<br>
          Ref: INV-${String(id).slice(-6).toUpperCase()}
        </div>
      </div>

      <h2>Invoice</h2>
      <div class="inv-num">Invoice #INV-${String(id).slice(-6).toUpperCase()}</div>

      <div class="bill-box">
        <div class="row"><strong>Billed To:</strong> ${escapeHtml(inv.patient || "-")}</div>
        <div class="row"><strong>Payment Method:</strong> ${escapeHtml(inv.method || "—")}</div>
        <div class="row"><strong>Status:</strong> <span class="status-badge status-${inv.status}">${escapeHtml(inv.status || "-")}</span></div>
      </div>

      <table>
        <thead>
          <tr><th>Description</th><th style="text-align:right;">Amount</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(inv.description || "Medical services")}</td>
            <td class="amount">KES ${Number(inv.amount || 0).toLocaleString()}</td>
          </tr>
          <tr class="total-row">
            <td>Total Due</td>
            <td class="amount">KES ${Number(inv.amount || 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Thank you for choosing MediCare Hospital · This is a computer-generated invoice
      </div>

      <script>window.onload = () => window.print();</script>
    </body>
    </html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}
window.printInvoice = printInvoice;
/* ----------------------------------------------------------------
   13E. PHARMACY (Phase 3C)
---------------------------------------------------------------- */
const PHARMACY_FIELDS = [
  { id: "name", label: "Medication Name", type: "text", required: true },
  { id: "category", label: "Category", type: "select", required: true, options: ["Antibiotic", "Analgesic", "Antimalarial", "Antihypertensive", "Antidiabetic", "Antiviral", "Vaccine", "Supplement", "Other"] },
  { id: "stock", label: "Stock Quantity", type: "number", required: true, min: 0 },
  { id: "reorderLevel", label: "Reorder Level", type: "number", required: true, min: 0 },
  { id: "unitPrice", label: "Unit Price (KES)", type: "number", required: true, min: 0 },
  { id: "expiry", label: "Expiry Date", type: "date" },
  { id: "supplier", label: "Supplier", type: "text" }
];
function initPharmacy() {
  if (State.page !== "pharmacy") return;
  State.collection = "pharmacy";

  buildPharmacyForm();
  buildPharmacyFilter();

  onValue(ref(db, "pharmacy"), (snap) => {
    State.rawData = snap.exists() ? snap.val() : {};
    renderPharmacyTable();
    renderPharmacySummary();
  });

  const searchInput = $("searchInput");
  const searchBox = $("searchBox");
  const clearBtn = $("clearSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      State.searchTerm = e.target.value;
      searchBox.classList.toggle("has-value", State.searchTerm.length > 0);
      renderPharmacyTable();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      State.searchTerm = "";
      searchBox.classList.remove("has-value");
      searchInput.focus();
      renderPharmacyTable();
    });
  }

  const addBtn = $("addBtn");
  if (addBtn) addBtn.addEventListener("click", () => openPharmacyModal(null));

  const form = $("dataForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("recordId").value;
      const data = {};
      PHARMACY_FIELDS.forEach((f) => {
        const el = $(`f_${f.id}`);
        if (!el) return;
        const raw = el.value;
        if (f.type === "number") data[f.id] = raw === "" ? 0 : Number(raw);
        else data[f.id] = (raw || "").trim();
      });
      data.updatedAt = Date.now();

      try {
        if (id) {
          await update(ref(db, `pharmacy/${id}`), data);
          toast("Medication updated", "success");
          recordAudit("pharmacy.updated", { id, name: data.name });
        } else {
          data.createdAt = Date.now();
          const newRef = push(ref(db, "pharmacy"));
          await set(newRef, data);
          toast("Medication added", "success");
          recordAudit("pharmacy.created", { id: newRef.key, name: data.name });
        }
        closeModal();
      } catch (err) {
        toast("Save failed: " + err.message, "error");
      }
    });
  }
}

function buildPharmacyForm() {
  const form = $("dataForm");
  if (!form) return;
  const fieldsHtml = PHARMACY_FIELDS.map((f) => {
    if (f.type === "select") {
      return `<label for="f_${f.id}">${f.label}</label>
        <select id="f_${f.id}" ${f.required ? "required" : ""}>
          <option value="">Select ${f.label}</option>
          ${f.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
        </select>`;
    }
    if (f.type === "textarea") {
      return `<label for="f_${f.id}">${f.label}</label>
        <textarea id="f_${f.id}" rows="3" placeholder="Optional..."></textarea>`;
    }
    const extra = [
      f.min !== undefined ? `min="${f.min}"` : "",
      f.max !== undefined ? `max="${f.max}"` : ""
    ].filter(Boolean).join(" ");
    return `<label for="f_${f.id}">${f.label}</label>
      <input id="f_${f.id}" type="${f.type}" ${extra} ${f.required ? "required" : ""} placeholder="Enter ${f.label.toLowerCase()}">`;
  }).join("");

  form.innerHTML = `
    <input type="hidden" id="recordId">
    ${fieldsHtml}
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="closeModal">Cancel</button>
      <button type="submit" class="btn btn-primary">Save Medication</button>
    </div>`;
}

function buildPharmacyFilter() {
  const sel = $("filterSelect");
  if (!sel) return;
  sel.innerHTML = `
    <option value="">All Medications</option>
    <option value="low">Low Stock</option>
    <option value="out">Out of Stock</option>
    <option value="expiring">Expiring Soon (30 days)</option>
    <option value="expired">Expired</option>
  `;
  sel.addEventListener("change", (e) => {
    State.filterValue = e.target.value;
    renderPharmacyTable();
  });
}

function renderPharmacyTable() {
  const tbody = $("tableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let entries = Object.entries(State.rawData);
  const today = new Date().toISOString().split("T")[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Filter
  if (State.filterValue) {
    entries = entries.filter(([, m]) => {
      const stock = Number(m.stock || 0);
      const reorder = Number(m.reorderLevel || 0);
      const exp = m.expiry || "";
      if (State.filterValue === "low") return stock > 0 && stock <= reorder;
      if (State.filterValue === "out") return stock === 0;
      if (State.filterValue === "expired") return exp && exp < today;
      if (State.filterValue === "expiring") return exp && exp >= today && exp <= cutoffStr;
      return true;
    });
  }

  // Search
  const q = (State.searchTerm || "").trim().toLowerCase();
  if (q) {
    entries = entries.filter(([, m]) =>
      (m.name || "").toLowerCase().includes(q) ||
      (m.category || "").toLowerCase().includes(q) ||
      (m.supplier || "").toLowerCase().includes(q)
    );
  }

  entries.sort((a, b) => (a[1].name || "").localeCompare(b[1].name || ""));

  const total = Object.keys(State.rawData).length;
  const countEl = $("resultCount");
  if (countEl) {
    countEl.innerHTML = `Showing <strong>${entries.length}</strong> of <strong>${total}</strong> medication${total === 1 ? "" : "s"}`;
  }

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">
      ${total === 0 ? 'No medications yet. Click "Add Medication" to create one.' : "No medications match your filter."}
    </td></tr>`;
    return;
  }

  entries.forEach(([id, m]) => {
    const stock = Number(m.stock || 0);
    const reorder = Number(m.reorderLevel || 0);
    const exp = m.expiry || "";

    let stockBadge = `<span class="pill discharge">${stock} in stock</span>`;
    if (stock === 0) stockBadge = `<span class="pill admit">Out of Stock</span>`;
    else if (stock <= reorder) stockBadge = `<span class="pill transfer">Low: ${stock}</span>`;

    let expiryBadge = exp ? fmtDate(exp) : "—";
    if (exp && exp < today) expiryBadge = `<span style="color:var(--c-danger);font-weight:600;">${fmtDate(exp)} (Expired)</span>`;
    else if (exp && exp <= cutoffStr) expiryBadge = `<span style="color:var(--c-warning);font-weight:600;">${fmtDate(exp)}</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${highlight(m.name || "-")}</td>
      <td>${escapeHtml(m.category || "-")}</td>
      <td>${stockBadge}</td>
      <td>${reorder}</td>
      <td style="font-family:var(--font-mono);font-size:13px;">KES ${Number(m.unitPrice || 0).toLocaleString()}</td>
      <td>${expiryBadge}</td>
      <td>${escapeHtml(m.supplier || "-")}</td>
      <td class="actions">
        <button class="btn-icon dispense" data-id="${id}" title="Dispense" ${stock === 0 ? "disabled" : ""}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
        <button class="btn-icon edit" data-id="${id}" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="btn-icon delete" data-id="${id}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-icon.edit").forEach((b) =>
    b.addEventListener("click", () => openPharmacyModal(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.delete").forEach((b) =>
    b.addEventListener("click", () => deletePharmacy(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.dispense").forEach((b) =>
    b.addEventListener("click", () => dispenseMedication(b.dataset.id)));
}

function renderPharmacySummary() {
  const items = Object.values(State.rawData);
  let totalItems = items.length;
  let lowStock = 0;
  let outOfStock = 0;
  let expired = 0;
  let totalValue = 0;

  const today = new Date().toISOString().split("T")[0];

  items.forEach((m) => {
    const stock = Number(m.stock || 0);
    const reorder = Number(m.reorderLevel || 0);
    const price = Number(m.unitPrice || 0);
    if (stock === 0) outOfStock++;
    else if (stock <= reorder) lowStock++;
    if (m.expiry && m.expiry < today) expired++;
    totalValue += stock * price;
  });

  if ($("sumItems")) $("sumItems").textContent = totalItems;
  if ($("sumLow")) $("sumLow").textContent = lowStock;
  if ($("sumOut")) $("sumOut").textContent = outOfStock;
  if ($("sumExpired")) $("sumExpired").textContent = expired;
  if ($("sumValue")) $("sumValue").textContent = "KES " + totalValue.toLocaleString();
}

function openPharmacyModal(id) {
  const modal = $("modal");
  const title = $("modalTitle");
  const form = $("dataForm");
  form.reset();
  $("recordId").value = "";

  if (id) {
    title.textContent = "Edit Medication";
    const item = State.rawData[id];
    $("recordId").value = id;
    PHARMACY_FIELDS.forEach((f) => {
      const el = $(`f_${f.id}`);
      if (el) el.value = item[f.id] ?? "";
    });
  } else {
    title.textContent = "Add Medication";
  }
  modal.classList.add("active");
}

async function deletePharmacy(id) {
  const item = State.rawData[id];
  const ok = await confirmDialog(`Delete "${item?.name || "this medication"}"? This cannot be undone.`);
  if (!ok) return;
  try {
    await remove(ref(db, `pharmacy/${id}`));
    toast("Medication deleted", "success");
    recordAudit("pharmacy.deleted", { id, name: item?.name });
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
}

async function dispenseMedication(id) {
  const med = State.rawData[id];
  if (!med) return;

  const quantityStr = prompt(`Dispense how many units of "${med.name}"?\n(Currently: ${med.stock} in stock)`, "1");
  if (quantityStr === null) return;

  const quantity = Number(quantityStr);
  if (!quantity || quantity <= 0) {
    toast("Invalid quantity", "error");
    return;
  }
  if (quantity > Number(med.stock || 0)) {
    toast("Not enough stock", "error");
    return;
  }

  const newStock = Number(med.stock || 0) - quantity;

  try {
    await update(ref(db, `pharmacy/${id}`), {
      stock: newStock,
      updatedAt: Date.now()
    });

    await push(ref(db, "pharmacyLog"), {
      medicationId: id,
      medicationName: med.name,
      quantity,
      remaining: newStock,
      staff: State.user.email,
      timestamp: Date.now()
    });

    toast(`Dispensed ${quantity} × ${med.name}`, "success");
    recordAudit("pharmacy.dispensed", { name: med.name, quantity, remaining: newStock });

    if (newStock === 0) toast(`⚠ ${med.name} is now OUT OF STOCK`, "error");
    else if (newStock <= Number(med.reorderLevel || 0)) {
      toast(`Low stock alert: ${med.name}`, "error");
    }
  } catch (err) {
    toast("Dispense failed: " + err.message, "error");
  }
}
/* ----------------------------------------------------------------
   13F. LAB TESTS (Phase 3D)
---------------------------------------------------------------- */
const LAB_FIELDS = [
  { id: "patient", label: "Patient Name", type: "text", required: true },
  { id: "testType", label: "Test Type", type: "select", required: true, options: [
      "Blood Test", "Urinalysis", "X-Ray", "Ultrasound", "CT Scan", "MRI",
      "ECG", "Stool Test", "Culture & Sensitivity", "Biopsy", "Other"
  ]},
  { id: "doctor", label: "Ordering Doctor", type: "text", required: true },
  { id: "status", label: "Status", type: "select", required: true, options: ["Pending", "In Progress", "Completed", "Cancelled"] },
  { id: "orderedDate", label: "Ordered Date", type: "date", required: true },
  { id: "resultDate", label: "Result Date", type: "date" },
  { id: "result", label: "Results / Findings", type: "textarea" },
  { id: "notes", label: "Notes", type: "textarea" }
];
function initLab() {
  if (State.page !== "lab") return;
  State.collection = "lab";

  buildLabForm();
  buildLabFilter();

  onValue(ref(db, "lab"), (snap) => {
    State.rawData = snap.exists() ? snap.val() : {};
    renderLabTable();
    renderLabSummary();
  });

  const searchInput = $("searchInput");
  const searchBox = $("searchBox");
  const clearBtn = $("clearSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      State.searchTerm = e.target.value;
      searchBox.classList.toggle("has-value", State.searchTerm.length > 0);
      renderLabTable();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      State.searchTerm = "";
      searchBox.classList.remove("has-value");
      searchInput.focus();
      renderLabTable();
    });
  }

  const addBtn = $("addBtn");
  if (addBtn) addBtn.addEventListener("click", () => openLabModal(null));

  const form = $("dataForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("recordId").value;
      const data = {};
      LAB_FIELDS.forEach((f) => {
        const el = $(`f_${f.id}`);
        if (el) data[f.id] = (el.value || "").trim();
      });
      data.updatedAt = Date.now();

      try {
        if (id) {
          await update(ref(db, `lab/${id}`), data);
          toast("Lab test updated", "success");
          recordAudit("lab.updated", { id, patient: data.patient, testType: data.testType });
        } else {
          data.createdAt = Date.now();
          const newRef = push(ref(db, "lab"));
          await set(newRef, data);
          toast("Lab test ordered", "success");
          recordAudit("lab.created", { id: newRef.key, patient: data.patient, testType: data.testType });
        }
        closeModal();
      } catch (err) {
        toast("Save failed: " + err.message, "error");
      }
    });
  }
}

function buildLabForm() {
  const form = $("dataForm");
  if (!form) return;
  const fieldsHtml = LAB_FIELDS.map((f) => {
    if (f.type === "select") {
      return `<label for="f_${f.id}">${f.label}</label>
        <select id="f_${f.id}" ${f.required ? "required" : ""}>
          <option value="">Select ${f.label}</option>
          ${f.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
        </select>`;
    }
    if (f.type === "textarea") {
      return `<label for="f_${f.id}">${f.label}</label>
        <textarea id="f_${f.id}" rows="3" placeholder="Optional..."></textarea>`;
    }
    return `<label for="f_${f.id}">${f.label}</label>
      <input id="f_${f.id}" type="${f.type}" ${f.required ? "required" : ""} placeholder="Enter ${f.label.toLowerCase()}">`;
  }).join("");

  form.innerHTML = `
    <input type="hidden" id="recordId">
    ${fieldsHtml}
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="closeModal">Cancel</button>
      <button type="submit" class="btn btn-primary">Save Lab Test</button>
    </div>`;
}

function buildLabFilter() {
  const sel = $("filterSelect");
  if (!sel) return;
  sel.innerHTML = `
    <option value="">All Statuses</option>
    <option value="Pending">Pending</option>
    <option value="In Progress">In Progress</option>
    <option value="Completed">Completed</option>
    <option value="Cancelled">Cancelled</option>
  `;
  sel.addEventListener("change", (e) => {
    State.filterValue = e.target.value;
    renderLabTable();
  });
}

function renderLabTable() {
  const tbody = $("tableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let entries = Object.entries(State.rawData);

  if (State.filterValue) {
    entries = entries.filter(([, t]) => t.status === State.filterValue);
  }

  const q = (State.searchTerm || "").trim().toLowerCase();
  if (q) {
    entries = entries.filter(([, t]) =>
      (t.patient || "").toLowerCase().includes(q) ||
      (t.testType || "").toLowerCase().includes(q) ||
      (t.doctor || "").toLowerCase().includes(q)
    );
  }

  entries.sort((a, b) => (b[1].orderedDate || "").localeCompare(a[1].orderedDate || ""));

  const total = Object.keys(State.rawData).length;
  const countEl = $("resultCount");
  if (countEl) {
    countEl.innerHTML = `Showing <strong>${entries.length}</strong> of <strong>${total}</strong> test${total === 1 ? "" : "s"}`;
  }

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
      ${total === 0 ? 'No lab tests yet. Click "Order Test" to create one.' : "No lab tests match your search."}
    </td></tr>`;
    return;
  }

  entries.forEach(([id, t]) => {
    const statusClass = t.status === "Completed" ? "discharge" :
                       t.status === "Cancelled" ? "admit" :
                       t.status === "In Progress" ? "transfer" : "pending";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${highlight(t.patient || "-")}</td>
      <td>${escapeHtml(t.testType || "-")}</td>
      <td>${escapeHtml(t.doctor || "-")}</td>
      <td><span class="pill ${statusClass}">${escapeHtml(t.status || "-")}</span></td>
      <td>${fmtDate(t.orderedDate)}</td>
      <td>${t.resultDate ? fmtDate(t.resultDate) : "-"}</td>
      <td class="actions">
        <button class="btn-icon print-lab" data-id="${id}" title="Print Report">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
        <button class="btn-icon edit" data-id="${id}" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="btn-icon delete" data-id="${id}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-icon.edit").forEach((b) =>
    b.addEventListener("click", () => openLabModal(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.delete").forEach((b) =>
    b.addEventListener("click", () => deleteLab(b.dataset.id)));
  tbody.querySelectorAll(".btn-icon.print-lab").forEach((b) =>
    b.addEventListener("click", () => printLabReport(b.dataset.id)));
}

function renderLabSummary() {
  const items = Object.values(State.rawData);
  let pending = 0, inProgress = 0, completed = 0, cancelled = 0;

  items.forEach((t) => {
    if (t.status === "Pending") pending++;
    else if (t.status === "In Progress") inProgress++;
    else if (t.status === "Completed") completed++;
    else if (t.status === "Cancelled") cancelled++;
  });

  if ($("sumPending")) $("sumPending").textContent = pending;
  if ($("sumProgress")) $("sumProgress").textContent = inProgress;
  if ($("sumCompleted")) $("sumCompleted").textContent = completed;
  if ($("sumCancelled")) $("sumCancelled").textContent = cancelled;
  if ($("sumTotal")) $("sumTotal").textContent = items.length;
}

function openLabModal(id) {
  const modal = $("modal");
  const title = $("modalTitle");
  const form = $("dataForm");
  form.reset();
  $("recordId").value = "";

  if (id) {
    title.textContent = "Edit Lab Test";
    const item = State.rawData[id];
    $("recordId").value = id;
    LAB_FIELDS.forEach((f) => {
      const el = $(`f_${f.id}`);
      if (el) el.value = item[f.id] ?? "";
    });
  } else {
    title.textContent = "Order Lab Test";
    const orderedEl = $("f_orderedDate");
    if (orderedEl) orderedEl.value = new Date().toISOString().split("T")[0];
  }
  modal.classList.add("active");
}

async function deleteLab(id) {
  const item = State.rawData[id];
  const ok = await confirmDialog(`Delete lab test for ${item?.patient || "this patient"}? This cannot be undone.`);
  if (!ok) return;
  try {
    await remove(ref(db, `lab/${id}`));
    toast("Lab test deleted", "success");
    recordAudit("lab.deleted", { id, patient: item?.patient, testType: item?.testType });
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
}

async function printLabReport(id) {
  const t = State.rawData[id];
  if (!t) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lab Report — ${escapeHtml(t.patient)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { padding: 40px; color: #0f172a; }
        .letterhead {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 16px; border-bottom: 3px solid #0284c7;
          margin-bottom: 30px;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-mark {
          width: 46px; height: 46px;
          background: linear-gradient(135deg, #0ea5e9, #0f172a);
          border-radius: 10px; display: grid; place-items: center;
          color: white; font-size: 22px; font-weight: 700;
        }
        .brand h1 { font-size: 22px; letter-spacing: -0.02em; }
        .brand p { font-size: 12px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
        .letterhead-meta { font-size: 12px; color: #64748b; text-align: right; }
        h2 { font-size: 20px; color: #0284c7; margin-bottom: 6px; letter-spacing: 0.05em; text-transform: uppercase; }
        .ref { font-size: 12px; color: #64748b; margin-bottom: 24px; font-family: monospace; }
        .info-box {
          background: #f8fafc; border-left: 4px solid #0ea5e9;
          padding: 18px 22px; margin-bottom: 26px;
        }
        .info-box .row { display: flex; gap: 24px; margin-bottom: 8px; font-size: 14px; }
        .info-box .row strong { color: #64748b; font-weight: 600; min-width: 130px; }
        .section { margin-bottom: 26px; }
        .section h3 { font-size: 13px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .section p { font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
        .results-box {
          background: white; border: 1px solid #e2e8f0; border-radius: 8px;
          padding: 20px; min-height: 100px;
          font-family: monospace; font-size: 14px; line-height: 1.7;
          white-space: pre-wrap;
        }
        .status-badge {
          display: inline-block; padding: 4px 12px; border-radius: 20px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .status-Completed { background: #dcfce7; color: #166534; }
        .status-Pending { background: #fef3c7; color: #92400e; }
        .status-In-Progress { background: #dbeafe; color: #1e40af; }
        .status-Cancelled { background: #fee2e2; color: #991b1b; }
        .signature { margin-top: 60px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
        .signature-line { width: 220px; height: 1px; background: #0f172a; margin-bottom: 6px; }
        .signature-label { font-size: 12px; color: #64748b; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <div class="brand">
          <div class="brand-mark">+</div>
          <div>
            <h1>MediCare Hospital</h1>
            <p>Laboratory Report</p>
          </div>
        </div>
        <div class="letterhead-meta">
          Ordered: ${fmtDate(t.orderedDate)}<br>
          ${t.resultDate ? "Result: " + fmtDate(t.resultDate) : ""}<br>
          Ref: LAB-${String(id).slice(-6).toUpperCase()}
        </div>
      </div>

      <h2>Laboratory Report</h2>
      <div class="ref">Report #LAB-${String(id).slice(-6).toUpperCase()}</div>

      <div class="info-box">
        <div class="row"><strong>Patient:</strong> ${escapeHtml(t.patient || "-")}</div>
        <div class="row"><strong>Test Type:</strong> ${escapeHtml(t.testType || "-")}</div>
        <div class="row"><strong>Ordered By:</strong> ${escapeHtml(t.doctor || "-")}</div>
        <div class="row"><strong>Status:</strong> <span class="status-badge status-${(t.status || "").replace(/\s+/g, "-")}">${escapeHtml(t.status || "-")}</span></div>
      </div>

      <div class="section">
        <h3>Results / Findings</h3>
        <div class="results-box">${escapeHtml(t.result || "Pending results — no data yet.")}</div>
      </div>

      ${t.notes ? `
        <div class="section">
          <h3>Clinical Notes</h3>
          <p>${escapeHtml(t.notes)}</p>
        </div>
      ` : ""}

      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-label">Lab Technician / Pathologist — Signature</div>
      </div>

      <div class="footer">
        This is a computer-generated lab report · MediCare Hospital ERP
      </div>

      <script>window.onload = () => window.print();</script>
    </body>
    </html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}
window.printLabReport = printLabReport;

/* ----------------------------------------------------------------
   14. PHASE 1 FEATURES — Print, CSV, Global Search
---------------------------------------------------------------- */
function printPage() {
  window.print();
}
window.printPage = printPage;

function exportCSV() {
  const cfg = COLLECTION_CONFIG[State.collection];
  if (!cfg) {
    toast("Nothing to export here.", "info");
    return;
  }
  const entries = Object.entries(State.rawData);
  if (entries.length === 0) {
    toast("Nothing to export.", "info");
    return;
  }

  const headers = [...cfg.columns.map((c) => c.label), "Created At", "Updated At"];
  const rows = entries.map(([, item]) => [
    ...cfg.columns.map((c) => item[c.key] ?? ""),
    item.createdAt ? fmtDateTime(item.createdAt) : "",
    item.updatedAt ? fmtDateTime(item.updatedAt) : ""
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${State.collection}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("CSV downloaded", "success");
}
window.exportCSV = exportCSV;

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const SEARCH_INDEX = [
  { collection: "patients",     page: "patients.html",     icon: "P", label: "Patient",     keys: ["name", "diagnosis"], idKey: "name" },
  { collection: "staff",        page: "staff.html",        icon: "S", label: "Staff",       keys: ["name", "role", "department", "email"], idKey: "name" },
  { collection: "appointments", page: "appointments.html", icon: "A", label: "Appointment", keys: ["patient", "doctor", "reason"], idKey: "patient" },
  { collection: "records",      page: "records.html",      icon: "R", label: "Record",      keys: ["patient", "diagnosis"], idKey: "patient" }
];

function initGlobalSearch() {
  const input = $("globalSearch");
  if (!input) return;
  const results = $("globalSearchResults");
  if (!results) return;

  input.addEventListener("input", debounce(async (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (q.length < 2) {
      results.innerHTML = "";
      results.classList.remove("active");
      return;
    }
    renderGlobalResults(q);
  }, 180));

  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 2) results.classList.add("active");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".global-search-wrap")) {
      results.classList.remove("active");
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      results.classList.remove("active");
    }
  });
}

async function renderGlobalResults(q) {
  const results = $("globalSearchResults");
  if (!results) return;
  results.innerHTML = `<div class="global-search-loading">Searching…</div>`;
  results.classList.add("active");

  const hits = [];
  await Promise.all(
    SEARCH_INDEX.map(async (idx) => {
      const snap = await get(ref(db, idx.collection));
      if (!snap.exists()) return;
      Object.entries(snap.val()).forEach(([id, item]) => {
        const match = idx.keys.some((k) =>
          String(item[k] || "").toLowerCase().includes(q)
        );
        if (match) {
          hits.push({
            ...idx,
            id,
            title: item[idx.idKey] || item.name || item.patient || "Untitled",
            subtitle: [item.diagnosis, item.role, item.department, item.doctor, item.reason]
              .filter(Boolean).join(" · ") || idx.label
          });
        }
      });
    })
  );

  if (hits.length === 0) {
    results.innerHTML = `<div class="global-search-empty">No matches for "${escapeHtml(q)}"</div>`;
    return;
  }

  results.innerHTML = hits
    .slice(0, 12)
    .map((h) => `
      <a href="${h.page}" class="global-result">
        <div class="global-result-icon">${h.icon}</div>
        <div class="global-result-info">
          <div class="global-result-title">${highlightTerm(h.title, q)}</div>
          <div class="global-result-meta">${h.label} · ${escapeHtml(h.subtitle)}</div>
        </div>
      </a>
    `)
    .join("");
}

function highlightTerm(text, q) {
  const safe = escapeHtml(String(text));
  return safe.replace(new RegExp(`(${escapeRegex(q)})`, "ig"), "<mark>$1</mark>");
}

/* ----------------------------------------------------------------
   15. GLOBAL EVENT DELEGATION
---------------------------------------------------------------- */
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-action='print']")) printPage();
  if (e.target.closest("[data-action='export-csv']")) exportCSV();
  if (e.target.closest("[data-action='closeModal']")) closeModal();
  const modal = e.target.closest(".modal");
  if (modal && e.target === modal) modal.classList.remove("active");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* ----------------------------------------------------------------
   16. BOOTSTRAP
---------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initLayout();
  initDashboard();
  initCRUD();
  initBeds();
  initGlobalSearch();
  initAudit();
  initBilling();
  initPharmacy();
  initLab();
});
  // More inits added in later sub-steps:
  // initBilling();
  // initPharmacy();
  // initLab();
  // initNotifications();
;