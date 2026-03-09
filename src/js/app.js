/**
 * サロン Mode J 売上管琁E��スチE�� v14.6.01
 * Antigravity Refactored Version
 */

// --- Constants & Config ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwEDYfdXGs9W0ZyCvzqFnkmezQVW9kokAOPHo4qpO4LjI5t8AodlVuqeuE9axDD9JCV/exec';
const STORAGE_KEY = 'salonSalesData';

// --- State ---
let salesData = [];
let editingId = null;
let itemCounter = 0;
let editItemCounter = 0;

// Chart Instances
let charts = {
    yearly: null,
    monthly: null,
    paymentPie: null,
    dailyTrend: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌸 System Initializing v14.6.01 (Color: Wed/Sun Only)...');
    loadData();
    initUI();
    initCharts(); // Initialize empty charts
    updateDashboard(); // Render everything
});

function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            salesData = JSON.parse(stored);
            // Ensure data integrity
            salesData = salesData.map(d => {
                let parsedItems = d.items || [];
                if (typeof parsedItems === 'string') {
                    try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = []; }
                }
                return {
                    ...d,
                    totalAmount: Number(d.totalAmount) || 0,
                    items: parsedItems
                };
            });
            console.log(`📦 Loaded ${salesData.length} records.`);
        }
    } catch (e) {
        console.error('Data load error', e);
        salesData = [];
    }
}

function initUI() {
    // 1. Navigation (Tabs)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            if (tab === 'input') {
                resetForm();
            }
            switchTab(tab);
        });
    });

    // 2. Date Defaults
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    document.getElementById('sale-date').value = `${y}-${m}-${d}`;

    // 3. Form: Payment Selection
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.addEventListener('click', () => {
            selectPaymentMethod(opt);
        });
    });

    // 4. Form: Add Item
    document.getElementById('add-item-btn').addEventListener('click', addItemRow);
    addItemRow(); // Add one row initially

    // 5. Form: Submit
    document.getElementById('sales-form').addEventListener('submit', handleFormSubmit);

    // 6. List Filters
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => applyPeriodFilter(btn.dataset.period));
    });
    document.getElementById('apply-custom-period').addEventListener('click', applyCustomPeriod);
    document.getElementById('reset-list-period').addEventListener('click', () => {
        document.getElementById('list-period-start').value = '';
        document.getElementById('list-period-end').value = '';
        applyPeriodFilter('current-month');
    });

    // 7. Search
    document.getElementById('search-input').addEventListener('input', renderSalesList);

    // 8. Settings
    document.getElementById('gas-url-display').textContent = GAS_URL;
    document.getElementById('local-data-count').textContent = `${salesData.length}件`;
    document.getElementById('test-connection-btn').addEventListener('click', testGASConnection);
    document.getElementById('download-sheets-btn').addEventListener('click', downloadFromGoogleSheets);
    document.getElementById('import-sheets-btn').addEventListener('click', importToGoogleSheets);
    document.getElementById('delete-all-btn').addEventListener('click', deleteAllData);
    document.getElementById('clear-cloud-btn').addEventListener('click', clearCloudData);

    // 9. Dashboard Period Toggle
    document.getElementById('toggle-dashboard-period').addEventListener('click', () => {
        document.getElementById('dashboard-period-panel').classList.toggle('hidden');
    });

    // Quick Select Listeners
    document.querySelectorAll('[data-quick]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            applyQuickPeriod(e.target.dataset.quick);
        });
    });
    document.getElementById('apply-dashboard-period').addEventListener('click', applyDashboardPeriod);
    document.getElementById('cancel-dashboard-period').addEventListener('click', () => {
        document.getElementById('dashboard-period-panel').classList.add('hidden');
    });

    // Yearly Chart Selector Listener
    document.getElementById('yearly-year-selector').addEventListener('change', (e) => {
        const y = parseInt(e.target.value);
        const m = currentFilter.start ? new Date(currentFilter.start).getMonth() : new Date().getMonth();
        renderCharts(y, m);
    });

    // 10. Ranking Toggles
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            const count = parseInt(e.target.dataset.count);

            // Toggle active state in the same group
            e.target.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            renderRankings(type, count);
        });
    });

    // Default Filters
    applyPeriodFilter('current-month', true);

    // Edit Form Listeners
    document.getElementById('add-edit-item-btn').addEventListener('click', addEditItemRow);
    document.getElementById('edit-sales-form').addEventListener('submit', handleEditSubmit);
    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        document.getElementById('sales-edit-view').classList.add('hidden');
        document.getElementById('sales-list-view').classList.remove('hidden');
    });
    document.querySelectorAll('.edit-payment-option').forEach(opt => {
        opt.addEventListener('click', () => selectEditPaymentMethod(opt));
    });
}

window.switchTab = function (tabId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tabId}-tab`));

    if (tabId === 'dashboard') {
        updateDashboard();
    }
}

// --- Logic: Sales Form ---
window.addItemRow = function () {
    itemCounter++;
    const container = document.getElementById('items-container');
    const row = document.createElement('div');
    row.className = 'item-row';
    row.id = `item-row-${itemCounter}`;

    row.innerHTML = `
        <div class="item-header">
            <div style="display:flex; align-items:center;">
                <span>#${itemCounter}</span>
                <label class="manager-check-label" title="店長拁E��E>
                    <input type="checkbox" class="item-is-manager"> 👑
                </label>
            </div>
            <button type="button" class="btn-remove" onclick="removeItemRow(${itemCounter})">🗑�E�E/button>
        </div>
        <div class="item-grid-row">
            <div class="form-group">
                <select class="item-category" onchange="updateTotal()" required>
                    <option value="">カチE��リー選抁E/option>
                    <option value="サブスクリプション">サブスク</option>
                    <option value="会員 若よもぎ蒸ぁE>会員 よもぁE/option>
                    <option value="非会員 若よもぎ蒸ぁE>非会員 よもぁE/option>
                    <option value="施衁E>施衁E/option>
                    <option value="ベルマン">ベルマン</option>
                    <option value="クレンシア">クレンシア</option>
                    <option value="水素関連">水素関連</option>
                    <option value="そ�E仁E>そ�E仁E/option>
                </select>
            </div>
            <div class="form-group">
                <input type="text" class="item-product" placeholder="啁E��吁E required autocomplete="off">
            </div>
            <div class="form-group">
                <input type="number" class="item-qty" placeholder="個数" min="1" value="" oninput="updateTotal()" required autocomplete="off">
            </div>
            <div class="form-group">
                <input type="number" class="item-price" placeholder="単価" min="0" oninput="updateTotal()" required autocomplete="off">
            </div>
            <div class="form-group">
                <input type="text" class="item-subtotal" value="¥0" readonly style="background:#f3f4f6; text-align:right;">
            </div>
        </div>
    `;
    container.appendChild(row);
}

window.removeItemRow = function (id) {
    const row = document.getElementById(`item-row-${id}`);
    if (document.querySelectorAll('.item-row').length > 1) {
        row.remove();
        window.updateTotal();
    } else {
        showNotification('明細は1つ以上忁E��でぁE, 'error');
    }
}

window.updateTotal = function () {
    let total = 0;
    document.querySelectorAll('.item-row').forEach(row => {
        const qty = parseInt(row.querySelector('.item-qty').value) || 0;
        const price = parseInt(row.querySelector('.item-price').value) || 0;
        const sub = qty * price;
        total += sub;
        row.querySelector('.item-subtotal').value = '¥' + sub.toLocaleString();
    });
    document.getElementById('grand-total').textContent = '¥' + total.toLocaleString();
}

function selectPaymentMethod(element) {
    document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('payment-method').value = element.dataset.value;
}

function handleFormSubmit(e) {
    e.preventDefault();

    // Validation
    const date = document.getElementById('sale-date').value;
    const name = document.getElementById('customer-name').value;
    const payment = document.getElementById('payment-method').value;

    // Validation: Comma Check
    if (name.includes(',')) {
        showNotification('お客様名にカンチE,)は使用できません', 'error');
        return;
    }

    if (!payment) { showNotification('決済方法を選択してください', 'error'); return; }

    // Collect Items
    let items = [];
    let totalAmount = 0;

    const rows = document.querySelectorAll('.item-row');
    for (let row of rows) {
        const cat = row.querySelector('.item-category').value;
        const prod = row.querySelector('.item-product').value;
        const qty = parseInt(row.querySelector('.item-qty').value);
        const price = parseInt(row.querySelector('.item-price').value);

        if (!cat || !prod || !qty || isNaN(price)) {
            showNotification('入力不備がありまぁE, 'error'); return;
        }

        if (prod.includes(',')) {
            showNotification('啁E��名にカンチE,)は使用できません', 'error');
            return;
        }

        const isManager = row.querySelector('.item-is-manager').checked;

        const sub = qty * price;
        totalAmount += sub;

        items.push({
            category: cat,
            productName: prod,
            quantity: qty,
            unitPrice: price,
            subtotal: sub,
            isManager: isManager
        });
    }

    const newSale = {
        id: editingId || String(Date.now()),
        date: date,
        customerName: name,
        paymentMethod: payment,
        items: items,
        totalAmount: totalAmount,
        createdAt: new Date().toISOString()
    };

    if (editingId) {
        const idx = salesData.findIndex(s => s.id === editingId);
        if (idx !== -1) salesData[idx] = newSale;
        editingId = null;
        document.getElementById('submit-btn').textContent = '💾 売上を登録';
        showNotification('売上データを更新しました');
    } else {
        salesData.push(newSale);
        showNotification('売上を登録しました');
    }

    // Save
    localStorage.setItem(STORAGE_KEY, JSON.stringify(salesData));

    // Async Send
    sendToGoogleSheets(newSale);

    // Reset & Update UI
    resetForm();
    updateDashboard();
}

function resetForm() {
    editingId = null;
    document.getElementById('submit-btn').textContent = '💾 売上を登録';

    // Explicitly reset form and clear key fields
    document.getElementById('sales-form').reset();
    document.getElementById('customer-name').value = '';

    // Clear items safely
    const container = document.getElementById('items-container');
    container.innerHTML = '';
    itemCounter = 0;

    // Explicitly clear total display
    document.getElementById('grand-total').textContent = '¥0';

    document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
    document.getElementById('payment-method').value = '';

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    document.getElementById('sale-date').value = `${y}-${m}-${d}`;

    // Add one empty row
    addItemRow();

    // Force clear inputs in the newly added row to be absolutely sure
    const firstRowInputs = document.querySelectorAll('#items-container .item-row input');
    firstRowInputs.forEach(input => {
        if (input.type === 'text' || input.type === 'number') {
            input.value = '';
        }
    });

    // Reset total using update method to ensure UI consistency
    window.updateTotal();

    // 🔴 Final Safety Force Zero: Ensure visual display is ¥0 regardless of calculation artifacts
    document.getElementById('grand-total').textContent = '¥0';
}

// --- Logic: Edit Form (Isolated) ---
window.addEditItemRow = function () {
    editItemCounter++;
    const container = document.getElementById('edit-items-container');
    const row = document.createElement('div');
    row.className = 'item-row edit-item-row';
    row.id = `edit-item-row-${editItemCounter}`;

    row.innerHTML = `
        <div class="item-header">
            <div style="display:flex; align-items:center;">
                <span>#${editItemCounter}</span>
                <label class="manager-check-label" title="店長拁E��E>
                    <input type="checkbox" class="item-is-manager"> 👑
                </label>
            </div>
            <button type="button" class="btn-remove" onclick="removeEditItemRow(${editItemCounter})">🗑�E�E/button>
        </div>
        <div class="item-grid-row">
            <div class="form-group">
                <select class="item-category" onchange="updateEditTotal()" required>
                    <option value="">カチE��リー選抁E/option>
                    <option value="サブスクリプション">サブスク</option>
                    <option value="会員 若よもぎ蒸ぁE>会員 よもぁE/option>
                    <option value="非会員 若よもぎ蒸ぁE>非会員 よもぁE/option>
                    <option value="施衁E>施衁E/option>
                    <option value="ベルマン">ベルマン</option>
                    <option value="クレンシア">クレンシア</option>
                    <option value="水素関連">水素関連</option>
                    <option value="そ�E仁E>そ�E仁E/option>
                </select>
            </div>
            <div class="form-group">
                <input type="text" class="item-product" placeholder="啁E��吁E required autocomplete="off">
            </div>
            <div class="form-group">
                <input type="number" class="item-qty" placeholder="個数" min="1" value="" oninput="updateEditTotal()" required autocomplete="off">
            </div>
            <div class="form-group">
                <input type="number" class="item-price" placeholder="単価" min="0" oninput="updateEditTotal()" required autocomplete="off">
            </div>
            <div class="form-group">
                <input type="text" class="item-subtotal" value="¥0" readonly style="background:#f3f4f6; text-align:right;">
            </div>
        </div>
    `;
    container.appendChild(row);
}

window.removeEditItemRow = function (id) {
    const row = document.getElementById(`edit-item-row-${id}`);
    if (document.querySelectorAll('.edit-item-row').length > 1) {
        row.remove();
        window.updateEditTotal();
    } else {
        showNotification('明細は1つ以上忁E��でぁE, 'error');
    }
}

window.updateEditTotal = function () {
    let total = 0;
    document.querySelectorAll('.edit-item-row').forEach(row => {
        const qty = parseInt(row.querySelector('.item-qty').value) || 0;
        const price = parseInt(row.querySelector('.item-price').value) || 0;
        const sub = qty * price;
        total += sub;
        row.querySelector('.item-subtotal').value = '¥' + sub.toLocaleString();
    });
    document.getElementById('edit-grand-total').textContent = '¥' + total.toLocaleString();
}

function selectEditPaymentMethod(element) {
    document.querySelectorAll('.edit-payment-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('edit-payment-method').value = element.dataset.value;
}

function handleEditSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('edit-sale-date').value;
    const name = document.getElementById('edit-customer-name').value;
    const payment = document.getElementById('edit-payment-method').value;

    // Validation: Comma Check
    if (name.includes(',')) {
        showNotification('お客様名にカンチE,)は使用できません', 'error');
        return;
    }

    if (!payment) { showNotification('決済方法を選択してください', 'error'); return; }

    let items = [];
    let totalAmount = 0;

    const rows = document.querySelectorAll('.edit-item-row');
    for (let row of rows) {
        const cat = row.querySelector('.item-category').value;
        const prod = row.querySelector('.item-product').value;
        const qty = parseInt(row.querySelector('.item-qty').value);
        const price = parseInt(row.querySelector('.item-price').value);

        if (!cat || !prod || !qty || isNaN(price)) {
            showNotification('入力不備がありまぁE, 'error'); return;
        }

        if (prod.includes(',')) {
            showNotification('啁E��名にカンチE,)は使用できません', 'error');
            return;
        }

        const isManager = row.querySelector('.item-is-manager').checked;
        const sub = qty * price;
        totalAmount += sub;

        items.push({
            category: cat,
            productName: prod,
            quantity: qty,
            unitPrice: price,
            subtotal: sub,
            isManager: isManager
        });
    }

    const updatedSale = {
        id: editingId,
        date: date,
        customerName: name,
        paymentMethod: payment,
        items: items,
        totalAmount: totalAmount,
        createdAt: salesData.find(s => s.id === editingId)?.createdAt || new Date().toISOString()
    };

    const idx = salesData.findIndex(s => s.id === editingId);
    if (idx !== -1) salesData[idx] = updatedSale;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(salesData));
    sendToGoogleSheets(updatedSale);

    showNotification('変更を保存しました');

    // Return to List View
    document.getElementById('sales-edit-view').classList.add('hidden');
    document.getElementById('sales-list-view').classList.remove('hidden');
    editingId = null;

    // Refresh List
    renderSalesList();
    renderCharts(new Date(date).getFullYear(), new Date(date).getMonth());
    updateDashboard();
}

// --- Logic: List Filters & Table ---
let currentFilter = { start: null, end: null, periodName: 'current-month' };
let currentSort = { key: 'date', order: 'desc' };

function applyPeriodFilter(period, silent = false) {
    const now = new Date();
    let start, end;

    // Reset active class
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));

    if (period === 'today') {
        start = end = now;
    } else if (period === 'yesterday') {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        start = end = d;
    } else if (period === 'this-week') {
        const day = now.getDay(); // 0:Sun
        // Assume week starts Sunday or Monday? 
        // Code used: now.getDate() - day -> Sunday
        start = new Date(now); start.setDate(now.getDate() - day);
        end = new Date(start); end.setDate(start.getDate() + 6);
    } else if (period === 'last-7-days') {
        end = new Date(now);
        start = new Date(now); start.setDate(now.getDate() - 6);
    } else if (period === 'last-30-days') {
        end = new Date(now);
        start = new Date(now); start.setDate(now.getDate() - 29);
    } else if (period === 'current-month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const btn = document.getElementById('period-current-month');
        if (btn) btn.classList.add('active');
    } else if (period === 'last-month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === '2months-ago') {
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        end = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    }

    document.querySelector(`.btn-filter[data-period="${period}"]`)?.classList.add('active');

    currentFilter = {
        start: start ? formatDateISO(start) : null,
        end: end ? formatDateISO(end) : null,
        periodName: period
    };

    // Update Display
    let displayText = '';

    if (currentFilter.start === currentFilter.end && currentFilter.start) {
        const d = new Date(currentFilter.start);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const dy = d.getDate();
        const dayOfWeek = ['日', '朁E, '火', '水', '木', '釁E, '圁E][d.getDay()];
        displayText = `${y}年${m}朁E{dy}日 (${dayOfWeek})`;
        // For monthly chart title, just show month
        document.getElementById('monthly-display-period').innerText = `(${y}年${m}朁E`;
    } else if (currentFilter.start && currentFilter.end) {
        // Attempt to detect if it's a full month range for cleaner display
        const s = new Date(currentFilter.start);
        const e = new Date(currentFilter.end);

        // --- Constants & Config ---
        const GAS_URL = 'https://script.google.com/macros/s/AKfycbwEDYfdXGs9W0ZyCvzqFnkmezQVW9kokAOPHo4qpO4LjI5t8AodlVuqeuE9axDD9JCV/exec';
        const STORAGE_KEY = 'salonSalesData';

        // --- State ---month
        const isFullMonth = s.getDate() === 1 &&
            e.getMonth() === s.getMonth() &&
            e.getFullYear() === s.getFullYear() &&
            e.getDate() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();

        if (isFullMonth) {
            displayText = `${s.getFullYear()}年${s.getMonth() + 1}朁E;
            document.getElementById('monthly-display-period').innerText = `(${s.getFullYear()}年${s.getMonth() + 1}朁E`;
        } else {
            displayText = `${currentFilter.start} 、E${currentFilter.end}`;
            // Even for custom ranges, try to show relevant month in daily chart title if close enough
            // Default to showing the month of the start date
            document.getElementById('monthly-display-period').innerText = `(${s.getFullYear()}年${s.getMonth() + 1}朁E`;
        }
    } else {
        displayText = '全期間';
        document.getElementById('monthly-display-period').innerText = '';
    }

    document.getElementById('current-period-display').innerText = `現在の表示: ${displayText}`;

    if (!silent) renderSalesList();
    if (!silent) renderCharts(start ? start.getFullYear() : now.getFullYear(), start ? start.getMonth() : now.getMonth());
}

function applyCustomPeriod() {
    const s = document.getElementById('list-period-start').value;
    const e = document.getElementById('list-period-end').value;
    if (s && e) {
        currentFilter = { start: s, end: e, periodName: 'custom' };
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        document.getElementById('current-period-display').innerText = `期間: ${s} 、E${e}`;
        renderSalesList();

        // Charts: Use the END date of the range to show the most recent relevant data
        // instead of the start date which might be far in the past (e.g. 2024 in a 2024-2025 range)
        const ed = new Date(e);
        renderCharts(ed.getFullYear(), ed.getMonth());

        // Also update the dropdown to match
        const yearSelector = document.getElementById('yearly-year-selector');
        if (yearSelector) yearSelector.value = ed.getFullYear();
    }
}

// Window function for Sort
window.sortSalesList = function (key) {
    if (currentSort.key === key) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.order = 'desc';
    }
    renderSalesList();
};

function renderSalesList() {
    const search = document.getElementById('search-input').value.toLowerCase();

    let filtered = salesData.filter(d => {
        if (currentFilter.start && d.date < currentFilter.start) return false;
        if (currentFilter.end && d.date > currentFilter.end) return false;

        if (search) {
            const txt = (d.customerName + JSON.stringify(d.items)).toLowerCase();
            return txt.includes(search);
        }
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        let va = a[currentSort.key];
        let vb = b[currentSort.key];

        if (currentSort.key === 'amount') { va = a.totalAmount; vb = b.totalAmount; }
        if (currentSort.key === 'customer') { va = a.customerName; vb = b.customerName; }
        if (currentSort.key === 'payment') { va = a.paymentMethod; vb = b.paymentMethod; }

        if (va < vb) return currentSort.order === 'asc' ? -1 : 1;
        if (va > vb) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    // Render Table
    const container = document.getElementById('sales-list-container');
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#999;">チE�Eタがありません</div>';
        return;
    }

    const getSortIcon = (key) => {
        if (currentSort.key !== key) return '<span style="opacity:0.3">⇁E/span>';
        return currentSort.order === 'asc' ? '▲' : '▼';
    };

    let html = `<table class="styled-table"><thead><tr>
        <th class="sortable" onclick="sortSalesList('date')" style="cursor:pointer">日仁E${getSortIcon('date')}</th>
        <th>曜日</th>
        <th class="sortable" onclick="sortSalesList('customer')" style="cursor:pointer">お客様名 ${getSortIcon('customer')}</th>
        <th class="sortable text-right" onclick="sortSalesList('amount')" style="cursor:pointer">金顁E${getSortIcon('amount')}</th>
        <th class="sortable" onclick="sortSalesList('payment')" style="cursor:pointer">決渁E${getSortIcon('payment')}</th>
        <th>操佁E/th>
    </tr></thead><tbody>`;

    filtered.forEach(sale => {
        // Details HTML for Tooltip
        const detailsHtml = sale.items.map(i => {
            const isMan = i.isManager ? '<span title="店長拁E��E>👑</span>' : '';
            return `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; border-bottom:1px dashed #eee; padding-bottom:4px;">
                    <div style="display:flex; flex-direction:column; line-height:1.2;">
                        <span style="font-size:0.7rem; color:#888;">${i.category}</span>
                        <span style="font-size:0.85rem; font-weight:600; color:#333;">${isMan}${i.productName} x${i.quantity}</span>
                    </div>
                    <span style="font-size:0.85rem;">¥${i.subtotal.toLocaleString()}</span>
                </div>
            `;
        }).join('');

        const dateObj = new Date(sale.date);
        const dayIdx = dateObj.getDay();
        const dayStr = ['日', '朁E, '火', '水', '木', '釁E, '圁E][dayIdx];

        // CSS Classes for Row Styling
        let rowClass = '';
        if (dayIdx === 0 || dayIdx === 3) rowClass = 'row-red'; // Sun(0) or Wed(3)
        else if (dayIdx === 6) rowClass = 'row-blue'; // Sat(6)

        html += `
            <tr class="${rowClass}">
                <td style="font-weight:500;">${sale.date.includes('T') ? sale.date.split('T')[0] : sale.date}</td>
                <td style="font-weight:500;">${dayStr}</td>
                <td style="font-weight:600">${sale.customerName}</td>
                <td class="text-right" style="font-weight:700">¥${sale.totalAmount.toLocaleString()}</td>
                <td><span class="badge-${sale.paymentMethod}">${sale.paymentMethod}</span></td>
                <td>
                    <div class="op-btn-group">
                        <div class="detail-wrapper">
                            <button class="btn-secondary btn-sm" style="background:#e0e7ff; color:#4f46e5; border:none;" onclick="void(0)">📄 明細</button>
                            <div class="detail-tooltip">
                                <div style="font-size:0.8rem; font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ddd; padding-bottom:4px; color:#555;">明細 (${sale.items.length}点)</div>
                                ${detailsHtml}
                                <div style="text-align:right; font-weight:bold; font-size:0.9rem; margin-top:8px; color:#4f46e5;">合訁E ¥${sale.totalAmount.toLocaleString()}</div>
                            </div>
                        </div>
                        <button class="btn-secondary btn-sm" onclick="editSale('${sale.id}')">編雁E/button>
                        <button class="btn-danger btn-sm" onclick="deleteSale('${sale.id}')">削除</button>
                    </div>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    updateSummaryChips(filtered);
}

function updateSummaryChips(data) {
    const now = new Date();
    const todayStr = formatDateISO(now);
    const day = now.getDay();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - day);
    const weekStartStr = formatDateISO(weekStart);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = formatDateISO(monthStart);

    let tS = 0, tC = 0, wS = 0, wC = 0, mS = 0, mC = 0;

    salesData.forEach(s => {
        const c = s.items.length;
        if (s.date === todayStr) { tS += s.totalAmount; tC += c; }
        if (s.date >= weekStartStr && s.date <= todayStr) { wS += s.totalAmount; wC += c; }
        if (s.date >= monthStartStr && s.date <= todayStr) { mS += s.totalAmount; mC += c; }
    });

    document.getElementById('today-sales').textContent = '¥' + tS.toLocaleString();
    document.getElementById('today-count').textContent = tC + '件';
    document.getElementById('week-sales').textContent = '¥' + wS.toLocaleString();
    document.getElementById('week-count').textContent = wC + '件';
    document.getElementById('month-sales').textContent = '¥' + mS.toLocaleString();
    document.getElementById('month-count').textContent = mC + '件';
}

// --- Logic: Charts & Dashboard ---
function initCharts() {
    const ctxYear = document.getElementById('yearlySalesChart').getContext('2d');
    charts.yearly = new Chart(ctxYear, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: '売丁E, data: [], backgroundColor: '#667eea', borderRadius: 4 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index; // Month index 0-11
                    const yearVal = document.getElementById('yearly-year-selector').value;
                    const year = yearVal ? parseInt(yearVal) : new Date().getFullYear();

                    // Render Daily Chart for selected month
                    renderCharts(year, index);

                    // Update display text
                    document.getElementById('monthly-display-period').innerText = `(${year}年${index + 1}朁E`;
                }
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            }
        }
    });

    const ctxMonth = document.getElementById('monthlyDailyChart').getContext('2d');
    charts.monthly = new Chart(ctxMonth, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: '売丁E, data: [], backgroundColor: '#764ba2', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const ctxPie = document.getElementById('paymentPieChart').getContext('2d');
    charts.paymentPie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['現釁E, '振込', 'カーチE],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#10b981', '#f59e0b', '#667eea'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });

    const ctxTrend = document.getElementById('dailySalesTrendChart').getContext('2d');
    charts.dailyTrend = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: [], datasets: [{
                label: '売丁E, data: [], borderColor: '#667eea', tension: 0.3, fill: true, backgroundColor: 'rgba(102, 126, 234, 0.1)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// Update Year Selector based on data
function updateYearSelector() {
    const years = new Set(salesData.map(s => new Date(s.date).getFullYear()));
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    const sortedYears = Array.from(years).sort((a, b) => b - a);

    const selector = document.getElementById('yearly-year-selector');
    if (!selector) return;
    const verifyVal = selector.value;
    selector.innerHTML = '';

    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + '年';
        if (y === currentYear && !verifyVal) opt.selected = true;
        selector.appendChild(opt);
    });

    if (verifyVal && sortedYears.includes(parseInt(verifyVal))) {
        selector.value = verifyVal;
    }
}

function updateDashboard() {
    renderSalesList();

    // Dashboard Period
    const startStr = document.getElementById('dashboard-start-period').value || new Date().toISOString().slice(0, 7);
    const endStr = document.getElementById('dashboard-end-period').value || new Date().toISOString().slice(0, 7);

    if (!document.getElementById('dashboard-start-period').value) {
        document.getElementById('dashboard-start-period').value = startStr;
        document.getElementById('dashboard-end-period').value = endStr;
        document.getElementById('dashboard-period-display').innerText = `${startStr} 、E${endStr}`;
    }

    renderDashboardKPIS(startStr, endStr);

    const now = new Date();
    const d = currentFilter.start ? new Date(currentFilter.start) : now;

    updateYearSelector();

    // Check year selector
    const selYear = document.getElementById('yearly-year-selector').value;
    const y = selYear ? parseInt(selYear) : d.getFullYear();

    renderCharts(y, d.getMonth());
}

const JapaneseHolidays = {
    isHoliday: function (date) {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const w = date.getDay(); // 0=Sun

        const isBasicHoliday = (y, m, d) => {
            // Fixed
            if (m == 1 && d == 1) return true;
            if (m == 2 && d == 11) return true;
            if (m == 2 && d == 23) return true;
            if (m == 4 && d == 29) return true;
            if (m == 5 && d == 3) return true;
            if (m == 5 && d == 4) return true;
            if (m == 5 && d == 5) return true;
            if (m == 8 && d == 11) return true;
            if (m == 11 && d == 3) return true;
            if (m == 11 && d == 23) return true;

            // Happy Mondays
            const isNthMonday = (n) => {
                if (w !== 1) return false;
                return d >= (n - 1) * 7 + 1 && d <= n * 7;
            };
            if (m == 1 && isNthMonday(2)) return true;
            if (m == 7 && isNthMonday(3)) return true;
            if (m == 9 && isNthMonday(3)) return true;
            if (m == 10 && isNthMonday(2)) return true;

            // Equinoxes
            const vernal = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
            if (m == 3 && d == vernal) return true;
            const autumnal = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
            if (m == 9 && d == autumnal) return true;

            return false;
        };

        if (isBasicHoliday(y, m, d)) return true;

        // Transfer Holiday (Simple check: if yesterday was Sun & Holiday)
        if (w !== 0) { // If not Sunday
            const yesterday = new Date(date);
            yesterday.setDate(d - 1);
            if (yesterday.getDay() === 0 && isBasicHoliday(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate())) {
                return true;
            }
            // May 6th special case (if 3,4,5 contains Sunday)
            if (m == 5 && d == 6) {
                if (isBasicHoliday(y, 5, 3) && new Date(y, 4, 3).getDay() === 0) return true;
                if (isBasicHoliday(y, 5, 4) && new Date(y, 4, 4).getDay() === 0) return true;
                if (isBasicHoliday(y, 5, 5) && new Date(y, 4, 5).getDay() === 0) return true;
            }
        }

        return false;
    }
};

function renderCharts(year, month) {
    if (!salesData.length && !year) return;

    // Yearly
    const monthlyTotals = new Array(12).fill(0);
    let yearlySum = 0;
    salesData.forEach(s => {
        const d = new Date(s.date);
        if (d.getFullYear() === year) {
            monthlyTotals[d.getMonth()] += s.totalAmount;
            yearlySum += s.totalAmount;
        }
    });

    if (charts.yearly) {
        charts.yearly.data.labels = ['1朁E, '2朁E, '3朁E, '4朁E, '5朁E, '6朁E, '7朁E, '8朁E, '9朁E, '10朁E, '11朁E, '12朁E];
        charts.yearly.data.datasets[0].data = monthlyTotals;
        charts.yearly.update();
    }
    document.getElementById('yearly-total').textContent = '¥' + yearlySum.toLocaleString();

    // Monthly
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyTotals = new Array(daysInMonth).fill(0);
    const barColors = new Array(daysInMonth).fill('#764ba2'); // Default Purple
    const labelColors = new Array(daysInMonth).fill('#666'); // Default Label Color

    let monthlySum = 0;
    let monthlyCount = 0;

    salesData.forEach(s => {
        const d = new Date(s.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
            dailyTotals[d.getDate() - 1] += s.totalAmount;
            monthlySum += s.totalAmount;
            monthlyCount++; // Customer Count (Checkout Count)
        }
    });

    // Determine Colors
    for (let i = 0; i < daysInMonth; i++) {
        const currentDate = new Date(year, month, i + 1);
        const dayOfWeek = currentDate.getDay();
        // const isHol = JapaneseHolidays.isHoliday(currentDate); // Ignoring holidays as requested

        // Sun(0), Wed(3) Only => Red
        if (dayOfWeek === 0 || dayOfWeek === 3) {
            barColors[i] = '#ef4444';
            labelColors[i] = '#ef4444';
        }
        // Sat(6) => Blue
        else if (dayOfWeek === 6) {
            barColors[i] = '#3b82f6';
            labelColors[i] = '#3b82f6';
        }
    }

    if (charts.monthly) {
        charts.monthly.data.labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`);
        charts.monthly.data.datasets[0].data = dailyTotals;
        charts.monthly.data.datasets[0].backgroundColor = barColors;

        // Update Axis Colors dynamically
        charts.monthly.options.scales = {
            x: {
                ticks: {
                    color: labelColors // Array of colors for each label
                }
            },
            y: {
                beginAtZero: true
            }
        };

        charts.monthly.update();
    }
    document.getElementById('monthly-total').textContent = '¥' + monthlySum.toLocaleString();
    document.getElementById('monthly-count').textContent = monthlyCount;
}

// Dashboard Sort State
let dashboardSort = { key: 'date', order: 'desc' }; // date, sales, count

function renderDashboardKPIS(startMonthStr, endMonthStr) {
    // Update Title
    const [yNum, mNum] = startMonthStr.split('-');
    if (yNum && mNum) {
        const titleEl = document.getElementById('daily-trend-title');
        if (titleEl) titleEl.textContent = `${yNum}年${mNum}朁E日別売上トレンド`;
    }

    const startDate = new Date(startMonthStr + '-01');
    const endDate = new Date(endMonthStr + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);

    const startIso = formatDateISO(startDate);
    const endIso = formatDateISO(endDate);

    const data = salesData.filter(s => s.date >= startIso && s.date <= endIso);

    // KPIs
    let totalSales = 0;
    let transactions = 0;
    let customers = new Set();
    let paymentCounts = { '現釁E: 0, '振込': 0, 'クレジチE��カーチE: 0 };
    let paymentAmounts = { '現釁E: 0, '振込': 0, 'クレジチE��カーチE: 0 };
    const dailyMap = {};
    const dailyCountMap = {}; // Transactions (Total Items)
    const dailyCustomerMap = {}; // Unique Customers (Set)

    data.forEach(s => {
        // Definition 1: Transaction Count (Line Items)
        const lineItemCount = s.items.length;

        // Definition 2: Customer Count (Checkout/Visit Count for Payment Analysis)
        const checkoutCount = 1;

        totalSales += s.totalAmount;
        transactions += lineItemCount; // Dashboard Total = Transaction Count
        customers.add(s.customerName);

        // Payment Analysis: Use Customer Count (Checkout Count)
        if (paymentCounts[s.paymentMethod] !== undefined) {
            paymentCounts[s.paymentMethod] += checkoutCount;
            paymentAmounts[s.paymentMethod] += s.totalAmount;
        }

        dailyMap[s.date] = (dailyMap[s.date] || 0) + s.totalAmount;

        // Daily Trend Table: Count = Transaction Count
        dailyCountMap[s.date] = (dailyCountMap[s.date] || 0) + lineItemCount;

        if (!dailyCustomerMap[s.date]) dailyCustomerMap[s.date] = new Set();
        dailyCustomerMap[s.date].add(s.customerName);
    });

    // --- Manager Stats Logic (Added v14.1) ---
    let managerTotalSales = 0;
    let managerCustomers = new Set();
    let managerCategoryStats = {};

    data.forEach(s => {
        let hasManagerItem = false;
        s.items.forEach(item => {
            if (item.isManager) {
                const sub = item.subtotal || 0;
                managerTotalSales += sub;
                hasManagerItem = true;

                // Category Stats
                if (!managerCategoryStats[item.category]) {
                    managerCategoryStats[item.category] = { sales: 0, count: 0 };
                }
                managerCategoryStats[item.category].sales += sub;
                managerCategoryStats[item.category].count += 1; // Count occurrences/transactions, not quantity
            }
        });

        if (hasManagerItem) {
            managerCustomers.add(s.customerName);
        }
    });

    // Update Manager UI
    const mgrSalesEl = document.getElementById('manager-total-sales');
    if (mgrSalesEl) mgrSalesEl.textContent = '¥' + managerTotalSales.toLocaleString();

    const mgrCustEl = document.getElementById('manager-customer-count');
    if (mgrCustEl) mgrCustEl.textContent = managerCustomers.size + '人';

    const mgrCatBody = document.getElementById('manager-category-body');
    if (mgrCatBody) {
        const sortedCats = Object.entries(managerCategoryStats)
            .map(([key, val]) => ({ name: key, ...val }))
            .sort((a, b) => b.sales - a.sales);

        if (sortedCats.length === 0) {
            mgrCatBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999; padding:20px;">チE�EタなぁE/td></tr>';
        } else {
            let html = '';
            sortedCats.forEach(c => {
                html += `
                    <tr>
                        <td>${c.name}</td>
                        <td class="text-right">¥${c.sales.toLocaleString()}</td>
                        <td class="text-right">${c.count}件</td>
                    </tr>
                `;
            });
            mgrCatBody.innerHTML = html;
        }
    }

    // Render KPIs
    document.getElementById('total-sales').textContent = '¥' + totalSales.toLocaleString();
    document.getElementById('total-transactions').textContent = transactions + '件'; // Transaction Count
    document.getElementById('average-transaction').textContent = transactions ? '¥' + Math.floor(totalSales / transactions).toLocaleString() : '¥0'; // Transaction Unit Price
    document.getElementById('customer-count').textContent = customers.size + '人';
    document.getElementById('average-customer-spending').textContent = customers.size ? '¥' + Math.floor(totalSales / customers.size).toLocaleString() : '¥0';

    // Matrix Table & Pie Chart
    const methods = ['現釁E, '振込', 'クレジチE��カーチE];
    let matrixHtml = '';
    methods.forEach(m => {
        const count = paymentCounts[m];
        const amt = paymentAmounts[m];
        const ratio = totalSales ? ((amt / totalSales) * 100).toFixed(1) : 0;
        const avgPrice = count > 0 ? Math.floor(amt / count) : 0;

        matrixHtml += `
            <tr>
                <td>${m}</td>
                <td class="text-right">¥${amt.toLocaleString()}</td>
                <td class="text-right">${count}件</td>
                <td class="text-right">${ratio}%</td>
                <td class="text-right" style="font-weight:600">¥${avgPrice.toLocaleString()}</td>
            </tr>
        `;
    });
    document.getElementById('payment-matrix-body').innerHTML = matrixHtml;

    if (charts.paymentPie) {
        charts.paymentPie.data.datasets[0].data = [paymentAmounts['現釁E], paymentAmounts['振込'], paymentAmounts['クレジチE��カーチE]];
        charts.paymentPie.update();
    }

    // Trend Chart (Daily)
    const chartDates = Object.keys(dailyMap).sort();



    // Calculate Moving Average & Diffs
    const dailyDataObj = chartDates.map((date, idx) => {
        const sales = dailyMap[date];
        const count = dailyCountMap[date];
        const customerCount = dailyCustomerMap[date] ? dailyCustomerMap[date].size : 0;

        // 7-day Moving Average
        let sum7 = 0;
        let c7 = 0;
        for (let j = Math.max(0, idx - 6); j <= idx; j++) {
            sum7 += dailyMap[chartDates[j]];
            c7++;
        }
        const movAvg7 = Math.floor(sum7 / c7);

        // 30-day Moving Average
        let sum30 = 0;
        let c30 = 0;
        for (let j = Math.max(0, idx - 29); j <= idx; j++) {
            sum30 += dailyMap[chartDates[j]];
            c30++;
        }
        const movAvg30 = Math.floor(sum30 / c30);

        // Prev diff
        let diffPct = 0;
        let diffVal = 0;
        let hasPrev = false;
        if (idx > 0) {
            const prevSales = dailyMap[chartDates[idx - 1]];
            diffVal = sales - prevSales;
            diffPct = prevSales > 0 ? ((diffVal / prevSales) * 100).toFixed(1) : 0;
            hasPrev = true;
        }

        return { date, sales, count, customerCount, movAvg7, movAvg30, diffVal, diffPct, hasPrev };
    });

    // Chart Update
    if (charts.dailyTrend) {
        charts.dailyTrend.data.labels = chartDates;

        // Ensure we have two datasets in chart configuration, if not, we might need to re-init chart or just update first one.
        // For now, simpler to just update the existing one (Sales Trend).
        // If user wants to see moving average ON THE CHART, we would add another dataset.
        // For this request, user asked to addition "To the right of 7-day average", implying the Table.
        charts.dailyTrend.data.datasets[0].data = dailyDataObj.map(d => d.sales);
        charts.dailyTrend.update();
    }

    // Daily Table Sorted
    let tableData = [...dailyDataObj];
    tableData.sort((a, b) => {
        let va, vb;
        switch (dashboardSort.key) {
            case 'sales': va = a.sales; vb = b.sales; break;
            case 'count': va = a.count; vb = b.count; break;
            case 'date': default: va = a.date; vb = b.date; break;
        }
        if (va < vb) return dashboardSort.order === 'asc' ? -1 : 1;
        if (va > vb) return dashboardSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    const getIcon = (key) => dashboardSort.key === key ? (dashboardSort.order === 'asc' ? '▲' : '▼') : '';

    let tableHtml = `
        <thead>
            <tr>
                <th class="sortable" onclick="sortDashboard('date')" style="cursor:pointer">日仁E${getIcon('date')}</th>
                <th>曜日</th>
                <th class="sortable text-right" onclick="sortDashboard('sales')" style="cursor:pointer">売丁E${getIcon('sales')}</th>
                <th class="text-right">顧客数</th>
                <th class="sortable text-right" onclick="sortDashboard('count')" style="cursor:pointer">件数 ${getIcon('count')}</th>
                <th class="text-right">前日毁E/th>
                <th class="text-right">7日平坁E/th>
                <th class="text-right">30日平坁E/th>
            </tr>
        </thead>
        <tbody>`;

    tableData.forEach(day => {
        const dateObj = new Date(day.date);
        const dayOfWeekIdx = dateObj.getDay();
        const dayOfWeek = ['日', '朁E, '火', '水', '木', '釁E, '圁E][dayOfWeekIdx];

        let rowClass = '';
        if (dayOfWeekIdx === 0 || dayOfWeekIdx === 3) rowClass = 'row-red'; // Sun or Wed
        if (dayOfWeekIdx === 6) rowClass = 'row-blue'; // Sat

        let diffHtml = '<span style="color:#ccc">-</span>';
        if (day.hasPrev) {
            const color = day.diffVal > 0 ? '#059669' : (day.diffVal < 0 ? '#dc2626' : '#999');
            const arrow = day.diffVal > 0 ? '▲' : (day.diffVal < 0 ? '▼' : '');
            // Use original styling: bold for diff
            diffHtml = `<span style="color:${color}; font-weight:600">${arrow} ${Math.abs(day.diffPct)}%</span>`;
        }

        tableHtml += `
            <tr class="${rowClass}">
                <td>${day.date.includes('T') ? day.date.split('T')[0] : day.date}</td>
                <td>${dayOfWeek}</td>
                <td class="text-right">¥${day.sales.toLocaleString()}</td>
                <td class="text-right">${day.customerCount}人</td>
                <td class="text-right">${day.count}件</td>
                <td class="text-right">${diffHtml}</td>
                <td class="text-right" style="color:#f59e0b; font-weight:600">¥${day.movAvg7.toLocaleString()}</td>
                <td class="text-right" style="color:#3b82f6; font-weight:600">¥${day.movAvg30.toLocaleString()}</td>
            </tr>
            `;
    });
    tableHtml += '</tbody>';
    document.getElementById('daily-sales-table').innerHTML = tableHtml;

    // Rankings
    renderRankings('category', 5, data);
    renderRankings('product', 5, data);
    renderRankings('customer', 5, data);
}

window.sortDashboard = function (key) {
    if (dashboardSort.key === key) {
        dashboardSort.order = dashboardSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        dashboardSort.key = key;
        dashboardSort.order = 'desc';
    }
    // Re-render
    const s = document.getElementById('dashboard-start-period').value;
    const e = document.getElementById('dashboard-end-period').value;
    renderDashboardKPIS(s, e);
};

function renderRankings(type, count = 5, data = null) {
    if (!data) {
        const startStr = document.getElementById('dashboard-start-period').value;
        const endStr = document.getElementById('dashboard-end-period').value;
        if (startStr && endStr) {
            const startDate = new Date(startStr + '-01');
            const endDate = new Date(endStr + '-01');
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
            const startIso = formatDateISO(startDate);
            const endIso = formatDateISO(endDate);
            data = salesData.filter(s => s.date >= startIso && s.date <= endIso);
        } else {
            data = salesData;
        }
    }

    let stats = {};
    data.forEach(sale => {
        if (type === 'customer') {
            const k = sale.customerName;
            if (!stats[k]) stats[k] = { sales: 0, count: 0, name: k };
            stats[k].sales += sale.totalAmount;
            stats[k].count++;
        } else {
            sale.items.forEach(item => {
                const k = type === 'category' ? item.category : item.productName;
                if (!stats[k]) stats[k] = { sales: 0, count: 0, name: k, category: item.category };
                stats[k].sales += (item.subtotal || 0);
                stats[k].count++;
            });
        }
    });

    const sorted = Object.entries(stats).map(([k, v]) => ({
        name: v.name,
        sales: v.sales,
        count: v.count,
        category: v.category
    }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, count);

    const container = document.getElementById(`${type}-ranking`);
    if (!container) return;

    let html = '';
    sorted.forEach((item, index) => {
        const medal = index === 0 ? '🥁E : index === 1 ? '🥁E : index === 2 ? '🥁E : `${index + 1}`;

        let bgStyle = 'background: white;';
        if (index === 0) bgStyle = 'background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);';
        else if (index === 1) bgStyle = 'background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);';
        else if (index === 2) bgStyle = 'background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);';

        if (type === 'customer' && index < 3) {
            bgStyle = 'background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);';
        }

        let infoHtml = '';
        if (type === 'product') {
            infoHtml = `
                <div class="ranking-info">
                    <div class="rank-cat">${item.category}</div>
                    <div class="rank-prod">${item.name}</div>
                </div>`;
        } else {
            infoHtml = `<div class="ranking-info">${item.name}</div>`;
        }

        html += `
            <div class="ranking-item" style="${bgStyle}">
                <div class="ranking-rank">${medal}</div>
                ${infoHtml}
                <div class="ranking-count" style="font-size:0.8em; color:#666; margin-right:8px;">${item.count}${type === 'customer' ? '囁E : '件'}</div>
                <div class="ranking-val">¥${item.sales.toLocaleString()}</div>
            </div>
        `;
    });
    container.innerHTML = html || '<div class="text-muted text-center p-2">チE�EタなぁE/div>';
}


function applyQuickPeriod(type) {
    const now = new Date();
    let start, end;
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    /* Note: input type="month" expects "YYYY-MM" */
    const toMonthStr = (date) => {
        const yy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yy}-${mm}`;
    };

    switch (type) {
        case 'this-month':
            start = new Date(y, m, 1);
            end = new Date(y, m, 1);
            break;
        case 'last-month':
            start = new Date(y, m - 1, 1);
            end = new Date(y, m - 1, 1);
            break;
        case 'last-3-months':
            start = new Date(y, m - 2, 1);
            end = new Date(y, m, 1);
            break;
        case 'this-year':
            start = new Date(y, 0, 1);
            end = new Date(y, m, 1);
            break;
        case 'last-year':
            start = new Date(y - 1, 0, 1);
            end = new Date(y - 1, 11, 1);
            break;
    }

    if (start && end) {
        document.getElementById('dashboard-start-period').value = toMonthStr(start);
        document.getElementById('dashboard-end-period').value = toMonthStr(end);

        // Auto apply
        applyDashboardPeriod();
    }
}

function applyDashboardPeriod() {
    const s = document.getElementById('dashboard-start-period').value;
    const e = document.getElementById('dashboard-end-period').value;
    document.getElementById('dashboard-period-display').innerText = `${s} 、E${e}`;
    document.getElementById('dashboard-period-panel').classList.add('hidden');
    renderDashboardKPIS(s, e);
}

// --- Utils ---
window.exportToCSV = function () {
    const header = ['日仁E, 'お客様名', 'カチE��リー', '啁E��吁E, '個数', '単価', '小訁E, '合計��顁E, '決済方況E];
    let csvContent = '\uFEFF' + header.join(',') + '\n';

    salesData.forEach(sale => {
        sale.items.forEach((item, index) => {
            const row = [
                sale.date,
                sale.customerName,
                item.category,
                item.productName,
                item.quantity,
                item.unitPrice,
                item.subtotal,
                (index === 0 ? sale.totalAmount : ''),
                (index === 0 ? sale.paymentMethod : '')
            ];
            csvContent += row.join(',') + '\n';
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('CSVを�E力しました');
};

window.editSale = function (id) {
    console.log('Edit sale requested:', id);
    const s = salesData.find(d => d.id === id);
    if (s) {
        editingId = id;

        // Populate Edit Form
        document.getElementById('edit-sale-date').value = s.date;
        document.getElementById('edit-customer-name').value = s.customerName;

        document.querySelectorAll('.edit-payment-option').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.edit-payment-option').forEach(el => {
            if (el.dataset.value === s.paymentMethod) selectEditPaymentMethod(el);
        });

        document.getElementById('edit-items-container').innerHTML = '';
        editItemCounter = 0;
        s.items.forEach(item => {
            window.addEditItemRow();
            const row = document.getElementById(`edit-item-row-${editItemCounter}`);
            row.querySelector('.item-category').value = item.category;
            row.querySelector('.item-product').value = item.productName;
            row.querySelector('.item-qty').value = item.quantity;
            row.querySelector('.item-price').value = item.unitPrice;
            row.querySelector('.item-is-manager').checked = item.isManager || false;
        });
        window.updateEditTotal();

        // Switch Views (In-Tab)
        document.getElementById('sales-list-view').classList.add('hidden');
        document.getElementById('sales-edit-view').classList.remove('hidden');

    } else {
        console.error('Sale not found:', id);
        showNotification('チE�Eタが見つかりません', 'error');
    }
}

window.deleteSale = function (id) {
    console.log('Delete sale requested:', id);
    if (confirm('削除しますか�E�E)) {
        salesData = salesData.filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(salesData));
        updateDashboard();
        showNotification('削除しました');
    }
}

window.deleteAllData = function () {
    if (confirm('全チE�Eタを削除しますか�E�E(LocalStorageのみ)')) {
        salesData = [];
        localStorage.removeItem(STORAGE_KEY);
        updateDashboard();
        document.getElementById('local-data-count').textContent = '0件';
        showNotification('全チE�Eタを削除しました');
    }
}

window.sendToGoogleSheets = function (data) {
    const payload = {
        action: 'saveSale',
        sale: {
            ...data,
            customer: data.customerName
        }
    };

    fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(json => {
            if (json.status === 'success') {
                console.log('☁E��ECloud Auto-Save Success');
                showNotification('クラウド保存完亁E, 'info');
            } else {
                console.error('Cloud Error:', json);
                showNotification('クラウド保存エラー: ' + (json.message || 'unknown'), 'error');
            }
        })
        .catch(e => {
            console.error('Cloud Network Error:', e);
            showNotification('クラウド保存失敁E(オフライン)', 'error');
        });
};

window.importToGoogleSheets = function () {
    if (!salesData.length) { showNotification('チE�Eタがありません', 'error'); return; }
    if (!confirm(`Localの${salesData.length}件をGoogleSheetsに一括送信しますか�E�`)) return;

    showNotification('一括送信中...', 'info');

    const payload = salesData.map(s => ({
        id: String(s.id),
        date: s.date,
        customer: s.customerName,
        products: s.items,
        totalAmount: s.totalAmount,
        paymentMethod: s.paymentMethod,
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));

    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'import',
            data: payload
        })
    }).then(() => {
        showNotification('送信リクエスト完亁E(非同朁E');
    }).catch(e => {
        showNotification('送信エラー: ' + e, 'error');
    });
};

window.clearCloudData = function () {
    if (!confirm('【重要】\nGoogle Sheets上�E全チE�Eタを削除します、En本当によろしいですか�E�E)) return;

    showNotification('クラウド削除中...', 'info');

    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
    }).then(() => {
        // Since no-cors, we can't see the response, but assume sent.
        // It takes a moment for GAS to process.
        setTimeout(() => {
            showNotification('送信完亁E クラウドデータ削除リクエスチE, 'success');
        }, 1000);
    }).catch(e => {
        showNotification('通信エラー: ' + e, 'error');
    });
};

window.testGASConnection = function () {
    fetch(GAS_URL + '?action=test')
        .then(res => res.json())
        .then(data => {
            alert('接続�E劁E ' + JSON.stringify(data));
        })
        .catch(e => alert('接続失敁E ' + e));
}

function formatDateISO(date) {
    if (typeof date === 'string') return date.split('T')[0];
    if (!(date instanceof Date) || isNaN(date)) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function showNotification(msg, type = 'success') {
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = msg;
    if (type === 'error' || type === 'info') div.style.background = type === 'error' ? '#ef4444' : '#3b82f6';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

window.downloadFromGoogleSheets = async function () {
    if (!confirm('【警告】\nGoogle SheetsのチE�Eタでアプリ冁E�EチE�Eタを上書きします、Enアプリ冁E��編雁E��の未保存データは失われます、Enよろしいですか�E�E)) return;

    showNotification('チE�Eタを取得中...', 'info');

    try {
        // GET request to GAS (must support CORS)
        const response = await fetch(GAS_URL + '?action=load');

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const json = await response.json();
        let data = [];

        if (json.status === 'success' && json.data) {
            data = json.data;
        } else if (Array.isArray(json)) {
            data = json;
        } else {
            throw new Error('Invalid data format from GAS');
        }

        salesData = data.map(d => {
            // Fix: Store as YYYY-MM-DD string to avoid timezone/filter issues on mobile
            let cleanDate = d.date || '';

            // [Trap 1] If date is blank, use createdAt as fallback
            if (!cleanDate || cleanDate === '') {
                if (d.createdAt) {
                    cleanDate = String(d.createdAt).split('T')[0];
                } else {
                    cleanDate = new Date().toISOString().split('T')[0];
                }
            }

            // [Trap 2] Robust date parsing
            if (cleanDate && typeof cleanDate === 'string' && cleanDate.includes('T')) {
                // Force JST
                const dt = new Date(cleanDate);
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, '0');
                const day = String(dt.getDate()).padStart(2, '0');
                cleanDate = `${y}-${m}-${day}`;
            }

            // Fallback for malformed items array
            let items = d.items;
            if (!items && d.products) items = d.products; // Compatibility with older format
            if (typeof items === 'string') { // Added check for string items
                try { items = JSON.parse(items); } catch (e) { items = []; }
            }
            if (!Array.isArray(items)) items = [];

            return {
                ...d,
                date: cleanDate,
                items: items,
                totalAmount: Number(d.totalAmount) || 0
            };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(salesData));

        // Update UI
        updateDashboard();
        updateYearSelector();
        document.getElementById('local-data-count').textContent = `${salesData.length}件`;

        showNotification(`復允E��亁E ${salesData.length}件のチE�Eタをロードしました`);

    } catch (e) {
        console.error('Download Error:', e);
        showNotification('チE�Eタの取得に失敗しました、EASコーチECORS対忁Eを確認してください、E, 'error');
    }
}
