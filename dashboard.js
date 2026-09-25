import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ---------- Auth guard + load everything ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  document.getElementById("userEmail").textContent = "👤 " + user.email;

  // ---------- Collections (one-shot reads) ----------
  const [pSnap, aSnap, sSnap, rSnap] = await Promise.all([
    get(ref(db, "patients")),
    get(ref(db, "appointments")),
    get(ref(db, "staff")),
    get(ref(db, "records"))
  ]);

  const count = (snap) => (snap.exists() ? Object.keys(snap.val()).length : 0);

  document.getElementById("totalPatients").textContent = count(pSnap);
  document.getElementById("totalAppts").textContent = count(aSnap);
  document.getElementById("totalStaff").textContent = count(sSnap);
  document.getElementById("totalRecords").textContent = count(rSnap);

  // ---------- Beds (real-time listener) ----------
  // Using onValue so the dashboard updates automatically when a bed is
  // admitted or discharged on the Beds page.
  const bedsRef = ref(db, "beds");
  onValue(bedsRef, (bSnap) => {
    let total = 0;
    let occupied = 0;
    let available = 0;

    if (bSnap.exists()) {
      const wards = bSnap.val();

      // New structure: each ward has { label, prefix, capacity, beds: { id: {...} } }
      Object.values(wards).forEach((ward) => {
        const beds = ward.beds || {};
        const bedList = Object.values(beds);

        total += bedList.length;
        bedList.forEach((bed) => {
          if (bed.status === "occupied") occupied++;
          else available++;
        });
      });
    }

    const occupiedEl = document.getElementById("bedsOccupied");
    const availableEl = document.getElementById("bedsAvailable");

    if (occupiedEl) occupiedEl.textContent = occupied;
    if (availableEl) availableEl.textContent = available;

    // If your dashboard.html also has these elements, they'll be filled too
    const totalEl = document.getElementById("bedsTotal");
    const rateEl = document.getElementById("bedsRate");
    if (totalEl) totalEl.textContent = total;
    if (rateEl) {
      const rate = total === 0 ? 0 : Math.round((occupied / total) * 100);
      rateEl.textContent = rate + "%";
    }
  });
});