// ── State ──────────────────────────────────────────────────────────────────
let members = [];
let currentUser = null; // { id, name }
let currentPage = 'dashboard';
let billsFilter = 'all';
let splitMode = 'equal';

// ── API ────────────────────────────────────────────────────────────────────
async function api(method, url, data) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (data) opts.body = JSON.stringify(data);
  const r = await fetch(url, opts);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || r.statusText);
  }
  return r.json();
}
const GET = url => api('GET', url);
const POST = (url, d) => api('POST', url, d);
const PUT = (url, d) => api('PUT', url, d);
const DEL = url => api('DELETE', url);

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = a => '₹' + Math.abs(a).toFixed(2);
const today = () => new Date().toISOString().split('T')[0];
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
const TYPE_LABELS = { grocery: '🛒 Grocery', wifi: '📶 WiFi', electricity: '⚡ Electricity', rent: '🏠 Rent', other: '📋 Other' };
const typeLabel = t => TYPE_LABELS[t] || t;
const loading = () => `<div class="flex items-center justify-center h-48"><div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full spin"></div></div>`;
const errHtml = e => `<div class="p-6 text-center text-red-500"><p class="font-medium">Error</p><p class="text-sm mt-1">${e.message}</p><button onclick="renderPage()" class="mt-3 text-blue-500 text-sm">Retry</button></div>`;

function userBadge() {
  return `<button onclick="switchUser()" class="flex items-center gap-2 active:opacity-70">
    <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">${currentUser.name[0].toUpperCase()}</div>
    <span class="text-sm text-gray-600 font-medium">${currentUser.name.split(' ')[0]}</span>
  </button>`;
}

function meTag() {
  return `<div class="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
    <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">${currentUser.name[0].toUpperCase()}</div>
    <div>
      <p class="font-semibold text-blue-800 text-sm">${currentUser.name}</p>
      <p class="text-xs text-blue-400">You</p>
    </div>
  </div>`;
}

// ── Member picker ──────────────────────────────────────────────────────────
function showMemberPicker() {
  openModal(`
    <div>
      <div class="mb-5">
        <h2 class="text-xl font-bold text-gray-800">Who are you?</h2>
      </div>
      <div class="space-y-2">
        ${members.map(m => `
          <button onclick="selectMember('${m._id || m.id}','${m.name.replace(/'/g, "\\'")}'); closeModal();"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${currentUser && (m._id || m.id) === currentUser.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100'} active:bg-blue-50 text-left">
            <div class="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">${m.name[0].toUpperCase()}</div>
            <span class="font-semibold text-gray-800">${m.name}</span>
            ${currentUser && (m._id || m.id) === currentUser.id ? '<span class="ml-auto text-blue-400 text-xs font-medium">current</span>' : ''}
          </button>`).join('')}
      </div>
    </div>`);
}

function selectMember(id, name) {
  currentUser = { id, name };
  localStorage.setItem('ghazal_user', JSON.stringify(currentUser));
  renderPage();
}

function switchUser() {
  showMemberPicker();
}

// ── Navigation ─────────────────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  renderPage();
}
function renderPage() {
  ({ dashboard: renderDashboard, bills: renderBills, tracking: renderTracking, settle: renderSettle, members: renderMembers })[currentPage]();
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Dashboard ──────────────────────────────────────────────────────────────
async function renderDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = loading();
  try {
    const [settle, trackingItems, bills] = await Promise.all([
      GET('/api/settlements/summary'),
      GET('/api/tracking'),
      GET('/api/bills')
    ]);

    const myBalance = settle.memberBalances.find(m => m.id === currentUser.id);

    app.innerHTML = `
    <div class="px-4 pt-6 pb-4 space-y-4 slide-up">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Ghazal</h1>
          <p class="text-sm text-gray-400">South 11</p>
        </div>
        ${userBadge()}
      </div>

      ${myBalance ? `
      <div class="rounded-2xl p-4 text-white shadow-sm ${myBalance.balance > 0.01 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : myBalance.balance < -0.01 ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-gray-400 to-gray-500'}">
        <p class="text-sm opacity-80">${myBalance.balance > 0.01 ? 'You are owed' : myBalance.balance < -0.01 ? 'You owe' : 'You are'}</p>
        <p class="text-4xl font-black mt-0.5">${myBalance.balance === 0 ? 'All settled' : fmt(myBalance.balance)}</p>
        ${myBalance.balance !== 0 ? `<p class="text-sm opacity-70 mt-0.5">${myBalance.balance > 0 ? 'others owe you' : 'total to pay'}</p>` : ''}
      </div>
      ` : ''}

      ${trackingItems.length > 0 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-4 pt-3 pb-2 flex items-center justify-between">
          <h2 class="font-semibold text-gray-700">Stock</h2>
          <button onclick="navigate('tracking')" class="text-blue-500 text-sm">Manage →</button>
        </div>
        <div class="flex gap-3 overflow-x-auto px-4 pb-4">
          ${trackingItems.map(item => `
            <button onclick="navigate('tracking')" class="flex-shrink-0 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center min-w-[80px]">
              <p class="text-3xl font-black ${item.current_stock <= 5 ? 'text-red-500' : 'text-amber-600'} leading-none">${item.current_stock}</p>
              <p class="text-xs font-semibold text-amber-700 mt-1 truncate max-w-[72px]">${item.name}</p>
              <p class="text-xs text-amber-400">${item.unit}</p>
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${settle.transactions.length > 0 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-4 pt-3 pb-2 flex items-center justify-between">
          <h2 class="font-semibold text-gray-700">Balances</h2>
          <button onclick="navigate('settle')" class="text-blue-500 text-sm">Details →</button>
        </div>
        ${settle.transactions.map(t => `
          <div class="flex items-center justify-between px-4 py-2.5 border-t border-gray-50">
            <p class="text-sm"><span class="font-semibold ${t.from_id === currentUser.id ? 'text-red-500' : 'text-gray-700'}">${t.from_id === currentUser.id ? 'You' : t.from}</span><span class="text-gray-400 mx-1">→</span><span class="font-semibold ${t.to_id === currentUser.id ? 'text-green-600' : 'text-gray-700'}">${t.to_id === currentUser.id ? 'You' : t.to}</span></p>
            <span class="font-bold text-gray-800">${fmt(t.amount)}</span>
          </div>
        `).join('')}
      </div>
      ` : settle.memberBalances.length > 1 ? `
      <div class="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
        <p class="text-2xl">✅</p><p class="text-green-700 font-semibold mt-1">All settled up!</p>
      </div>` : ''}

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-4 pt-3 pb-2 flex items-center justify-between">
          <h2 class="font-semibold text-gray-700">Recent Bills</h2>
          <button onclick="navigate('bills')" class="text-blue-500 text-sm">See all →</button>
        </div>
        ${bills.slice(0, 5).length === 0
          ? `<p class="px-4 pb-4 text-sm text-gray-400">No bills yet.</p>`
          : bills.slice(0, 5).map(b => `
            <div class="flex items-center justify-between px-4 py-3 border-t border-gray-50">
              <div class="flex-1 min-w-0 mr-3">
                <p class="font-medium text-gray-800 truncate">${b.description || typeLabel(b.type)}</p>
                <p class="text-xs text-gray-400 mt-0.5">${typeLabel(b.type)} · ${b.payer_name} · ${fmtDate(b.date)}</p>
              </div>
              <span class="font-bold text-gray-700 flex-shrink-0">${fmt(b.total_amount)}</span>
            </div>
          `).join('')}
      </div>
    </div>`;
  } catch (e) { if (e.message !== 'Not authenticated') app.innerHTML = errHtml(e); }
}

// ── Bills ──────────────────────────────────────────────────────────────────
async function renderBills() {
  const app = document.getElementById('app');
  app.innerHTML = loading();
  try {
    const url = billsFilter !== 'all' ? `/api/bills?type=${billsFilter}` : '/api/bills';
    const bills = await GET(url);
    const filters = ['all', 'grocery', 'wifi', 'electricity', 'rent', 'other'];
    const fLabels = { all: 'All', grocery: '🛒', wifi: '📶', electricity: '⚡', rent: '🏠', other: '📋' };

    app.innerHTML = `
    <div class="px-4 pt-6 pb-4 space-y-4 slide-up">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-800">Bills</h1>
        <button onclick="showAddBillModal()" class="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-sm">+ Add Bill</button>
      </div>

      <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        ${filters.map(f => `
          <button onclick="setBillFilter('${f}')"
            class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${billsFilter === f ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'}">
            ${fLabels[f]} ${f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        `).join('')}
      </div>

      <div class="space-y-3">
        ${bills.length === 0
          ? `<div class="text-center py-16"><p class="text-4xl mb-3">🧾</p><p class="text-gray-500 font-medium">No bills here</p></div>`
          : bills.map(b => `
            <div class="bg-white rounded-2xl shadow-sm border ${b.paid_by === currentUser.id ? 'border-blue-100' : 'border-gray-100'} p-4">
              <div class="flex items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">${typeLabel(b.type)}</span>
                    ${b.paid_by === currentUser.id ? '<span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">You paid</span>' : ''}
                    <span class="text-xs text-gray-400">${fmtDate(b.date)}</span>
                  </div>
                  ${b.description ? `<p class="font-semibold text-gray-800 mt-1">${b.description}</p>` : ''}
                  <p class="text-xs text-gray-400 mt-0.5">Paid by <span class="font-medium text-gray-600">${b.payer_name}</span></p>
                  ${b.splits.length > 0 ? `<p class="text-xs text-gray-400 mt-0.5">Split: ${b.splits.map(s => s.member_name).join(', ')}</p>` : ''}
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xl font-black text-gray-800">${fmt(b.total_amount)}</p>
                  ${b.splits.length > 0 ? `<p class="text-xs text-gray-400">${fmt(b.splits[0]?.amount || 0)}/ea</p>` : ''}
                </div>
              </div>
              ${b.items.length > 0 ? `
                <div class="mt-3 pt-3 border-t border-gray-100">
                  ${b.items.slice(0, 4).map(i => `
                    <div class="flex justify-between text-xs text-gray-600 py-0.5">
                      <span>${i.name}${i.quantity ? ` ×${i.quantity}${i.unit || ''}` : ''}</span>
                      <span class="font-medium">${fmt(i.amount)}</span>
                    </div>
                  `).join('')}
                  ${b.items.length > 4 ? `<p class="text-xs text-blue-400 mt-1">+${b.items.length - 4} more</p>` : ''}
                </div>
              ` : ''}
              ${b.paid_by === currentUser.id ? `
              <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onclick="deleteBill(${b.id})" class="flex-1 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg font-medium">Delete</button>
              </div>` : ''}
            </div>
          `).join('')}
      </div>
    </div>`;
  } catch (e) { if (e.message !== 'Not authenticated') app.innerHTML = errHtml(e); }
}

function setBillFilter(f) { billsFilter = f; renderBills(); }

async function deleteBill(id) {
  if (!confirm('Delete this bill? This will affect all balances.')) return;
  try { await DEL(`/api/bills/${id}`); renderBills(); }
  catch (e) { alert(e.message); }
}

// ── Add Bill Modal ─────────────────────────────────────────────────────────
function showAddBillModal() {
  if (members.length === 0) { alert('Please add members first.'); navigate('members'); return; }
  splitMode = 'equal';

  openModal(`
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-bold text-gray-800">Add Bill</h2>
        <button onclick="closeModal()" class="text-gray-400 text-3xl leading-none">&times;</button>
      </div>
      <form id="bill-form" class="space-y-4" novalidate>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
          <select id="bill-type" name="type" onchange="onTypeChange()"
            class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="grocery">🛒 Grocery</option>
            <option value="wifi">📶 WiFi</option>
            <option value="electricity">⚡ Electricity</option>
            <option value="rent">🏠 Rent</option>
            <option value="other">📋 Other</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Description <span class="font-normal text-gray-400">(optional)</span></label>
          <input name="description" type="text" placeholder="e.g. Monthly WiFi bill"
            class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Total (₹)</label>
            <input name="total_amount" type="number" step="0.01" min="0.01" placeholder="0.00" required
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
            <input name="date" type="date" value="${today()}"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Paid By</label>
          ${meTag()}
        </div>

        <div id="items-section">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-semibold text-gray-700">Items <span class="font-normal text-gray-400">(optional)</span></label>
            <button type="button" onclick="addItemRow()" class="text-blue-500 text-sm font-medium">+ Add item</button>
          </div>
          <div id="items-list" class="space-y-2"></div>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Split</label>
          <div class="flex rounded-xl border border-gray-200 p-1 gap-1 mb-3">
            <button type="button" id="btn-equal" onclick="setSplitMode('equal')"
              class="flex-1 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white">Equal</button>
            <button type="button" id="btn-custom" onclick="setSplitMode('custom')"
              class="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-500">Custom</button>
          </div>

          <div id="section-equal">
            <div class="flex items-center justify-between mb-2">
              <div id="per-person-amount" class="text-xs text-blue-600 font-medium"></div>
              <div class="flex gap-3">
                <button type="button" onclick="toggleAllSplit(true)" class="text-blue-500 text-xs font-medium">All</button>
                <button type="button" onclick="toggleAllSplit(false)" class="text-gray-400 text-xs">None</button>
              </div>
            </div>
            <div class="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              ${members.map(m => `
                <label class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50">
                  <input type="checkbox" name="split_members" value="${m.id}" checked onchange="updatePerPerson()"
                    class="w-5 h-5 rounded accent-blue-500">
                  <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    ${m.name[0].toUpperCase()}
                  </div>
                  <span class="text-gray-700 font-medium">${m.name}</span>
                  ${m.id === currentUser.id ? '<span class="text-xs text-blue-400 ml-auto">you</span>' : ''}
                </label>
              `).join('')}
            </div>
          </div>

          <div id="section-custom" style="display:none">
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs text-gray-500">Enter each person's share</p>
              <div id="custom-total-indicator" class="text-xs font-medium"></div>
            </div>
            <div class="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              ${members.map(m => `
                <div class="flex items-center gap-3 px-4 py-2.5">
                  <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    ${m.name[0].toUpperCase()}
                  </div>
                  <span class="flex-1 text-gray-700 font-medium text-sm">${m.name}${m.id === currentUser.id ? ' <span class="text-blue-400 text-xs">(you)</span>' : ''}</span>
                  <span class="text-gray-400 text-sm">₹</span>
                  <input type="number" class="custom-split-input w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                    data-member-id="${m.id}" placeholder="0.00" step="0.01" min="0" oninput="updateCustomTotal()">
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <button type="submit" class="w-full bg-blue-500 text-white py-3.5 rounded-xl font-semibold shadow-sm">Save Bill</button>
      </form>
    </div>
  `);

  document.getElementById('bill-form').onsubmit = submitBill;
  document.querySelector('[name="total_amount"]').addEventListener('input', () => splitMode === 'equal' ? updatePerPerson() : updateCustomTotal());
  onTypeChange();
  updatePerPerson();
}

function setSplitMode(mode) {
  splitMode = mode;
  document.getElementById('section-equal').style.display = mode === 'equal' ? 'block' : 'none';
  document.getElementById('section-custom').style.display = mode === 'custom' ? 'block' : 'none';
  document.getElementById('btn-equal').className = `flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'equal' ? 'bg-blue-500 text-white' : 'text-gray-500'}`;
  document.getElementById('btn-custom').className = `flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'custom' ? 'bg-blue-500 text-white' : 'text-gray-500'}`;
}

function onTypeChange() {
  const type = document.getElementById('bill-type')?.value;
  const el = document.getElementById('items-section');
  if (el) el.style.display = type === 'grocery' ? 'block' : 'none';
}

function addItemRow() {
  const list = document.getElementById('items-list');
  const div = document.createElement('div');
  div.className = 'flex gap-2 items-center';
  div.innerHTML = `
    <input type="text" placeholder="Item name" class="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 item-name">
    <input type="number" placeholder="₹" step="0.01" min="0" class="w-20 border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 item-amount">
    <button type="button" onclick="this.parentElement.remove()" class="text-red-400 text-xl leading-none flex-shrink-0">×</button>
  `;
  list.appendChild(div);
}

function toggleAllSplit(val) {
  document.querySelectorAll('[name="split_members"]').forEach(cb => cb.checked = val);
  updatePerPerson();
}

function updatePerPerson() {
  const total = parseFloat(document.querySelector('[name="total_amount"]')?.value) || 0;
  const count = document.querySelectorAll('[name="split_members"]:checked').length;
  const el = document.getElementById('per-person-amount');
  if (el) el.textContent = (total > 0 && count > 0) ? `₹${(total / count).toFixed(2)}/person · ${count} people` : '';
}

function updateCustomTotal() {
  const sum = [...document.querySelectorAll('.custom-split-input')].reduce((a, inp) => a + (parseFloat(inp.value) || 0), 0);
  const total = parseFloat(document.querySelector('[name="total_amount"]')?.value) || 0;
  const el = document.getElementById('custom-total-indicator');
  if (!el || total === 0) return;
  const diff = total - sum;
  if (Math.abs(diff) < 0.01) { el.className = 'text-xs font-medium text-green-600'; el.textContent = '✓ Balanced'; }
  else { el.className = `text-xs font-medium ${diff > 0 ? 'text-orange-500' : 'text-red-500'}`; el.textContent = diff > 0 ? `₹${diff.toFixed(2)} remaining` : `₹${Math.abs(diff).toFixed(2)} over`; }
}

async function submitBill(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const total = parseFloat(fd.get('total_amount'));
  if (!total || total <= 0) { alert('Enter a valid amount.'); return; }

  let splits;
  if (splitMode === 'equal') {
    const selected = [...form.querySelectorAll('[name="split_members"]:checked')].map(cb => parseInt(cb.value));
    if (selected.length === 0) { alert('Select at least one person.'); return; }
    const share = Math.round((total / selected.length) * 100) / 100;
    splits = selected.map(id => ({ member_id: id, amount: share }));
  } else {
    splits = [...document.querySelectorAll('.custom-split-input')]
      .filter(inp => parseFloat(inp.value) > 0)
      .map(inp => ({ member_id: parseInt(inp.dataset.memberId), amount: parseFloat(inp.value) }));
    if (splits.length === 0) { alert('Enter at least one custom amount.'); return; }
    const sum = splits.reduce((a, s) => a + s.amount, 0);
    if (Math.abs(sum - total) > 0.01) { alert(`Custom amounts total ₹${sum.toFixed(2)} but bill is ₹${total.toFixed(2)}.`); return; }
  }

  const items = [...(document.querySelectorAll('#items-list > div') || [])].map(row => ({
    name: row.querySelector('.item-name').value.trim(),
    amount: parseFloat(row.querySelector('.item-amount').value) || 0
  })).filter(i => i.name);

  try {
    await POST('/api/bills', { type: fd.get('type'), description: fd.get('description')?.trim() || '', total_amount: total, date: fd.get('date'), splits, items, paid_by: currentUser.id });
    closeModal();
    renderBills();
  } catch (err) { alert('Error: ' + err.message); }
}

// ── Tracking ───────────────────────────────────────────────────────────────
async function renderTracking() {
  const app = document.getElementById('app');
  app.innerHTML = loading();
  try {
    const items = await GET('/api/tracking');
    app.innerHTML = `
    <div class="px-4 pt-6 pb-4 space-y-4 slide-up">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-800">Tracking</h1>
        <div class="flex gap-2">
          <button onclick="showTrackingHistory()" class="text-gray-500 border border-gray-200 px-3 py-2 rounded-xl text-sm font-medium">History</button>
          <button onclick="showAddItemModal()" class="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-sm">+ New Item</button>
        </div>
      </div>
      ${items.length === 0
        ? `<div class="text-center py-16"><p class="text-5xl mb-4">📦</p><p class="text-gray-600 font-semibold text-lg">Nothing tracked yet</p><p class="text-gray-400 text-sm mt-1 mb-6">Add items like eggs, milk, bread</p><button onclick="showAddItemModal()" class="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold">Add First Item</button></div>`
        : items.map(item => `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-4">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-bold text-gray-800 text-lg">${item.name}</h3>
                    <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">${item.unit}</span>
                    <span class="text-xs text-gray-400">₹${item.price_per_unit}/${item.unit.replace(/s$/, '')}</span>
                  </div>
                  <div class="flex items-baseline gap-1 mt-1">
                    <span class="text-4xl font-black ${item.current_stock <= 5 ? 'text-red-500' : 'text-amber-600'}">${item.current_stock}</span>
                    <span class="text-gray-400 text-sm">remaining</span>
                    ${item.current_stock <= 5 ? '<span class="text-xs text-red-500 font-semibold ml-1">⚠ Low!</span>' : ''}
                  </div>
                </div>
                <div class="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button onclick="showEditItemModal('${item.id}','${item.name.replace(/'/g,"\\'")}','${item.unit}',${item.price_per_unit})" class="text-gray-300 text-sm px-1">✏️</button>
                  <button onclick="deleteTrackedItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')" class="text-gray-300 text-sm px-1">✕</button>
                </div>
              </div>
              <div class="flex gap-2 mt-3">
                <button onclick="showAddStockModal('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price_per_unit}, '${item.unit}')"
                  class="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold">+ Add Stock</button>
                <button onclick="showUseStockModal('${item.id}', '${item.name.replace(/'/g, "\\'")}', '${item.unit}', ${item.current_stock})"
                  class="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold">− Record Use</button>
              </div>
            </div>
            ${item.recent_log.length > 0 ? `
            <div class="border-t border-gray-100">
              ${item.recent_log.slice(0, 4).map(l => `
                <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div class="flex items-center gap-3">
                    <span class="font-bold ${l.action === 'add' ? 'text-green-500' : 'text-orange-500'}">${l.action === 'add' ? '+' : '−'}${l.quantity}</span>
                    <div>
                      <p class="text-xs font-medium text-gray-700">
                        ${l.action === 'add'
                          ? `Bought by ${l.paid_by_name || '—'}${l.price_per_unit ? ` · ₹${(l.quantity * l.price_per_unit).toFixed(2)}` : ''}`
                          : `Used by ${l.member_name || '—'}`}
                      </p>
                      ${l.notes ? `<p class="text-xs text-gray-400">${l.notes}</p>` : ''}
                    </div>
                  </div>
                  <span class="text-xs text-gray-400">${fmtDate(l.date)}</span>
                </div>
              `).join('')}
            </div>` : ''}
          </div>
        `).join('')}
    </div>`;
  } catch (e) { if (e.message !== 'Not authenticated') app.innerHTML = errHtml(e); }
}

let _historyLogs = [];
let _historyFilter = 'all';
let _historyUserFilter = 'all';
let _historySort = 'newest';

function fifoUseCost(logs, targetLog) {
  // Replay FIFO up to and including targetLog to compute cost of a use entry
  const queue = [];
  let cost = null;
  for (const l of logs) {
    if (l.action === 'add' && l.paid_by_name != null) {
      const price = l.price_per_unit ?? 0;
      queue.push({ remaining: l.quantity, price });
    } else if (l.action === 'use') {
      let qty = l.quantity;
      let entryCost = 0;
      const snap = queue.map(b => ({ ...b }));
      while (qty > 0 && snap.length > 0) {
        const batch = snap[0];
        const consumed = Math.min(qty, batch.remaining);
        entryCost += consumed * batch.price;
        batch.remaining -= consumed;
        qty -= consumed;
        if (batch.remaining <= 0) snap.shift();
      }
      // consume from real queue
      let q2 = l.quantity;
      while (q2 > 0 && queue.length > 0) {
        const b = queue[0];
        const c = Math.min(q2, b.remaining);
        b.remaining -= c; q2 -= c;
        if (b.remaining <= 0) queue.shift();
      }
      if (l.id === targetLog.id) { cost = entryCost; break; }
    }
  }
  return cost;
}

async function showTrackingHistory() {
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xl font-bold text-gray-800">Stock History</h2>
        <button onclick="closeModal()" class="text-gray-400 text-3xl leading-none">&times;</button>
      </div>
      <div id="history-controls" class="flex gap-2 mb-3"></div>
      <div id="history-list" class="space-y-1">${loading()}</div>
    </div>`);

  try {
    _historyLogs = await GET('/api/tracking/history');
    _historyFilter = 'all';
    _historyUserFilter = 'all';
    _historySort = 'newest';
    renderHistoryList();
  } catch (e) {
    const list = document.getElementById('history-list');
    if (list) list.innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`;
  }
}

function renderHistoryList() {
  const controls = document.getElementById('history-controls');
  const list = document.getElementById('history-list');
  if (!controls || !list) return;

  const itemNames = ['all', ...new Set(_historyLogs.map(l => l.item_name).filter(Boolean))];
  const userNames = ['all', ...new Set(_historyLogs.flatMap(l => [l.paid_by_name, l.member_name]).filter(Boolean))];

  controls.innerHTML = `
    <div class="flex gap-2 w-full flex-wrap">
      <select onchange="_historyFilter=this.value;renderHistoryList()"
        class="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none">
        ${itemNames.map(n => `<option value="${n}" ${_historyFilter===n?'selected':''}>${n==='all'?'All items':n}</option>`).join('')}
      </select>
      <select onchange="_historyUserFilter=this.value;renderHistoryList()"
        class="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none">
        ${userNames.map(n => `<option value="${n}" ${_historyUserFilter===n?'selected':''}>${n==='all'?'All users':n}</option>`).join('')}
      </select>
      <select onchange="_historySort=this.value;renderHistoryList()"
        class="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none">
        <option value="newest" ${_historySort==='newest'?'selected':''}>Newest first</option>
        <option value="oldest" ${_historySort==='oldest'?'selected':''}>Oldest first</option>
      </select>
    </div>`;

  let logs = _historyLogs.filter(l => {
    if (_historyFilter !== 'all' && l.item_name !== _historyFilter) return false;
    if (_historyUserFilter !== 'all') {
      const who = l.action === 'add' ? l.paid_by_name : l.member_name;
      if (who !== _historyUserFilter) return false;
    }
    return true;
  });
  if (_historySort === 'oldest') logs = [...logs].reverse();

  if (logs.length === 0) { list.innerHTML = `<p class="text-center text-gray-400 py-8">No entries found</p>`; return; }

  // Build per-item log lists (chronological) for FIFO cost calc
  const byItem = {};
  _historyLogs.slice().reverse().forEach(l => {
    if (!byItem[l.item_id]) byItem[l.item_id] = [];
    byItem[l.item_id].push(l);
  });

  let lastDate = null;
  list.innerHTML = logs.map(l => {
    const dateHeader = l.date !== lastDate ? `<p class="text-xs font-semibold text-gray-400 uppercase pt-3 pb-1 first:pt-0">${fmtDate(l.date)}</p>` : '';
    lastDate = l.date;
    const isAdd = l.action === 'add';
    const who = isAdd ? (l.paid_by_name || '—') : (l.member_name || '—');
    let costStr = '';
    if (isAdd && l.price_per_unit) {
      costStr = `₹${(l.quantity * l.price_per_unit).toFixed(2)}`;
    } else if (!isAdd && byItem[l.item_id]) {
      const cost = fifoUseCost(byItem[l.item_id], l);
      if (cost != null && cost > 0) costStr = `₹${cost.toFixed(2)}`;
    }
    return `${dateHeader}
      <div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
        <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isAdd ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}">
          ${isAdd ? '+' : '−'}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800">${l.item_name || '—'} <span class="font-normal text-gray-500">${isAdd ? 'added by' : 'used by'} ${who}</span></p>
          <p class="text-xs text-gray-400">${l.quantity} ${l.item_unit || ''}${costStr ? ' · ' + costStr : ''}${l.notes ? ' · ' + l.notes : ''}</p>
        </div>
        <span class="text-xs font-semibold flex-shrink-0 ${isAdd ? 'text-green-500' : 'text-orange-400'}">${isAdd ? '+' : '−'}${l.quantity}</span>
      </div>`;
  }).join('');
}

function showAddItemModal() {
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-bold text-gray-800">New Tracked Item</h2>
        <button onclick="closeModal()" class="text-gray-400 text-3xl leading-none">&times;</button>
      </div>
      <form id="item-form" class="space-y-4" novalidate>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Item Name</label>
          <input name="name" type="text" placeholder="e.g. Eggs, Milk, Bread" required autofocus
            class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Unit</label>
            <input name="unit" type="text" placeholder="pieces, liters…" value="pieces"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Price / unit (₹)</label>
            <input name="price_per_unit" type="number" step="0.01" min="0" placeholder="0.00"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <button type="submit" class="w-full bg-blue-500 text-white py-3.5 rounded-xl font-semibold">Add Item</button>
      </form>
    </div>
  `);
  document.getElementById('item-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) { alert('Name is required.'); return; }
    try {
      await POST('/api/tracking/items', { name, unit: fd.get('unit')?.trim() || 'pieces', price_per_unit: parseFloat(fd.get('price_per_unit')) || 0 });
      closeModal(); renderTracking();
    } catch (err) { alert('Error: ' + err.message); }
  };
}

function showEditItemModal(id, name, unit, price) {
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-bold text-gray-800">Edit Item</h2>
        <button onclick="closeModal()" class="text-gray-400 text-3xl leading-none">&times;</button>
      </div>
      <form id="edit-item-form" class="space-y-4" novalidate>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Item Name</label>
          <input name="name" type="text" value="${name}" required autofocus
            class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Unit</label>
            <input name="unit" type="text" value="${unit}"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Price per unit (₹)</label>
            <input name="price_per_unit" type="number" min="0" step="0.01" value="${price}"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <button type="submit" class="w-full bg-blue-500 text-white py-3.5 rounded-xl font-semibold">Save Changes</button>
      </form>
    </div>
  `);
  document.getElementById('edit-item-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await PUT(`/api/tracking/items/${id}`, {
        name: fd.get('name').trim(),
        unit: fd.get('unit').trim() || unit,
        price_per_unit: parseFloat(fd.get('price_per_unit')) || 0
      });
      closeModal(); renderTracking();
    } catch (err) { alert('Error: ' + err.message); }
  };
}

function showAddStockModal(itemId, itemName, defaultPrice, unit) {
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xl font-bold text-gray-800">Add ${itemName} Stock</h2>
        <button onclick="closeModal()" class="text-gray-400 text-3xl leading-none">&times;</button>
      </div>
      <form id="stock-form" class="space-y-4 mt-4" novalidate>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Quantity (${unit})</label>
            <input name="quantity" type="number" min="1" step="any" placeholder="How many?" required autofocus
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Price / unit (₹)</label>
            <input name="price_per_unit" type="number" step="0.01" min="0" value="${defaultPrice}"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div id="stock-total" class="text-sm font-medium text-blue-600 -mt-2"></div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Paid By</label>
          ${meTag()}
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
            <input name="date" type="date" value="${today()}"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
            <input name="notes" type="text" placeholder="e.g. D-Mart"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <button type="submit" class="w-full bg-green-500 text-white py-3.5 rounded-xl font-semibold">Add to Stock</button>
      </form>
    </div>
  `);

  const updateTotal = () => {
    const q = parseFloat(document.querySelector('[name="quantity"]')?.value) || 0;
    const p = parseFloat(document.querySelector('[name="price_per_unit"]')?.value) || 0;
    const el = document.getElementById('stock-total');
    if (el) el.textContent = (q > 0 && p > 0) ? `Total cost: ₹${(q * p).toFixed(2)}` : '';
  };
  document.querySelector('[name="quantity"]').addEventListener('input', updateTotal);
  document.querySelector('[name="price_per_unit"]').addEventListener('input', updateTotal);

  document.getElementById('stock-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const qty = parseFloat(fd.get('quantity'));
    if (!qty || qty <= 0) { alert('Enter a valid quantity.'); return; }
    try {
      await POST('/api/tracking/log', { item_id: itemId, action: 'add', quantity: qty, price_per_unit: parseFloat(fd.get('price_per_unit')) || 0, notes: fd.get('notes') || null, date: fd.get('date'), member_id: currentUser.id });
      closeModal(); renderTracking();
    } catch (err) { alert('Error: ' + err.message); }
  };
}


function showUseStockModal(itemId, itemName, unit, currentStock) {
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xl font-bold text-gray-800">Use ${itemName}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-3xl leading-none">&times;</button>
      </div>
      <p class="text-sm text-gray-400 mb-4">Stock: ${currentStock} ${unit}</p>
      <form id="use-form" class="space-y-4" novalidate>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Quantity (${unit})</label>
          <input name="quantity" type="number" min="1" step="any" placeholder="How many?" required autofocus
            class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Used By</label>
          ${meTag()}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
            <input name="date" type="date" value="${today()}"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
            <input name="notes" type="text" placeholder="e.g. Breakfast"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <button type="submit" class="w-full bg-orange-500 text-white py-3.5 rounded-xl font-semibold">Record Usage</button>
      </form>
    </div>
  `);
  document.getElementById('use-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const qty = parseFloat(fd.get('quantity'));
    if (!qty || qty <= 0) { alert('Enter a valid quantity.'); return; }
    try {
      await POST('/api/tracking/log', { item_id: itemId, action: 'use', quantity: qty, notes: fd.get('notes') || null, date: fd.get('date'), member_id: currentUser.id });
      closeModal(); renderTracking();
    } catch (err) { alert('Error: ' + err.message); }
  };
}

async function deleteTrackedItem(id, name) {
  if (!confirm(`Delete "${name}" and all its history?`)) return;
  try { await DEL(`/api/tracking/items/${id}`); renderTracking(); }
  catch (err) { alert('Error: ' + err.message); }
}

// ── Settle ─────────────────────────────────────────────────────────────────
async function renderSettle() {
  const app = document.getElementById('app');
  app.innerHTML = loading();
  try {
    const [settle, history] = await Promise.all([GET('/api/settlements/summary'), GET('/api/settlements/history')]);

    // My pending transactions (where I'm the debtor)
    const myDebts = settle.transactions.filter(t => t.from_id === currentUser.id);

    app.innerHTML = `
    <div class="px-4 pt-6 pb-4 space-y-4 slide-up">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-800">Settle Up</h1>
        <button onclick="showSettleModal()" class="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-sm">I Paid Someone</button>
      </div>

      ${myDebts.length > 0 ? `
      <div class="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
        <div class="px-4 pt-3 pb-2"><h2 class="font-semibold text-red-700">You owe</h2></div>
        ${myDebts.map(t => `
          <div class="px-4 py-3 border-t border-red-100">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-semibold text-gray-800">Pay <span class="text-green-600">${t.to}</span></p>
              </div>
              <div class="text-right">
                <p class="text-xl font-black text-red-600">${fmt(t.amount)}</p>
                <button onclick="showSettleModal(${t.to_id}, ${t.amount})" class="text-xs text-blue-500 font-medium mt-0.5">Mark Paid →</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-4 pt-3 pb-2"><h2 class="font-semibold text-gray-700">All Pending</h2></div>
        ${settle.transactions.length === 0
          ? `<div class="text-center py-8"><p class="text-3xl">✅</p><p class="text-green-600 font-semibold mt-2">All settled up!</p></div>`
          : settle.transactions.map(t => `
            <div class="px-4 py-3 border-t border-gray-50">
              <div class="flex items-center justify-between">
                <p class="font-medium text-gray-800">
                  <span class="${t.from_id === currentUser.id ? 'text-red-500 font-bold' : 'text-gray-700'}">${t.from_id === currentUser.id ? 'You' : t.from}</span>
                  <span class="text-gray-400 mx-2">→</span>
                  <span class="${t.to_id === currentUser.id ? 'text-green-600 font-bold' : 'text-gray-700'}">${t.to_id === currentUser.id ? 'You' : t.to}</span>
                </p>
                <span class="font-bold text-gray-800">${fmt(t.amount)}</span>
              </div>
            </div>
          `).join('')}
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-4 pt-3 pb-2"><h2 class="font-semibold text-gray-700">All Balances</h2></div>
        ${settle.memberBalances.map(m => `
          <div class="flex items-center justify-between px-4 py-3 border-t border-gray-50">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold ${m.id === currentUser.id ? 'bg-blue-500 text-white' : m.balance > 0.01 ? 'bg-green-100 text-green-600' : m.balance < -0.01 ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}">
                ${m.name[0].toUpperCase()}
              </div>
              <div>
                <p class="font-medium text-gray-800">${m.name}${m.id === currentUser.id ? ' <span class="text-xs text-blue-400">(you)</span>' : ''}</p>
                <p class="text-xs ${m.balance > 0.01 ? 'text-green-500' : m.balance < -0.01 ? 'text-red-400' : 'text-gray-400'}">
                  ${m.balance > 0.01 ? 'gets back' : m.balance < -0.01 ? 'needs to pay' : 'settled'}
                </p>
              </div>
            </div>
            <span class="text-lg font-bold ${m.balance > 0.01 ? 'text-green-600' : m.balance < -0.01 ? 'text-red-500' : 'text-gray-400'}">
              ${m.balance > 0.01 ? '+' : ''}${fmt(m.balance)}
            </span>
          </div>
        `).join('')}
      </div>

      ${history.length > 0 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-4 pt-3 pb-2"><h2 class="font-semibold text-gray-700">Payment History</h2></div>
        ${history.map(s => `
          <div class="flex items-center justify-between px-4 py-3 border-t border-gray-50">
            <div>
              <p class="text-sm font-medium text-gray-700">
                <span class="${s.from_member_id === currentUser.id ? 'text-blue-600 font-bold' : ''}">${s.from_member_id === currentUser.id ? 'You' : s.from_name}</span>
                <span class="text-gray-400 mx-1">→</span>
                <span class="${s.to_member_id === currentUser.id ? 'text-blue-600 font-bold' : ''}">${s.to_member_id === currentUser.id ? 'You' : s.to_name}</span>
              </p>
              ${s.notes ? `<p class="text-xs text-gray-400">${s.notes}</p>` : ''}
            </div>
            <div class="text-right">
              <p class="font-bold text-gray-700">${fmt(s.amount)}</p>
              <p class="text-xs text-gray-400">${fmtDate(s.date)}</p>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
    </div>`;
  } catch (e) { if (e.message !== 'Not authenticated') app.innerHTML = errHtml(e); }
}

function showSettleModal(toId = null, amount = '') {
  const otherMembers = members.filter(m => m.id !== currentUser.id);
  if (otherMembers.length === 0) { alert('Need at least 2 members.'); return; }
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-bold text-gray-800">I Paid Someone</h2>
        <button onclick="closeModal()" class="text-gray-400 text-3xl leading-none">&times;</button>
      </div>
      <form id="settle-form" class="space-y-4" novalidate>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">From</label>
          ${meTag()}
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Paid To</label>
          <select name="to_member_id" class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
            ${otherMembers.map(m => `<option value="${m.id}" ${m.id === toId ? 'selected' : ''}>${m.name}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Amount (₹)</label>
            <input name="amount" type="number" step="0.01" min="0.01" value="${amount}" required
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
            <input name="date" type="date" value="${today()}"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Notes <span class="font-normal text-gray-400">(optional)</span></label>
          <input name="notes" type="text" placeholder="e.g. Cash, UPI"
            class="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <button type="submit" class="w-full bg-blue-500 text-white py-3.5 rounded-xl font-semibold">Record Payment</button>
      </form>
    </div>
  `);
  document.getElementById('settle-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = parseFloat(fd.get('amount'));
    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
    try {
      await POST('/api/settlements', { from_member_id: currentUser.id, to_member_id: fd.get('to_member_id'), amount, date: fd.get('date'), notes: fd.get('notes') || null });
      closeModal(); renderSettle();
    } catch (err) { alert('Error: ' + err.message); }
  };
}

// ── Members ────────────────────────────────────────────────────────────────
const COLORS = ['bg-blue-100 text-blue-600','bg-purple-100 text-purple-600','bg-green-100 text-green-600','bg-pink-100 text-pink-600','bg-yellow-100 text-yellow-700','bg-indigo-100 text-indigo-600','bg-teal-100 text-teal-600','bg-red-100 text-red-500'];

async function renderMembers() {
  const app = document.getElementById('app');
  try {
    members = await GET('/api/members');
    app.innerHTML = `
    <div class="px-4 pt-6 pb-4 space-y-4 slide-up">
      <h1 class="text-2xl font-bold text-gray-800">People</h1>
      ${members.length === 0
        ? `<div class="text-center py-12"><p class="text-gray-500">No members yet</p></div>`
        : `<div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            ${members.map((m, i) => `
              <div class="flex items-center px-4 py-3.5 ${currentUser && m.id === currentUser.id ? 'bg-blue-50' : ''}">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base ${currentUser && m.id === currentUser.id ? 'bg-blue-500 text-white' : COLORS[i % COLORS.length]} flex-shrink-0">
                  ${m.name[0].toUpperCase()}
                </div>
                <div class="ml-3 flex-1">
                  <p class="font-semibold text-gray-800">${m.name} ${currentUser && m.id === currentUser.id ? '<span class="text-xs text-blue-400">(you)</span>' : ''}</p>
                </div>
              </div>
            `).join('')}
          </div>
          <p class="text-center text-xs text-gray-400">${members.length} ${members.length === 1 ? 'person' : 'people'} · South 11</p>`
      }
    </div>`;
  } catch (e) { app.innerHTML = errHtml(e); }
}

// ── Admin panel ────────────────────────────────────────────────────────────
async function renderAdminPage() {
  document.querySelector('nav').style.display = 'none';
  const app = document.getElementById('app');
  try {
    members = await fetch('/api/members').then(r => r.json());
    const ACOLORS = ['bg-blue-100 text-blue-600','bg-purple-100 text-purple-600','bg-green-100 text-green-600','bg-amber-100 text-amber-600','bg-rose-100 text-rose-600'];
    app.innerHTML = `
      <div class="px-4 pt-8 pb-8 space-y-5 slide-up max-w-lg mx-auto">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Admin</h1>
            <p class="text-sm text-gray-400">Manage members</p>
          </div>
          <a href="/" class="text-sm text-blue-500 border border-blue-200 rounded-xl px-3 py-2">← Back to app</a>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 class="font-semibold text-gray-700 mb-3">Add Member</h2>
          <form id="admin-add-form" onsubmit="adminAddMember(event)" class="flex gap-2" novalidate>
            <input name="name" type="text" placeholder="Full name" autocomplete="off"
              class="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button type="submit" class="bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm">Add</button>
          </form>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="px-4 pt-3 pb-2">
            <h2 class="font-semibold text-gray-700">Members <span class="text-gray-400 font-normal text-sm">(${members.length})</span></h2>
          </div>
          ${members.length === 0
            ? `<p class="px-4 pb-4 text-sm text-gray-400">No members yet.</p>`
            : `<div class="divide-y divide-gray-50">
                ${members.map((m, i) => `
                <div class="flex items-center gap-3 px-4 py-3">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${ACOLORS[i % ACOLORS.length]}">${m.name[0].toUpperCase()}</div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-800 text-sm">${m.name}</p>
                  </div>
                  <button onclick="adminRemoveMember('${m.id}','${m.name.replace(/'/g, "\\'")}')" class="text-red-400 text-sm border border-red-100 rounded-lg px-3 py-1.5 flex-shrink-0">Remove</button>
                </div>`).join('')}
              </div>`
          }
        </div>
      </div>`;
  } catch (e) {
    app.innerHTML = `<div class="p-8 text-center text-red-500">${e.message}</div>`;
  }
}

async function adminAddMember(e) {
  e.preventDefault();
  const name = new FormData(e.target).get('name').trim();
  if (!name) return;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Adding…';
  try { await POST('/api/members', { name }); e.target.reset(); await renderAdminPage(); }
  catch (err) { alert('Error: ' + err.message); btn.disabled = false; btn.textContent = 'Add'; }
}

async function adminRemoveMember(id, name) {
  if (!confirm(`Remove ${name}?`)) return;
  try { await DEL(`/api/members/${id}`); await renderAdminPage(); }
  catch (err) { alert('Error: ' + err.message); }
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  if (window.location.pathname === '/admin') { renderAdminPage(); return; }

  try {
    members = await fetch('/api/members').then(r => r.json());
    const saved = localStorage.getItem('ghazal_user');
    if (saved) {
      const u = JSON.parse(saved);
      if (members.find(m => (m._id || m.id) === u.id)) currentUser = u;
    }
    navigate('dashboard');
    if (!currentUser) showMemberPicker();
  } catch (e) {
    document.getElementById('app').innerHTML = `
      <div class="flex flex-col items-center justify-center h-screen gap-4 p-8">
        <p class="text-4xl">⚠️</p>
        <p class="text-gray-700 font-semibold">Could not connect to server</p>
        <button onclick="init()" class="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold">Retry</button>
      </div>`;
  }
}

init();
