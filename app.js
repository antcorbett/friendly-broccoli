const PEOPLE = ["Joe", "Antony", "David", "Brad"];
const BUDGET = 975;
const FAIR_SHARE = BUDGET / PEOPLE.length;
const VAT_RATE = 0.10;
const EPSILON = 0.005;

const fmt = (n) => `$${n.toFixed(2)}`;

let db = null;
let charges = [];

function isConfigured() {
  return typeof firebaseConfig !== "undefined" &&
    firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
}

function initUI() {
  const paidBySelect = document.getElementById("paidBySelect");
  const splitGrid = document.getElementById("splitGrid");

  PEOPLE.forEach((person) => {
    const opt = document.createElement("option");
    opt.value = person;
    opt.textContent = person;
    paidBySelect.appendChild(opt);

    const label = document.createElement("label");
    label.className = "split-option";
    label.innerHTML = `<input type="checkbox" value="${person}"> ${person}`;
    splitGrid.appendChild(label);
  });

  document.getElementById("amountInput").addEventListener("input", updateVatPreview);
  document.getElementById("addChargeBtn").addEventListener("click", handleAddCharge);

  renderPeopleGrid();
  renderHistory();
}

function updateVatPreview() {
  const amount = parseFloat(document.getElementById("amountInput").value) || 0;
  const total = amount * (1 + VAT_RATE);
  document.getElementById("vatTotalPreview").textContent = fmt(total);
}

function getSelectedSplit() {
  return Array.from(document.querySelectorAll("#splitGrid input:checked")).map(cb => cb.value);
}

function setError(msg) {
  document.getElementById("formError").textContent = msg;
}

async function handleAddCharge() {
  setError("");
  const amountInput = document.getElementById("amountInput");
  const paidBySelect = document.getElementById("paidBySelect");
  const amount = parseFloat(amountInput.value);
  const paidBy = paidBySelect.value;
  const splitBetween = getSelectedSplit();

  if (!amount || amount <= 0) {
    setError("Enter an amount greater than $0.");
    return;
  }
  if (!paidBy) {
    setError("Select who paid.");
    return;
  }
  if (splitBetween.length === 0) {
    setError("Select at least one person to split between.");
    return;
  }
  if (!db) {
    setError("Not connected to the database yet — check firebase-config.js.");
    return;
  }

  const vat = amount * VAT_RATE;
  const total = amount + vat;
  const perPersonCost = total / splitBetween.length;

  const addBtn = document.getElementById("addChargeBtn");
  addBtn.disabled = true;
  addBtn.textContent = "Adding…";

  try {
    await db.collection("charges").add({
      amount,
      vat,
      total,
      paidBy,
      splitBetween,
      perPersonCost,
      createdAt: new Date().toISOString(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    amountInput.value = "";
    paidBySelect.value = "";
    document.querySelectorAll("#splitGrid input:checked").forEach(cb => cb.checked = false);
    updateVatPreview();
  } catch (err) {
    setError("Couldn't save charge: " + err.message);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = "Add Charge";
  }
}

async function handleDelete(id) {
  if (!confirm("Delete this charge?")) return;
  try {
    await db.collection("charges").doc(id).delete();
  } catch (err) {
    alert("Couldn't delete: " + err.message);
  }
}

function computeSpent() {
  const spent = {};
  PEOPLE.forEach(p => spent[p] = 0);
  charges.forEach(c => {
    c.splitBetween.forEach(p => {
      if (spent[p] !== undefined) spent[p] += c.perPersonCost;
    });
  });
  return spent;
}

function renderPeopleGrid() {
  const spent = computeSpent();
  const grid = document.getElementById("peopleGrid");
  grid.innerHTML = "";

  let totalSpent = 0;

  PEOPLE.forEach((person) => {
    const personSpent = spent[person] || 0;
    totalSpent += personSpent;
    const remaining = FAIR_SHARE - personSpent;
    const diff = personSpent - FAIR_SHARE;

    let statusClass = "status-even";
    let statusText = "Even";
    if (diff > EPSILON) { statusClass = "status-over"; statusText = "Over"; }
    else if (diff < -EPSILON) { statusClass = "status-under"; statusText = "Under"; }

    const pct = Math.min(100, (personSpent / FAIR_SHARE) * 100);

    const card = document.createElement("div");
    card.className = "person-card";
    card.innerHTML = `
      <div class="name">${person} <span class="status-pill ${statusClass}">${statusText}</span></div>
      <div class="row"><span>Spent</span><b>${fmt(personSpent)}</b></div>
      <div class="row"><span>Fair Share</span><b>${fmt(FAIR_SHARE)}</b></div>
      <div class="row"><span>Remaining</span><b>${fmt(remaining)}</b></div>
      <div class="bar-bg"><div class="bar-fill ${diff > EPSILON ? 'over' : ''}" style="width:${pct}%"></div></div>
    `;
    grid.appendChild(card);
  });

  document.getElementById("sumSpent").textContent = fmt(totalSpent);
  document.getElementById("sumRemaining").textContent = fmt(BUDGET - totalSpent);
}

function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (charges.length === 0) {
    list.innerHTML = `<div class="history-empty">No charges yet.</div>`;
    return;
  }

  charges.forEach((c) => {
    const date = c.createdAt ? new Date(c.createdAt) : null;
    const dateStr = date ? date.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }) : "";

    const splitHtml = c.splitBetween.map(p =>
      `<span>${p}: ${fmt(c.perPersonCost)}</span>`
    ).join("");

    const el = document.createElement("div");
    el.className = "tx";
    el.innerHTML = `
      <div class="tx-top">
        <div>
          <div class="amount">${fmt(c.total)} <span style="color:var(--muted); font-weight:400; font-size:12px;">(incl. $${c.vat.toFixed(2)} VAT)</span></div>
          <div class="tx-meta">${dateStr} &middot; Paid by <b>${c.paidBy}</b></div>
        </div>
        <button class="delete-btn" data-id="${c.id}">✕</button>
      </div>
      <div class="tx-split">${splitHtml}</div>
    `;
    list.appendChild(el);
  });

  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.id));
  });
}

function renderAll() {
  renderPeopleGrid();
  renderHistory();
}

function subscribeToCharges() {
  db.collection("charges").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    charges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAll();
  }, (err) => {
    setError("Sync error: " + err.message);
  });
}

function main() {
  initUI();

  if (!isConfigured()) {
    document.getElementById("setupBanner").style.display = "block";
    return;
  }

  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  subscribeToCharges();
}

main();
