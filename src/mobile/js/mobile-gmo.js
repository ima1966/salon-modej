/**
 * Mobile Dashboard Logic - Clean White Theme v4.0
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwAaTNKwE6RvKUqp2ghLXIOZcRnQxPxu6DvmR-eEsUUwCP0PPDDGflMqVsLi7cZPZmT/exec';

let globalData = [];
let chartInstance = null;
let currentChartMetric = null; // 'sales', 'customers', etc.

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    try {
        const res = await fetch(GAS_URL + '?action=load');
        if (!res.ok) throw new Error('Network err');
        const json = await res.json();

        const raw = (json.status === 'success' ? json.data : json);
        // Process Data
        globalData = raw.map(d => ({
            ...d,
            items: typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []),
            totalAmount: Number(d.totalAmount) || 0,
            date: d.date && d.date.includes('T') ? d.date.split('T')[0] : d.date,
            dateObj: new Date(d.date)
        })).sort((a, b) => a.dateObj - b.dateObj); // Sort Oldest -> Newest

        renderHome();

    } catch (e) {
        console.error(e);
        alert('データを取得できませんでした。ネット接続を確認してください。');
    }
}

function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function renderHome() {
    const now = new Date();
    const todayStr = formatDateISO(now);
    const currentMonthPrefix = todayStr.substring(0, 7); // "YYYY-MM"

    // Filter Today
    const todayData = globalData.filter(d => d.date === todayStr);

    // -- Metrics Calculation --

    // 1. Sales
    const totalSales = todayData.reduce((a, c) => a + c.totalAmount, 0);

    // 2. Customers (Unique Names)
    const uniqueCustomers = new Set(todayData.map(d => d.customerName || d.customer)).size;

    // 3. Transactions (Number of records)
    const transactionCount = todayData.length;

    // 4. Avg Customer Spend (Sales / Unique Customers)
    const avgCustomer = uniqueCustomers > 0 ? Math.floor(totalSales / uniqueCustomers) : 0;

    // 5. Avg Transaction Value (Sales / Transactions)
    const avgTransaction = transactionCount > 0 ? Math.floor(totalSales / transactionCount) : 0;

    // -- Display --
    document.getElementById('val-today-sales').textContent = '¥' + totalSales.toLocaleString();
    document.getElementById('val-today-customers').textContent = uniqueCustomers + ' 名';
    document.getElementById('val-today-avg-customer').textContent = '¥' + avgCustomer.toLocaleString();
    document.getElementById('val-today-transactions').textContent = transactionCount + ' 件';
    document.getElementById('val-today-avg-transaction').textContent = '¥' + avgTransaction.toLocaleString();

    // -- Banner: Month Total & Days Left --
    const monthData = globalData.filter(d => d.date.startsWith(currentMonthPrefix));
    const monthTotal = monthData.reduce((a, c) => a + c.totalAmount, 0);

    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dayDiff = Math.ceil((lastDayOfMonth - now) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, dayDiff); // Ensure no negative

    document.getElementById('val-month-total').textContent = '¥' + monthTotal.toLocaleString();
    document.getElementById('val-month-remain-days').textContent = daysLeft;
}

// --- Navigation ---
window.switchNav = function (tab, el) {
    // Nav UI
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');

    // Tab View UI
    document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
}

// --- Chart Logic ---

window.openChart = function (metric, title) {
    currentChartMetric = metric;
    document.getElementById('chart-overlay-title').textContent = title + ' 推移';
    document.getElementById('chart-overlay').classList.add('open');

    // Default 1 Month
    const btns = document.querySelectorAll('.chart-period-btn');
    btns.forEach(b => b.classList.remove('active'));
    btns[0].classList.add('active'); // First one is 1M

    renderChart('1M');
}

window.closeChart = function () {
    document.getElementById('chart-overlay').classList.remove('open');
}

window.updateChartPeriod = function (period, el) {
    document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    renderChart(period);
}

function renderChart(period) {
    // Determine Date Range
    const now = new Date();
    let startDate = new Date(now);

    switch (period) {
        case '1M': startDate.setMonth(now.getMonth() - 1); break;
        case '3M': startDate.setMonth(now.getMonth() - 3); break;
        case '6M': startDate.setMonth(now.getMonth() - 6); break;
        case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
    }

    // Filter Data by Date >= startDate AND Date <= now
    const filtered = globalData.filter(d => d.dateObj >= startDate && d.dateObj <= now);

    // Group Data by Date (Daily Aggregate)
    const dailyMap = {};

    // Initialize day map in range? (Optional, skipping for simplicity, just key existing dates)
    // Actually charts look better if gaps are handled, but let's just plot available data points for now.

    filtered.forEach(d => {
        const k = d.date; // YYYY-MM-DD
        if (!dailyMap[k]) {
            dailyMap[k] = { sales: 0, customers: new Set(), transactions: 0 };
        }
        dailyMap[k].sales += d.totalAmount;
        dailyMap[k].customers.add(d.customerName || d.customer);
        dailyMap[k].transactions += 1;
    });

    // Convert to Chart Arrays
    const labels = Object.keys(dailyMap).sort();
    const values = labels.map(date => {
        const entry = dailyMap[date];
        switch (currentChartMetric) {
            case 'sales': return entry.sales;
            case 'customers': return entry.customers.size;
            case 'transactions': return entry.transactions;
            case 'avg-customer': return entry.customers.size ? Math.floor(entry.sales / entry.customers.size) : 0;
            case 'avg-transaction': return entry.transactions ? Math.floor(entry.sales / entry.transactions) : 0;
            default: return 0;
        }
    });

    // Draw Chart
    const ctx = document.getElementById('trendCanvas').getContext('2d');

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => l.substring(5)), // MM-DD
            datasets: [{
                label: document.getElementById('chart-overlay-title').textContent,
                data: values,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true },
                x: {
                    ticks: {
                        maxTicksLimit: 7, // Limit ticks to avoid crowding (smart scale)
                        maxRotation: 0,   // Keep labels horizontal
                        autoSkip: true
                    },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}
