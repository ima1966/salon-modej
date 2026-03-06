/**
 * サロン Mode J 売上管理システム v14.6.01
 * Antigravity Refactored Version
 */



// --- Constants & Config ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZmPqE4iVbBTjap868DimV5my8xyzbHIWf3-FzEnXd_1cRvyyW1D7poFREpggk5kkk/exec';
const STORAGE_KEY = 'salonSalesData';

// --- State ---
let salesData = [];
let editingId = null;
let itemCounter = 0;
let editItemCounter = 0;

function getLatestDataMonthStr() {
    if (!salesData || salesData.length === 0) {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    let max = salesData[0].date;
    for (let i = 1; i < salesData.length; i++) {
        if (salesData[i].date && salesData[i].date > max) max = salesData[i].date;
    }
    if (!max) {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return max.substring(0, 7);
}

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
            salesData = salesData.map(d => ({
                ...d,
                totalAmount: Number(d.totalAmount) || 0,
                items: d.items || []
            }));
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

    // Default Filters or Restored Filters
    const savedFilter = localStorage.getItem('lastListFilter');
    if (savedFilter) {
        try {
            const parsed = JSON.parse(savedFilter);
            if (parsed.periodName === 'custom') {
                document.getElementById('list-period-start').value = parsed.start || '';
                document.getElementById('list-period-end').value = parsed.end || '';
                applyCustomPeriod(true);
            } else {
                applyPeriodFilter(parsed.periodName, true);
            }
        } catch (e) {
            applyPeriodFilter('latest-data', true);
        }
    } else {
        applyPeriodFilter('latest-data', true);
    }

    // ⭐ Restore Dashboard Filters Explicitly to prevent browser cache issues
    const savedDashStart = localStorage.getItem('lastDashboardStart');
    const savedDashEnd = localStorage.getItem('lastDashboardEnd');
    if (savedDashStart && savedDashEnd) {
        document.getElementById('dashboard-start-period').value = savedDashStart;
        document.getElementById('dashboard-end-period').value = savedDashEnd;
    } else {
        const nowM = getLatestDataMonthStr();
        document.getElementById('dashboard-start-period').value = nowM;
        document.getElementById('dashboard-end-period').value = nowM;
    }

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

    // 最後に開いていたタブを復元（なければ 'input'）
    const lastActiveTab = localStorage.getItem('activeTab') || 'input';
    switchTab(lastActiveTab);
}

window.switchTab = function (tabId) {
    // 開いたタブを記憶する
    localStorage.setItem('activeTab', tabId);

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tabId}-tab`));

    if (tabId === 'dashboard' || tabId === 'list') {
        // タブ切り替え時にダッシュボード/一覧のデータとグラフを最新化し、表示サイズも再計算させる
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        // Chart.js のリサイズバグ（display:noneからblockへの復帰時）を防止
        Object.values(charts).forEach(chart => {
            if (chart) chart.resize();
        });
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
                <label class="manager-check-label" title="店長担当">
                    <input type="checkbox" class="item-is-manager"> 👑
                </label>
            </div>
            <button type="button" class="btn-remove" onclick="removeItemRow(${itemCounter})">🗑️</button>
        </div>
        <div class="item-grid-row">
            <div class="form-group">
                <select class="item-category" onchange="updateTotal()" required>
                    <option value="">カテゴリー選択</option>
                    <option value="サブスクリプション">サブスク</option>
                    <option value="会員 若よもぎ蒸し">会員 よもぎ</option>
                    <option value="非会員 若よもぎ蒸し">非会員 よもぎ</option>
                    <option value="施術">施術</option>
                    <option value="ベルマン">ベルマン</option>
                    <option value="クレンシア">クレンシア</option>
                    <option value="水素関連">水素関連</option>
                    <option value="その他">その他</option>
                </select>
            </div>
            <div class="form-group">
                <input type="text" class="item-product" placeholder="商品名" required autocomplete="off">
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
        showNotification('明細は1つ以上必要です', 'error');
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
        showNotification('お客様名にカンマ(,)は使用できません', 'error');
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
            showNotification('入力不備があります', 'error'); return;
        }

        if (prod.includes(',')) {
            showNotification('商品名にカンマ(,)は使用できません', 'error');
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
                <label class="manager-check-label" title="店長担当">
                    <input type="checkbox" class="item-is-manager"> 👑
                </label>
            </div>
            <button type="button" class="btn-remove" onclick="removeEditItemRow(${editItemCounter})">🗑️</button>
        </div>
        <div class="item-grid-row">
            <div class="form-group">
                <select class="item-category" onchange="updateEditTotal()" required>
                    <option value="">カテゴリー選択</option>
                    <option value="サブスクリプション">サブスク</option>
                    <option value="会員 若よもぎ蒸し">会員 よもぎ</option>
                    <option value="非会員 若よもぎ蒸し">非会員 よもぎ</option>
                    <option value="施術">施術</option>
                    <option value="ベルマン">ベルマン</option>
                    <option value="クレンシア">クレンシア</option>
                    <option value="水素関連">水素関連</option>
                    <option value="その他">その他</option>
                </select>
            </div>
            <div class="form-group">
                <input type="text" class="item-product" placeholder="商品名" required autocomplete="off">
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
        showNotification('明細は1つ以上必要です', 'error');
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
        showNotification('お客様名にカンマ(,)は使用できません', 'error');
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
            showNotification('入力不備があります', 'error'); return;
        }

        if (prod.includes(',')) {
            showNotification('商品名にカンマ(,)は使用できません', 'error');
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
    } else if (period === 'latest-data') {
        const latestM = getLatestDataMonthStr(); // e.g. "2026-02"
        const parts = latestM.split('-');
        if (parts.length >= 2) {
            start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            end = new Date(parseInt(parts[0]), parseInt(parts[1]), 0);
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
    }

    document.querySelector(`.btn-filter[data-period="${period}"]`)?.classList.add('active');

    currentFilter = {
        start: start ? formatDateISO(start) : null,
        end: end ? formatDateISO(end) : null,
        periodName: period
    };
    localStorage.setItem('lastListFilter', JSON.stringify(currentFilter));

    // Update Display
    let displayText = '';

    if (currentFilter.start === currentFilter.end && currentFilter.start) {
        const d = new Date(currentFilter.start);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const dy = d.getDate();
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
        displayText = `${y}年${m}月${dy}日 (${dayOfWeek})`;
        // For monthly chart title, just show month
        document.getElementById('monthly-display-period').innerText = `(${y}年${m}月)`;
    } else if (currentFilter.start && currentFilter.end) {
        // Attempt to detect if it's a full month range for cleaner display
        const s = new Date(currentFilter.start);
        const e = new Date(currentFilter.end);


        const isFullMonth = s.getDate() === 1 &&
            e.getMonth() === s.getMonth() &&
            e.getFullYear() === s.getFullYear() &&
            e.getDate() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();

        if (isFullMonth) {
            displayText = `${s.getFullYear()}年${s.getMonth() + 1}月`;
            document.getElementById('monthly-display-period').innerText = `(${s.getFullYear()}年${s.getMonth() + 1}月)`;
        } else {
            displayText = `${currentFilter.start} 〜 ${currentFilter.end}`;
            // Even for custom ranges, try to show relevant month in daily chart title if close enough
            // Default to showing the month of the start date
            document.getElementById('monthly-display-period').innerText = `(${s.getFullYear()}年${s.getMonth() + 1}月)`;
        }
    } else {
        displayText = '全期間';
        document.getElementById('monthly-display-period').innerText = '';
    }

    document.getElementById('current-period-display').innerText = `現在の表示: ${displayText}`;

    if (!silent) renderSalesList();
    if (!silent) renderCharts(start ? start.getFullYear() : now.getFullYear(), start ? start.getMonth() : now.getMonth());
}

function applyCustomPeriod(silent = false) {
    const s = document.getElementById('list-period-start').value;
    const e = document.getElementById('list-period-end').value;
    if (s && e) {
        currentFilter = { start: s, end: e, periodName: 'custom' };
        localStorage.setItem('lastListFilter', JSON.stringify(currentFilter));
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        document.getElementById('current-period-display').innerText = `期間: ${s} 〜 ${e}`;
        if (!silent) renderSalesList();

        // Charts: Use the END date of the range to show the most recent relevant data
        // instead of the start date which might be far in the past (e.g. 2024 in a 2024-2025 range)
        const ed = new Date(e);
        if (!silent) renderCharts(ed.getFullYear(), ed.getMonth());

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
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#999;">データがありません</div>';
        return;
    }

    const getSortIcon = (key) => {
        if (currentSort.key !== key) return '<span style="opacity:0.3">⇅</span>';
        return currentSort.order === 'asc' ? '▲' : '▼';
    };

    let html = `<table class="styled-table"><thead><tr>
        <th class="sortable" onclick="sortSalesList('date')" style="cursor:pointer">日付 ${getSortIcon('date')}</th>
        <th>曜日</th>
        <th class="sortable" onclick="sortSalesList('customer')" style="cursor:pointer">お客様名 ${getSortIcon('customer')}</th>
        <th class="sortable text-right" onclick="sortSalesList('amount')" style="cursor:pointer">金額 ${getSortIcon('amount')}</th>
        <th class="sortable" onclick="sortSalesList('payment')" style="cursor:pointer">決済 ${getSortIcon('payment')}</th>
        <th>操作</th>
    </tr></thead><tbody>`;

    filtered.forEach(sale => {
        // Details HTML for Tooltip
        const detailsHtml = sale.items.map(i => {
            const isMan = i.isManager ? '<span title="店長担当">👑</span>' : '';
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
        const dayStr = ['日', '月', '火', '水', '木', '金', '土'][dayIdx];

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
                                <div style="text-align:right; font-weight:bold; font-size:0.9rem; margin-top:8px; color:#4f46e5;">合計: ¥${sale.totalAmount.toLocaleString()}</div>
                            </div>
                        </div>
                        <button class="btn-secondary btn-sm" onclick="editSale('${sale.id}')">編集</button>
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
        data: { labels: [], datasets: [{ label: '売上', data: [], backgroundColor: '#667eea', borderRadius: 4 }] },
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
                    document.getElementById('monthly-display-period').innerText = `(${year}年${index + 1}月)`;
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
        data: { labels: [], datasets: [{ label: '売上', data: [], backgroundColor: '#764ba2', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const ctxPie = document.getElementById('paymentPieChart').getContext('2d');
    charts.paymentPie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['現金', '振込', 'カード'],
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
                label: '売上', data: [], borderColor: '#667eea', tension: 0.3, fill: true, backgroundColor: 'rgba(102, 126, 234, 0.1)'
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
    let startInputStr = document.getElementById('dashboard-start-period').value;
    let endInputStr = document.getElementById('dashboard-end-period').value;

    if (!startInputStr || !endInputStr) {
        startInputStr = getLatestDataMonthStr();
        endInputStr = startInputStr;
        document.getElementById('dashboard-start-period').value = startInputStr;
        document.getElementById('dashboard-end-period').value = endInputStr;
    }

    // 表示文字も必ず更新
    document.getElementById('dashboard-period-display').innerText = `${startInputStr} 〜 ${endInputStr}`;

    renderDashboardKPIS(startInputStr, endInputStr);

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
        charts.yearly.data.labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
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
        if (titleEl) titleEl.textContent = `${yNum}年${mNum}月 日別売上トレンド`;
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
    let paymentCounts = { '現金': 0, '振込': 0, 'クレジットカード': 0 };
    let paymentAmounts = { '現金': 0, '振込': 0, 'クレジットカード': 0 };
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
            mgrCatBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999; padding:20px;">データなし</td></tr>';
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
    const methods = ['現金', '振込', 'クレジットカード'];
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
        charts.paymentPie.data.datasets[0].data = [paymentAmounts['現金'], paymentAmounts['振込'], paymentAmounts['クレジットカード']];
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
                <th class="sortable" onclick="sortDashboard('date')" style="cursor:pointer">日付 ${getIcon('date')}</th>
                <th>曜日</th>
                <th class="sortable text-right" onclick="sortDashboard('sales')" style="cursor:pointer">売上 ${getIcon('sales')}</th>
                <th class="text-right">顧客数</th>
                <th class="sortable text-right" onclick="sortDashboard('count')" style="cursor:pointer">件数 ${getIcon('count')}</th>
                <th class="text-right">前日比</th>
                <th class="text-right">7日平均</th>
                <th class="text-right">30日平均</th>
            </tr>
        </thead>
        <tbody>`;

    tableData.forEach(day => {
        const dateObj = new Date(day.date);
        const dayOfWeekIdx = dateObj.getDay();
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dayOfWeekIdx];

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
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;

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
                <div class="ranking-count" style="font-size:0.8em; color:#666; margin-right:8px;">${item.count}${type === 'customer' ? '回' : '件'}</div>
                <div class="ranking-val">¥${item.sales.toLocaleString()}</div>
            </div>
        `;
    });
    container.innerHTML = html || '<div class="text-muted text-center p-2">データなし</div>';
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
    localStorage.setItem('lastDashboardStart', s);
    localStorage.setItem('lastDashboardEnd', e);
    document.getElementById('dashboard-period-display').innerText = `${s} 〜 ${e}`;
    document.getElementById('dashboard-period-panel').classList.add('hidden');
    renderDashboardKPIS(s, e);
}

// --- Utils ---
window.exportToCSV = function () {
    const header = ['日付', 'お客様名', 'カテゴリー', '商品名', '個数', '単価', '小計', '合計金額', '決済方法'];
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
    showNotification('CSVを出力しました');
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
        showNotification('データが見つかりません', 'error');
    }
}

window.deleteSale = function (id) {
    console.log('Delete sale requested:', id);
    if (confirm('削除しますか？')) {
        salesData = salesData.filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(salesData));
        updateDashboard();
        showNotification('削除しました');
    }
}

window.deleteAllData = function () {
    if (confirm('全データを削除しますか？ (LocalStorageのみ)')) {
        salesData = [];
        localStorage.removeItem(STORAGE_KEY);
        updateDashboard();
        document.getElementById('local-data-count').textContent = '0件';
        showNotification('全データを削除しました');
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
                console.log('☁️ Cloud Auto-Save Success');
                showNotification('クラウド保存完了', 'info');
            } else {
                console.error('Cloud Error:', json);
                showNotification('クラウド保存エラー: ' + (json.message || 'unknown'), 'error');
            }
        })
        .catch(e => {
            console.error('Cloud Network Error:', e);
            showNotification('クラウド保存失敗 (オフライン)', 'error');
        });
};

window.importToGoogleSheets = function () {
    if (!salesData.length) { showNotification('データがありません', 'error'); return; }
    if (!confirm(`Localの${salesData.length}件をGoogleSheetsに一括送信しますか？`)) return;

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
        showNotification('送信リクエスト完了 (非同期)');
    }).catch(e => {
        showNotification('送信エラー: ' + e, 'error');
    });
};

window.clearCloudData = function () {
    if (!confirm('【重要】\nGoogle Sheets上の全データを削除します。\n本当によろしいですか？')) return;

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
            showNotification('送信完了: クラウドデータ削除リクエスト', 'success');
        }, 1000);
    }).catch(e => {
        showNotification('通信エラー: ' + e, 'error');
    });
};

window.testGASConnection = function () {
    fetch(GAS_URL + '?action=test')
        .then(res => res.json())
        .then(data => {
            alert('接続成功: ' + JSON.stringify(data));
        })
        .catch(e => alert('接続失敗: ' + e));
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
    if (!confirm('【警告】\nGoogle Sheetsのデータでアプリ内のデータを上書きします。\nアプリ内で編集中の未保存データは失われます。\nよろしいですか？')) return;

    showNotification('データを取得中...', 'info');

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
            let cleanDate = d.date || '';

            // [罠1] 日付が「空欄」の場合、データ作成日時(createdAt)を代用する
            if (!cleanDate || cleanDate === '') {
                // Parse createdAt strictly and add +9 Hours safely
                let cDateObj = new Date(d.createdAt);
                if (!isNaN(cDateObj.getTime())) {
                    // Force JST by taking UTC and adding 9 hours
                    cDateObj.setTime(cDateObj.getTime() + (9 * 60 * 60 * 1000));
                    cleanDate = `${cDateObj.getUTCFullYear()}-${String(cDateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(cDateObj.getUTCDate()).padStart(2, '0')}`;
                } else {
                    cleanDate = d.createdAt || '';
                }
            }

            // [罠2] タイムゾーンのズレ防止 & どんな書式でも完璧に読み込む最強ロジック
            if (cleanDate) {
                // すでに綺麗な YYYY-MM-DD になっていない場合のみ処理
                if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {

                    // パターンA: GAS特有の英語フォーマット（例: Tue Feb 03 2026 00:00:00 GM）
                    const dateMatch = cleanDate.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/);

                    if (dateMatch) {
                        const monthStr = dateMatch[1];
                        const day = String(parseInt(dateMatch[2])).padStart(2, '0');
                        const y = dateMatch[3];

                        const months = {
                            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                        };
                        const m = months[monthStr];
                        cleanDate = `${y}-${m}-${day}`;
                    } else {
                        // パターンB: 日本語のいろんな「手入力」フォーマット（「2026/2/3」や「2月3日」）を力技で抽出
                        const jpMatch = cleanDate.match(/(?:(\d{4})[年\/\-])?\s*(\d{1,2})[月\/\-]\s*(\d{1,2})[日\s]*/);
                        if (jpMatch) {
                            const nowYear = new Date().getFullYear();
                            const y = jpMatch[1] ? parseInt(jpMatch[1]) : nowYear;
                            // 26年などの下2桁入力対策
                            const finalY = y < 100 ? y + 2000 : y;
                            const m = String(parseInt(jpMatch[2])).padStart(2, '0');
                            const day = String(parseInt(jpMatch[3])).padStart(2, '0');
                            cleanDate = `${finalY}-${m}-${day}`;
                        } else {
                            // パターンC: 最終手段としてのJavascript標準パース
                            const dt = new Date(cleanDate.replace(' GM', '').trim());
                            if (!isNaN(dt.getTime())) {
                                const y = dt.getFullYear();
                                const m = String(dt.getMonth() + 1).padStart(2, '0');
                                const day = String(dt.getDate()).padStart(2, '0');

                                // "2/3"などで2001年になってしまう現象を防ぐ
                                if (y < 2000) {
                                    cleanDate = `${new Date().getFullYear()}-${m}-${day}`;
                                } else {
                                    cleanDate = `${y}-${m}-${day}`;
                                }
                            } else {
                                // 万策尽きたら今日の日付にする（真っ白になるのを防ぐため）
                                const now = new Date();
                                cleanDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                            }
                        }
                    }
                }
            } else {
                // cleanDate自体が空の場合（フォールバックも無かった場合）
                const now = new Date();
                cleanDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }

            // 万が一未来の日付（今から1年後など）が入ってしまったら現在日付にするガード
            const maxAllowedDate = new Date();
            maxAllowedDate.setFullYear(maxAllowedDate.getFullYear() + 1);
            if (new Date(cleanDate) > maxAllowedDate) {
                const now = new Date();
                cleanDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }

            // items配列が存在しない・壊れている場合のガードフォールバック
            let items = d.items;
            if (!items && d.products) items = d.products; // 古い形式との互換
            if (!Array.isArray(items)) items = [];

            return {
                ...d,
                date: cleanDate,
                items: items,
                totalAmount: Number(d.totalAmount) || 0
            };
        });

        // ⭐ 日付の降順(新しい順)に確実にならべかえる
        salesData.sort((a, b) => new Date(b.date) - new Date(a.date));

        localStorage.setItem(STORAGE_KEY, JSON.stringify(salesData));

        // UI用カウント更新
        document.getElementById('local-data-count').textContent = `${salesData.length}件`;
        updateYearSelector();

        // --- 【自動切り替え】データ内の全期間に合わせて表示を更新 ---
        if (salesData.length > 0) {
            let maxDateStr = salesData[0].date;
            let minDateStr = salesData[0].date;
            for (let i = 1; i < salesData.length; i++) {
                if (salesData[i].date > maxDateStr) maxDateStr = salesData[i].date;
                if (salesData[i].date && salesData[i].date < minDateStr) minDateStr = salesData[i].date;
            }
            if (maxDateStr && minDateStr) {
                const maxParts = maxDateStr.split('-');
                const minParts = minDateStr.split('-');

                if (maxParts.length >= 2 && minParts.length >= 2) {
                    const maxMonthStr = `${maxParts[0]}-${maxParts[1]}`;
                    const minMonthStr = `${minParts[0]}-${minParts[1]}`;

                    // 売上一覧の期間を全データをカバーするようにセット
                    currentFilter = { start: null, end: null, periodName: 'all-time' };
                    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
                    document.getElementById('current-period-display').innerText = `現在の表示: 全期間`;
                    document.getElementById('list-period-start').value = '';
                    document.getElementById('list-period-end').value = '';

                    // ダッシュボードの対象月を全データ期間に合わせる
                    document.getElementById('dashboard-start-period').value = minMonthStr;
                    document.getElementById('dashboard-end-period').value = maxMonthStr;
                    document.getElementById('dashboard-period-display').innerText = `${minMonthStr} 〜 ${maxMonthStr}`;

                    // 保存状態も上書きしておく
                    localStorage.setItem('lastDashboardStart', minMonthStr);
                    localStorage.setItem('lastDashboardEnd', maxMonthStr);
                    localStorage.setItem('lastListFilter', JSON.stringify(currentFilter));
                }
            }
        }

        // 全体のUIを更新する関数を最後に1回だけ呼ぶ（この中で renderSalesList, renderCharts, renderDashboardKPIS が走る）
        updateDashboard();

        showNotification(`復元完了: ${salesData.length}件のデータをロードしました`);

    } catch (e) {
        console.error('Download Error:', e);
        showNotification('データの取得に失敗しました。GASコード(CORS対応)を確認してください。', 'error');
    }
}
