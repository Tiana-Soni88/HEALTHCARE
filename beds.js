import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, onValue, update, set, get, push, remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ---------- Ward Configuration ----------
const WARDS = {
  generalMale:   { label: "General Ward — Male",   prefix: "G-M", capacity: 20, group: "general" },
  generalFemale: { label: "General Ward — Female", prefix: "G-F", capacity: 20, group: "general" },
  icuMale:       { label: "ICU — Male",            prefix: "I-M", capacity: 8,  group: "icu" },
  icuFemale:     { label: "ICU — Female",          prefix: "I-F", capacity: 8,  group: "icu" }
};

const bedsRootRef = ref(db, "beds");
const historyRef = ref(db, "bedHistory");

let currentUser = null;
let liveBedsData = null;

// ---------- Auth + Seed ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  document.getElementById("userEmail").textContent = "👤 " + user.email;

  // Seed default structure if empty
  const snap = await get(bedsRootRef);
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
    await set(bedsRootRef, seed);
  }

  // Listen for bed changes
  onValue(bedsRootRef, (s) => {
    liveBedsData = s.val() || {};
    renderWards(liveBedsData);
    renderSummary(liveBedsData);
  });
});

function buildEmptyBeds(prefix, capacity) {
  const beds = {};
  for (let i = 1; i <= capacity; i++) {
    const id = `${prefix}-${String(i).padStart(2, "0")}`;
    beds[id] = { status: "available" };
  }
  return beds;
}

// ---------- Render wards ----------
function renderWards(data) {
  const generalContainer = document.getElementById("generalWards");
  const icuContainer = document.getElementById("icuWards");
  generalContainer.innerHTML = "";
  icuContainer.innerHTML = "";

  Object.entries(WARDS).forEach(([key, cfg]) => {
    const wardData = data[key];
    if (!wardData) return;

    const card = buildWardCard(key, wardData);
    if (cfg.group === "general") generalContainer.appendChild(card);
    else icuContainer.appendChild(card);
  });
}

function buildWardCard(key, ward) {
  const beds = ward.beds || {};
  const bedList = Object.entries(beds);
  const occupied = bedList.filter(([, b]) => b.status === "occupied").length;
  const total = bedList.length;
  const available = total - occupied;

  const wrapper = document.createElement("div");
  wrapper.style.marginBottom = "24px";
  wrapper.innerHTML = `
    <div class="ward-stats">
      <span>🏷 <strong>${ward.label}</strong></span>
      <span>Total: <strong>${total}</strong></span>
      <span>Occupied: <strong style="color:#ef4444;">${occupied}</strong></span>
      <span>Available: <strong style="color:#10b981;">${available}</strong></span>
      <button class="secondary-btn edit-capacity-btn" data-key="${key}" style="margin-left:auto; font-size:12px; padding:6px 12px;">
        ✏️ Edit Capacity
      </button>
    </div>
    <div class="bed-tiles">
      ${bedList.map(([bedId, bed]) => renderBedTile(key, bedId, bed)).join("")}
    </div>
  `;

  // Attach click handlers to bed tiles
  wrapper.querySelectorAll(".bed-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      openBedModal(tile.dataset.ward, tile.dataset.bedId, tile.dataset.status);
    });
  });

  // Edit capacity button
  wrapper.querySelector(".edit-capacity-btn").addEventListener("click", () => {
    openCapacityModal(key);
  });

  return wrapper;
}

function renderBedTile(wardKey, bedId, bed) {
  const isOccupied = bed.status === "occupied";
  return `
    <div class="bed-tile ${isOccupied ? "occupied" : ""}"
         data-ward="${wardKey}"
         data-bed-id="${bedId}"
         data-status="${bed.status}">
      <div class="bed-id">${bedId}</div>
      <div class="bed-patient">${isOccupied ? escapeHtml(bed.patientName || "-") : "Empty"}</div>
      <div class="bed-status">${isOccupied ? "Occupied" : "Available"}</div>
    </div>
  `;
}

function renderSummary(data) {
  let total = 0, occupied = 0;
  Object.values(data).forEach((ward) => {
    const beds = ward.beds || {};
    const list = Object.values(beds);
    total += list.length;
    occupied += list.filter((b) => b.status === "occupied").length;
  });
  const available = total - occupied;
  const rate = total === 0 ? 0 : Math.round((occupied / total) * 100);

  document.getElementById("sumTotal").textContent = total;
  document.getElementById("sumOccupied").textContent = occupied;
  document.getElementById("sumAvailable").textContent = available;
  document.getElementById("sumRate").innerHTML = `${rate}<span>%</span>`;
}

// ---------- Admit / Discharge Modal ----------
window.openBedModal = function (wardKey, bedId, status) {
  document.getElementById("mWardKey").value = wardKey;
  document.getElementById("mBedId").value = bedId;
  document.getElementById("mBedIdDisplay").value = bedId;

  const patientFields = document.getElementById("patientFields");
  const dischargeMsg = document.getElementById("dischargeMessage");
  const submitBtn = document.getElementById("bedSubmitBtn");
  const title = document.getElementById("bedModalTitle");
  const form = document.getElementById("bedForm");
  form.reset();

  if (status === "available") {
    // ADMIT mode
    document.getElementById("mAction").value = "admit";
    title.textContent = "Admit Patient";
    submitBtn.textContent = "Admit Patient";
    submitBtn.className = "primary-btn";
    patientFields.style.display = "block";
    dischargeMsg.style.display = "none";
    document.getElementById("mPatientName").required = true;
  } else {
    // DISCHARGE mode
    document.getElementById("mAction").value = "discharge";
    title.textContent = "Discharge Patient";
    submitBtn.textContent = "Discharge Patient";
    submitBtn.className = "secondary-btn";
    patientFields.style.display = "none";
    dischargeMsg.style.display = "block";
    document.getElementById("mPatientName").required = false;

    // Show current patient info
    const ward = liveBedsData[wardKey];
    const bed = ward?.beds?.[bedId];
    if (bed) {
      document.getElementById("dischargePatientName").textContent = bed.patientName || "-";
      const admittedDate = bed.admittedAt ? new Date(bed.admittedAt).toLocaleString() : "unknown";
      document.getElementById("dischargeMeta").textContent =
        `Admitted: ${admittedDate} · By: ${bed.admittedBy || "—"}`;
    }
  }

  document.getElementById("bedModal").classList.add("active");
};

window.closeBedModal = function () {
  document.getElementById("bedModal").classList.remove("active");
};

document.getElementById("bedForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const wardKey = document.getElementById("mWardKey").value;
  const bedId = document.getElementById("mBedId").value;
  const action = document.getElementById("mAction").value;

  if (action === "admit") {
    const patientName = document.getElementById("mPatientName").value.trim();
    const age = document.getElementById("mPatientAge").value;
    const diagnosis = document.getElementById("mPatientDiagnosis").value.trim();

    if (!patientName) return;

    const now = Date.now();

    // Create or update patient record in "patients" (auto-sync enhancement)
    const patientRef = push(ref(db, "patients"));
    await set(patientRef, {
      name: patientName,
      age: age ? Number(age) : null,
      gender: wardKey.includes("Male") ? "Male" : "Female",
      diagnosis: diagnosis || "",
      bedId: bedId,
      ward: wardKey,
      admittedAt: now,
      createdAt: now,
      updatedAt: now
    });

    // Update bed record
    await update(ref(db, `beds/${wardKey}/beds/${bedId}`), {
      status: "occupied",
      patientName,
      patientId: patientRef.key,
      patientAge: age ? Number(age) : null,
      patientDiagnosis: diagnosis || "",
      admittedAt: now,
      admittedBy: currentUser.email
    });

    // Log history
    await push(historyRef, {
      ward: wardKey,
      wardLabel: liveBedsData[wardKey].label,
      bedId,
      action: "admit",
      patientName,
      staff: currentUser.email,
      timestamp: now
    });

  } else {
    // DISCHARGE
    const ward = liveBedsData[wardKey];
    const bed = ward?.beds?.[bedId];
    const patientName = bed?.patientName || "-";
    const now = Date.now();

    // Update bed back to available
    await update(ref(db, `beds/${wardKey}/beds/${bedId}`), {
      status: "available",
      patientName: null,
      patientId: null,
      patientAge: null,
      patientDiagnosis: null,
      admittedAt: null,
      admittedBy: null
    });

    // Log history
    await push(historyRef, {
      ward: wardKey,
      wardLabel: ward.label,
      bedId,
      action: "discharge",
      patientName,
      staff: currentUser.email,
      timestamp: now
    });
  }

  closeBedModal();
});

// ---------- Edit Capacity Modal ----------
window.openCapacityModal = function (wardKey) {
  const ward = liveBedsData[wardKey];
  if (!ward) return;
  document.getElementById("cWardKey").value = wardKey;
  document.getElementById("cLabel").value = ward.label;
  document.getElementById("cCapacity").value = ward.capacity;
  document.getElementById("capacityModal").classList.add("active");
};

window.closeCapacityModal = function () {
  document.getElementById("capacityModal").classList.remove("active");
};

document.getElementById("capacityForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const wardKey = document.getElementById("cWardKey").value;
  const newCapacity = Number(document.getElementById("cCapacity").value);
  const ward = liveBedsData[wardKey];
  if (!ward) return;

  const occupied = Object.values(ward.beds || {}).filter(b => b.status === "occupied").length;

  if (newCapacity < occupied) {
    alert(`Cannot reduce below ${occupied} occupied beds.`);
    return;
  }

  // If increasing → add new beds
  const currentBeds = ward.beds || {};
  const currentCount = Object.keys(currentBeds).length;
  const prefix = ward.prefix;

  if (newCapacity > currentCount) {
    const updates = {};
    for (let i = currentCount + 1; i <= newCapacity; i++) {
      const id = `${prefix}-${String(i).padStart(2, "0")}`;
      updates[`beds/${wardKey}/beds/${id}`] = { status: "available" };
    }
    updates[`beds/${wardKey}/capacity`] = newCapacity;
    await update(ref(db), updates);
  } else if (newCapacity < currentCount) {
    // Removing beds — only allow removing unoccupied beds
    const toRemove = [];
    for (let i = currentCount; i > newCapacity; i--) {
      const id = `${prefix}-${String(i).padStart(2, "0")}`;
      if (currentBeds[id] && currentBeds[id].status === "available") {
        toRemove.push(id);
      }
    }
    if (toRemove.length < currentCount - newCapacity) {
      alert("Cannot remove occupied beds. Discharge patients first.");
      return;
    }
    const updates = {};
    toRemove.forEach((id) => { updates[`beds/${wardKey}/beds/${id}`] = null; });
    updates[`beds/${wardKey}/capacity`] = newCapacity;
    await update(ref(db), updates);
  }

  closeCapacityModal();
});

// ---------- Tabs ----------
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    document.getElementById("tab-wards").style.display = tab === "wards" ? "block" : "none";
    document.getElementById("tab-history").style.display = tab === "history" ? "block" : "none";

    if (tab === "history") renderHistory();
  });
});

// ---------- History ----------
function renderHistory() {
  onValue(historyRef, (snap) => {
    const tbody = document.getElementById("historyBody");
    tbody.innerHTML = "";
    if (!snap.exists()) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No activity yet.</td></tr>`;
      return;
    }

    const entries = Object.entries(snap.val())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, 100); // last 100

    entries.forEach(([, h]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(h.timestamp).toLocaleString()}</td>
        <td class="action-${h.action}">${h.action === "admit" ? "➕ Admitted" : "➖ Discharged"}</td>
        <td>${h.wardLabel || h.ward}</td>
        <td>${h.bedId}</td>
        <td>${escapeHtml(h.patientName || "-")}</td>
        <td>${escapeHtml(h.staff || "-")}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// ---------- Utility ----------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}