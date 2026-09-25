import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, push, set, get, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const COLLECTION = "patients";
const colRef = ref(db, COLLECTION);
const modal = document.getElementById("modal");
const form = document.getElementById("dataForm");

// ---- Auth guard + real-time data listener ----
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  onValue(colRef, (snapshot) => {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (!snapshot.exists()) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No records yet. Click "Add" to create one.</td></tr>`;
      return;
    }

    Object.entries(snapshot.val()).forEach(([id, item]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.age}</td>
        <td>${item.gender}</td>
        <td>${item.diagnosis || "-"}</td>
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

// ---- Open modal for new record ----
document.getElementById("addBtn").addEventListener("click", () => {
  form.reset();
  document.getElementById("recordId").value = "";
  document.getElementById("modalTitle").textContent = "Add Patient";
  modal.classList.add("active");
});

window.closeModal = () => modal.classList.remove("active");

// ---- Save (create or update) ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("recordId").value;
  const data = {
    name: document.getElementById("fName").value.trim(),
    age: Number(document.getElementById("fAge").value),
    gender: document.getElementById("fGender").value,
    diagnosis: document.getElementById("fDiagnosis").value.trim(),
    updatedAt: Date.now()
  };

  try {
    if (id) {
      await update(ref(db, `${COLLECTION}/${id}`), data);
    } else {
      const newRef = push(colRef);
      await set(newRef, { ...data, createdAt: Date.now() });
    }
    closeModal();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// ---- Edit ----
async function editItem(id) {
  const snap = await get(ref(db, `${COLLECTION}/${id}`));
  if (!snap.exists()) return;
  const item = snap.val();

  document.getElementById("recordId").value = id;
  document.getElementById("fName").value = item.name;
  document.getElementById("fAge").value = item.age;
  document.getElementById("fGender").value = item.gender;
  document.getElementById("fDiagnosis").value = item.diagnosis || "";
  document.getElementById("modalTitle").textContent = "Edit Patient";
  modal.classList.add("active");
}

// ---- Delete ----
async function deleteItem(id) {
  if (confirm("Delete this record permanently?")) {
    await remove(ref(db, `${COLLECTION}/${id}`));
  }
}