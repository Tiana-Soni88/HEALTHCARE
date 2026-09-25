import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, push, set, get, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const COLLECTION = "staff";
const colRef = ref(db, COLLECTION);
const modal = document.getElementById("modal");
const form = document.getElementById("dataForm");

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  onValue(colRef, (snapshot) => {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (!snapshot.exists()) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No staff yet.</td></tr>`;
      return;
    }

    Object.entries(snapshot.val()).forEach(([id, item]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.role}</td>
        <td>${item.department}</td>
        <td>${item.email}</td>
        <td>${item.phone || "-"}</td>
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
  document.getElementById("modalTitle").textContent = "Add Staff";
  modal.classList.add("active");
});

window.closeModal = () => modal.classList.remove("active");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("recordId").value;
  const data = {
    name: document.getElementById("fName").value.trim(),
    role: document.getElementById("fRole").value,
    department: document.getElementById("fDepartment").value.trim(),
    email: document.getElementById("fEmail").value.trim(),
    phone: document.getElementById("fPhone").value.trim(),
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
  document.getElementById("fName").value = item.name;
  document.getElementById("fRole").value = item.role;
  document.getElementById("fDepartment").value = item.department;
  document.getElementById("fEmail").value = item.email;
  document.getElementById("fPhone").value = item.phone || "";
  document.getElementById("modalTitle").textContent = "Edit Staff";
  modal.classList.add("active");
}

async function deleteItem(id) {
  if (confirm("Delete this staff member?")) {
    await remove(ref(db, `${COLLECTION}/${id}`));
  }
}