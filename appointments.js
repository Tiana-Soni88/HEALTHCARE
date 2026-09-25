import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, push, set, get, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const COLLECTION = "appointments";
const colRef = ref(db, COLLECTION);
const modal = document.getElementById("modal");
const form = document.getElementById("dataForm");

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  onValue(colRef, (snapshot) => {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (!snapshot.exists()) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No appointments yet.</td></tr>`;
      return;
    }

    const entries = Object.entries(snapshot.val()).sort(
      (a, b) => (a[1].date || "").localeCompare(b[1].date || "")
    );

    entries.forEach(([id, item]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.patient}</td>
        <td>${item.doctor}</td>
        <td>${item.date}</td>
        <td>${item.time}</td>
        <td>${item.reason || "-"}</td>
        <td>
          <button class="action-btn edit-btn" data-id="${id}">Edit</button>
          <button class="action-btn delete-btn" data-id="${id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".edit-btn").forEach(b =>
      b.addEventListener("click", () => editItem(b.dataset.id))
    );
    tbody.querySelectorAll(".delete-btn").forEach(b =>
      b.addEventListener("click", () => deleteItem(b.dataset.id))
    );
  });
});

document.getElementById("addBtn").addEventListener("click", () => {
  form.reset();
  document.getElementById("recordId").value = "";
  document.getElementById("modalTitle").textContent = "New Appointment";
  modal.classList.add("active");
});

window.closeModal = () => modal.classList.remove("active");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("recordId").value;
  const data = {
    patient: document.getElementById("fPatient").value.trim(),
    doctor: document.getElementById("fDoctor").value.trim(),
    date: document.getElementById("fDate").value,
    time: document.getElementById("fTime").value,
    reason: document.getElementById("fReason").value.trim(),
    updatedAt: Date.now()
  };

  try {
    if (id) await update(ref(db, `${COLLECTION}/${id}`), data);
    else {
      const newRef = push(colRef);
      await set(newRef, { ...data, createdAt: Date.now() });
    }
    closeModal();
  } catch (err) { alert("Error: " + err.message); }
});

async function editItem(id) {
  const snap = await get(ref(db, `${COLLECTION}/${id}`));
  if (!snap.exists()) return;
  const item = snap.val();

  document.getElementById("recordId").value = id;
  document.getElementById("fPatient").value = item.patient;
  document.getElementById("fDoctor").value = item.doctor;
  document.getElementById("fDate").value = item.date;
  document.getElementById("fTime").value = item.time;
  document.getElementById("fReason").value = item.reason || "";
  document.getElementById("modalTitle").textContent = "Edit Appointment";
  modal.classList.add("active");
}

async function deleteItem(id) {
  if (confirm("Delete this appointment?")) {
    await remove(ref(db, `${COLLECTION}/${id}`));
  }
}