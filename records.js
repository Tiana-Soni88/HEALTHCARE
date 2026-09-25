import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, push, set, get, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const COLLECTION = "records";
const colRef = ref(db, COLLECTION);
const modal = document.getElementById("modal");
const form = document.getElementById("dataForm");

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  onValue(colRef, (snapshot) => {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (!snapshot.exists()) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No records yet.</td></tr>`;
      return;
    }

    Object.entries(snapshot.val()).forEach(([id, item]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.patient}</td>
        <td>${item.diagnosis}</td>
        <td>${item.prescription || "-"}</td>
        <td>${item.date}</td>
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
  document.getElementById("modalTitle").textContent = "New Record";
  modal.classList.add("active");
});

window.closeModal = () => modal.classList.remove("active");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("recordId").value;
  const data = {
    patient: document.getElementById("fPatient").value.trim(),
    diagnosis: document.getElementById("fDiagnosis").value.trim(),
    prescription: document.getElementById("fPrescription").value.trim(),
    notes: document.getElementById("fNotes").value.trim(),
    date: document.getElementById("fDate").value,
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
  document.getElementById("fDiagnosis").value = item.diagnosis;
  document.getElementById("fPrescription").value = item.prescription || "";
  document.getElementById("fNotes").value = item.notes || "";
  document.getElementById("fDate").value = item.date;
  document.getElementById("modalTitle").textContent = "Edit Record";
  modal.classList.add("active");
}

async function deleteItem(id) {
  if (confirm("Delete this record?")) {
    await remove(ref(db, `${COLLECTION}/${id}`));
  }
}