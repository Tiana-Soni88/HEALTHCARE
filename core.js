// ================================================================
//  MediCare ERP — core.js
//  Single JavaScript file for the entire hospital system.
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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
   Replace this object with YOUR firebaseConfig from Firebase Console.
---------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCWrZo-O2H9EoR69MiB9vCZqGNJFBboOu8",
  authDomain: "hospital-erp.firebaseapp.com",
  databaseURL: "https://hospital-erp-default-rtdb.firebaseio.com",
  projectId: "hospital-erp",
  storageBucket: "hospital-erp.firebasestorage.app",
  messagingSenderId: "792475150915",
  appId: "1:792475150915:web:4f43dd08b8ef3ee7ae82f6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ----------------------------------------------------------------
   2. GLOBAL STATE
---------------------------------------------------------------- */
const State = {
  user: null,
  page: document.body.dataset.page || "dashboard",
  collection: null,
  rawData: {},
  searchTerm: "",
  filterValue: "",
  bedsData: {},
  historyData: {}
};

/* ----------------------------------------------------------------
   3. UTILITIES
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

/* ----------------------------------------------------------------
   4. LOGIN PAGE
---------------------------------------------------------------- */
function initLogin() {
  const form = $("loginForm");
  if (!form) return;

  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
  });

  // Password reveal
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
    const btn = $("loginBtn");
    const err = $("errorMsg");

    btn.disabled = true;
    btn.textContent = "Signing in...";
    err.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (error) {
      err.textContent = friendlyAuthError(error.code);
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });
}

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "Configuration error. Contact administrator."
  };
  return map[code] || "Unable to sign in. Please try again.";
}

/* ----------------------------------------------------------------
   5. LAYOUT (auth guard, user badge, logout, clock, menu)
---------------------------------------------------------------- */
function initLayout() {
  const emailBadge = $("userEmail");
  const avatar = $("userAvatar");

  if (emailBadge || avatar) {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      State.user = user;
      if (emailBadge) {
        emailBadge.textContent = user.email;
        emailBadge.title = user.email;
      }
      if (avatar) {
        avatar.textContent = (user.email[0] || "U").toUpperCase();
      }
    });
  }

  // Logout
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='logout']")) {
      signOut(auth).then(() => (window.location.href = "index.html"));
    }
  });

  // Mobile sidebar
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

  // Live clock
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
   6. DASHBOARD
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
            <span class="pill ${ev.action}">${ev.action === "admit" ? "Admitted" : "Discharged"}</span>
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
   7. CRUD PAGES (patients, staff, appointments, records)
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
    searchKeys: ["name", "diagnosis", "gender"]
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
    searchKeys: ["patient", "doctor", "reason"]
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
    searchKeys: ["patient", "diagnosis", "prescription"]
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
          data[f.id] = f.type === "number" ? Number(el.value) : el.value.trim();
        }
      });
      data.updatedAt = Date.now();

      try {
        if (id) {
          await update(ref(db, `${State.collection}/${id}`), data);
          toast(`${cfg.singular} updated`, "success");
        } else {
          data.createdAt = Date.now();
          const newRef = push(ref(db, State.collection));
          await set(newRef, data);
          toast(`${cfg.singular} created`, "success");
        }
        closeModal();
      } catch (err) {
        toast("Save failed: " + err.message, "error");
      }
    });
  }
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
    tr.innerHTML = cfg.columns.map((col) => {
      const raw = item[col.key];
      const val = col.format ? col.format(raw) : (raw ?? "-");
      const cell = col.highlight ? highlight(String(val)) : escapeHtml(String(val));
      return `<td>${cell}</td>`;
    }).join("") +
      `<td class="actions">
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
  const ok = await confirmDialog(`Delete this ${cfg.singular.toLowerCase()}? This cannot be undone.`);
  if (!ok) return;
  try {
    await remove(ref(db, `${State.collection}/${id}`));
    toast(`${cfg.singular} deleted`, "success");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
}

/* ----------------------------------------------------------------
   8. BEDS PAGE
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

        toast(`${name} admitted to ${bedId}`, "success");
      } else {
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

        toast(`${name} discharged from ${bedId}`, "success");
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

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='closeModal']")) closeModal();
  });
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

  $("mWardKey").value = wardKey;
  $("mBedId").value = bedId;
  $("mBedIdDisplay").value = bedId;

  const patientFields = $("patientFields");
  const dischargeMsg = $("dischargeMessage");
  const submitBtn = $("bedSubmitBtn");
  const title = $("bedModalTitle");
  const form = $("bedForm");
  form.reset();
  $("mWardKey").value = wardKey;
  $("mBedId").value = bedId;
  $("mBedIdDisplay").value = bedId;

  if (status === "available") {
    $("mAction").value = "admit";
    title.textContent = "Admit Patient";
    submitBtn.textContent = "Admit";
    submitBtn.className = "btn btn-primary";
    patientFields.style.display = "block";
    dischargeMsg.style.display = "none";
    $("mPatientName").required = true;
  } else {
    $("mAction").value = "discharge";
    title.textContent = "Discharge Patient";
    submitBtn.textContent = "Discharge";
    submitBtn.className = "btn btn-danger";
    patientFields.style.display = "none";
    dischargeMsg.style.display = "block";
    $("mPatientName").required = false;
    const bed = State.bedsData[wardKey]?.beds?.[bedId];
    if (bed) {
      $("dischargePatientName").textContent = bed.patientName || "-";
      $("dischargeMeta").textContent =
        `Admitted ${fmtDateTime(bed.admittedAt)} · By ${bed.admittedBy || "-"}`;
    }
  }
  modal.classList.add("active");
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
    tr.innerHTML = `
      <td>${fmtDateTime(h.timestamp)}</td>
      <td><span class="pill ${h.action}">${h.action === "admit" ? "Admitted" : "Discharged"}</span></td>
      <td>${escapeHtml(h.wardLabel || h.ward || "-")}</td>
      <td>${escapeHtml(h.bedId || "-")}</td>
      <td>${escapeHtml(h.patientName || "-")}</td>
      <td>${escapeHtml(h.staff || "-")}</td>`;
    tbody.appendChild(tr);
  });
}

/* ----------------------------------------------------------------
   9. GLOBAL EVENT DELEGATION (close modals, etc.)
---------------------------------------------------------------- */
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-action='closeModal']")) closeModal();
  const modal = e.target.closest(".modal");
  if (modal && e.target === modal) modal.classList.remove("active");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* ----------------------------------------------------------------
   10. BOOTSTRAP
---------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initLayout();
  initDashboard();
  initCRUD();
  initBeds();
});