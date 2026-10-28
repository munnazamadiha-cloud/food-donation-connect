const state = {
  token: localStorage.getItem("fdc_token"),
  user: JSON.parse(localStorage.getItem("fdc_user") || "null"),
  donations: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast${error ? " error" : ""}`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3200);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({ success: false, error: "Invalid server response." }));

  if (response.status === 401 && path !== "/auth/signin") {
    logout(false);
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload.data;
}

function setAuthView() {
  $("#auth-view").classList.toggle("hidden", !!state.user);
  $("#app-view").classList.toggle("hidden", !state.user);
  $("#main-nav").classList.toggle("hidden", !state.user);
  $("#admin-nav").classList.toggle("hidden", state.user?.role !== "admin");
}

function logout(show = true) {
  state.token = null;
  state.user = null;
  localStorage.removeItem("fdc_token");
  localStorage.removeItem("fdc_user");
  setAuthView();
  if (show) showToast("You have been signed out.");
  switchView("dashboard");
}

function switchView(name) {
  if (!state.user) return;
  $$(".view").forEach((view) => view.classList.add("hidden"));
  const view = $(`#${name}-view`);
  if (view) view.classList.remove("hidden");

  if (name === "dashboard") loadDashboard();
  if (name === "donations") loadDonations();
  if (name === "my-activity") loadActivity();
  if (name === "admin" && state.user.role === "admin") loadAdmin();
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusBadge(status) {
  return `<span class="badge ${escapeHtml(status)}">${escapeHtml(status.replaceAll("_", " "))}</span>`;
}

function donationCard(donation, showClaim = true) {
  const donor = donation.donor?.full_name || "Food donor";
  const claimButton = showClaim && state.user?.role === "community" && donation.status === "available"
    ? `<button class="primary" data-claim="${escapeHtml(donation.id)}">Request donation</button>` : "";

  return `<article class="card">
    <div class="panel-heading">
      <h3>${escapeHtml(donation.food_name)}</h3>
      ${statusBadge(donation.status)}
    </div>
    <p>${escapeHtml(donation.description || "No extra description provided.")}</p>
    <p><b>${escapeHtml(donation.quantity)} ${escapeHtml(donation.unit)}</b></p>
    <p class="meta">Pickup: ${escapeHtml(formatDate(donation.pickup_start))} – ${escapeHtml(formatDate(donation.pickup_end))}</p>
    <p class="meta">Location: ${escapeHtml(donation.location)}</p>
    <p class="meta">Donor: ${escapeHtml(donor)}</p>
    ${claimButton ? `<div class="card-actions">${claimButton}</div>` : ""}
  </article>`;
}

async function loadDashboard() {
  if (!state.user) return;
  $("#welcome-title").textContent = `Hello, ${state.user.full_name}`;
  $("#welcome-text").textContent = state.user.role === "donor"
    ? "Publish surplus food and manage incoming requests."
    : state.user.role === "admin"
      ? "Monitor the food-sharing network."
      : "Find food offers and track your community requests.";

  $("#quick-action").textContent = state.user.role === "donor" ? "Post donation" : "Find donations";
  $("#quick-action").onclick = () => state.user.role === "donor" ? openDonationDialog() : switchView("donations");

  try {
    const [donations, mine] = await Promise.all([
      api("/donations?status=available"),
      state.user.role === "community" ? api("/claims/mine") : api("/donations/mine")
    ]);

    const list = donations.donations || [];
    state.donations = list;
    $("#dashboard-donations").innerHTML = list.slice(0, 4).map(d => donationCard(d)).join("")
      || `<div class="empty">No available donations right now.</div>`;

    const stats = state.user.role === "community"
      ? [
          ["Available", list.length],
          ["My requests", mine.claims?.length || 0],
          ["Completed", (mine.claims || []).filter(c => c.status === "completed").length]
        ]
      : [
          ["Available", list.length],
          ["My donations", mine.donations?.length || 0],
          ["Completed", (mine.donations || []).filter(d => d.status === "completed").length]
        ];

    $("#stats-grid").innerHTML = stats.map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadDonations() {
  try {
    const search = encodeURIComponent($("#donation-search").value.trim());
    const status = encodeURIComponent($("#donation-filter").value);
    const data = await api(`/donations?status=${status}&search=${search}`);
    state.donations = data.donations || [];
    $("#donations-list").innerHTML = state.donations.map(d => donationCard(d)).join("")
      || `<div class="empty">No donations match your search.</div>`;
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadActivity() {
  try {
    if (state.user.role === "community") {
      $("#activity-description").textContent = "Requests you have made for food donations.";
      const { claims } = await api("/claims/mine");
      $("#activity-list").innerHTML = claims.map(claim => {
        const d = claim.donation;
        return `<article class="card">
          <div class="panel-heading"><h3>${escapeHtml(d?.food_name || "Donation")}</h3>${statusBadge(claim.status)}</div>
          <p>${escapeHtml(d?.quantity)} ${escapeHtml(d?.unit)} · ${escapeHtml(d?.location)}</p>
          <p class="meta">Pickup: ${escapeHtml(formatDate(d?.pickup_start))} – ${escapeHtml(formatDate(d?.pickup_end))}</p>
          ${claim.message ? `<p>${escapeHtml(claim.message)}</p>` : ""}
          ${claim.status === "approved" ? `<div class="card-actions"><button data-complete-claim="${escapeHtml(claim.id)}" class="primary">Mark completed</button></div>` : ""}
        </article>`;
      }).join("") || `<div class="empty">You have not requested any donations yet.</div>`;
    } else if (state.user.role === "donor") {
      $("#activity-description").textContent = "Food donations you have published.";
      const { donations } = await api("/donations/mine");
      $("#activity-list").innerHTML = donations.map(d => donationCard(d, false) + `<div class="card-actions"><button data-claims="${escapeHtml(d.id)}">View requests</button></div>`).join("")
        || `<div class="empty">You have not posted any donations yet.</div>`;
    } else {
      $("#activity-description").textContent = "Use the Admin page to monitor the platform.";
      $("#activity-list").innerHTML = `<div class="empty">Administrator activity is available from the Admin tab.</div>`;
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadAdmin() {
  try {
    const [summary, users] = await Promise.all([api("/admin/summary"), api("/admin/users")]);
    $("#admin-stats").innerHTML = [
      ["Users", summary.users], ["Donations", summary.donations], ["Claims", summary.claims]
    ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

    $("#admin-users").innerHTML = users.users.map(user => `<tr>
      <td>${escapeHtml(user.full_name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${statusBadge(user.role)}</td>
      <td>${escapeHtml(formatDate(user.created_at))}</td>
      <td>${user.id !== state.user.id ? `<button data-delete-user="${escapeHtml(user.id)}">Delete</button>` : ""}</td>
    </tr>`).join("");
  } catch (err) {
    showToast(err.message, true);
  }
}

function openDonationDialog() {
  $("#donation-dialog").showModal();
}

function openClaimDialog(donation) {
  $("#claim-donation-id").value = donation.id;
  $("#claim-summary").innerHTML = `<b>${escapeHtml(donation.food_name)}</b><br>${escapeHtml(donation.quantity)} ${escapeHtml(donation.unit)} · ${escapeHtml(donation.location)}<br>Pickup ${escapeHtml(formatDate(donation.pickup_start))} – ${escapeHtml(formatDate(donation.pickup_end))}`;
  $("#claim-message").value = "";
  $("#claim-dialog").showModal();
}

async function handleSignin(event) {
  event.preventDefault();
  try {
    const data = await api("/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        email: $("#signin-email").value,
        password: $("#signin-password").value
      })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("fdc_token", state.token);
    localStorage.setItem("fdc_user", JSON.stringify(state.user));
    setAuthView();
    switchView("dashboard");
    event.target.reset();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  try {
    const data = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        full_name: $("#signup-name").value,
        email: $("#signup-email").value,
        phone: $("#signup-phone").value,
        role: $("#signup-role").value,
        password: $("#signup-password").value
      })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("fdc_token", state.token);
    localStorage.setItem("fdc_user", JSON.stringify(state.user));
    setAuthView();
    switchView("dashboard");
    event.target.reset();
    showToast("Account created successfully.");
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleDonation(event) {
  event.preventDefault();
  try {
    await api("/donations", {
      method: "POST",
      body: JSON.stringify({
        food_name: $("#food-name").value,
        description: $("#food-description").value,
        quantity: $("#food-quantity").value,
        unit: $("#food-unit").value,
        pickup_start: $("#pickup-start").value,
        pickup_end: $("#pickup-end").value,
        location: $("#pickup-location").value
      })
    });
    $("#donation-dialog").close();
    event.target.reset();
    showToast("Donation published.");
    switchView("donations");
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleClaim(event) {
  event.preventDefault();
  try {
    await api("/claims", {
      method: "POST",
      body: JSON.stringify({
        donation_id: $("#claim-donation-id").value,
        message: $("#claim-message").value
      })
    });
    $("#claim-dialog").close();
    showToast("Request sent to the donor.");
    loadDonations();
  } catch (err) {
    showToast(err.message, true);
  }
}

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) switchView(viewButton.dataset.view);

  const authButton = event.target.closest("[data-auth]");
  if (authButton) {
    $$(".tab").forEach(t => t.classList.remove("active"));
    authButton.classList.add("active");
    $("#signin-form").classList.toggle("hidden", authButton.dataset.auth !== "signin");
    $("#signup-form").classList.toggle("hidden", authButton.dataset.auth !== "signup");
  }

  const claimButton = event.target.closest("[data-claim]");
  if (claimButton) {
    const donation = state.donations.find(d => d.id === claimButton.dataset.claim);
    if (donation) openClaimDialog(donation);
  }

  const completeButton = event.target.closest("[data-complete-claim]");
  if (completeButton) {
    if (!confirm("Mark this claim as completed after pickup?")) return;
    try {
      await api(`/claims/${completeButton.dataset.completeClaim}/status`, {
        method: "PATCH", body: JSON.stringify({ status: "completed" })
      });
      showToast("Claim completed.");
      loadActivity();
    } catch (err) { showToast(err.message, true); }
  }

  const claimsButton = event.target.closest("[data-claims]");
  if (claimsButton) {
    try {
      const { claims } = await api(`/claims/for-donation/${claimsButton.dataset.claims}`);
      if (!claims.length) return showToast("No requests yet.");
      const first = claims.find(c => c.status === "pending");
      if (first) {
        const action = confirm(`Request from ${first.community.full_name}. Approve this request? Press Cancel to leave it pending.`);
        if (action) {
          await api(`/claims/${first.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
          showToast("Request approved.");
          loadActivity();
        }
      } else {
        showToast(`There are ${claims.length} request(s); none are pending.`);
      }
    } catch (err) { showToast(err.message, true); }
  }

  const deleteUser = event.target.closest("[data-delete-user]");
  if (deleteUser) {
    if (!confirm("Delete this user and their related records?")) return;
    try {
      await api(`/admin/users/${deleteUser.dataset.deleteUser}`, { method: "DELETE" });
      showToast("User deleted.");
      loadAdmin();
    } catch (err) { showToast(err.message, true); }
  }
});

$("#signin-form").addEventListener("submit", handleSignin);
$("#signup-form").addEventListener("submit", handleSignup);
$("#donation-form").addEventListener("submit", handleDonation);
$("#claim-form").addEventListener("submit", handleClaim);
$("#logout-btn").addEventListener("click", () => logout());
$("#new-donation-btn").addEventListener("click", openDonationDialog);
$("#quick-action").addEventListener("click", () => state.user?.role === "donor" ? openDonationDialog() : switchView("donations"));
$("#cancel-donation").addEventListener("click", () => $("#donation-dialog").close());
$("#close-donation").addEventListener("click", () => $("#donation-dialog").close());
$("#cancel-claim").addEventListener("click", () => $("#claim-dialog").close());
$("#close-claim").addEventListener("click", () => $("#claim-dialog").close());
$("#donation-search").addEventListener("input", loadDonations);
$("#donation-filter").addEventListener("change", loadDonations);

async function boot() {
  if (!state.token || !state.user) {
    setAuthView();
    return;
  }
  try {
    const data = await api("/auth/me");
    state.user = data.user;
    localStorage.setItem("fdc_user", JSON.stringify(state.user));
    setAuthView();
    $("#new-donation-btn").classList.toggle("hidden", state.user.role !== "donor");
    switchView("dashboard");
  } catch {
    logout(false);
  }
}

boot();
