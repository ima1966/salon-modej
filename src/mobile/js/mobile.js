/**
 * Mobile Dashboard Logic - Finance/Dark Theme v2.0
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzLoCb-t98eSzRm8LjUE_5jneYEyN8vF8NBV_qo6uXZ9adJRkiu1ia1DMkfL8gusvxl/exec';

let salesData = [];
let trendChart = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    const indicator = document.getElementById('connection-status');

    try {
        const res = await fetch(GAS_URL + '?action=load');
        if (!res.ok) throw new Error('Network response was not ok');

        const json = await res.json();

        if (json.status === 'success' || Array.isArray(json.data) || Array.isArray(json)) {
            salesData = json.data || json; // Handle both formats

            // Normalize
            salesData = salesData.map(d => ({
                ...d,
                items: typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []),
                totalAmount: Number(d.totalAmount) || 0
            }));

            renderDashboard();
            indicator.classList.add('online');

        } else {
            throw new Error('Invalid data format');
        }

    } catch (e) {
        console.error(e);
        indicator.classList.remove('online');
    }
}

function renderDashboard() {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // Timezone safe(r) date strings
    const todayStr = formatDateISO(now);
    const yesterdayDate = new Date(now); yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = formatDateISO(yesterdayDate);

    // Filter
    const thisMonthData = salesData.filter(s => s.date.startsWith(currentMonthStr));
    const prevMonthData = salesData.filter(s => s.date.startsWith(prevMonthStr));
    const todayData = salesData.filter(s => s.date === todayStr);
    const yesterdayData = salesData.filter(s => s.date === yesterdayStr);

    // Calcs
    const sum = (arr) => arr.reduce((a, c) => a + c.totalAmount, 0);

    const monthSales = sum(thisMonthData);
    const prevMonthSales = sum(prevMonthData);
    const todaySales = sum(todayData);
    const yesterdaySales = sum(yesterdayData);

    // 1. Ticker Updates (With Flash Effect TODO)
    updateValue('month-sales', monthSales);
    updateValue('today-sales', todaySales);
    document.getElementById('today-count').textContent = todayData.length + '件';
    updateValue('yesterday-sales', yesterdaySales);

    // Diff Calculation
    const diffEl = document.getElementById('month-diff');
    if (prevMonthSales > 0) {
        const diff = monthSales - prevMonthSales;
        const pct = ((diff / prevMonthSales) * 100).toFixed(2);
        const sign = diff >= 0 ? '+' : '';

        diffEl.textContent = `${sign}${pct}%`;
        diffEl.className = 'board-diff ' + (diff >= 0 ? 'text-up' : 'text-down');
    } else {
        diffEl.textContent = '-';
        diffEl.className = 'board-diff';
    }

    // 2. Manager Stats
    let managerTotal = 0;
    thisMonthData.forEach(sale => {
        sale.items.forEach(item => {
            if (item.isManager) {
                managerTotal += (item.subtotal || 0);
            }
        });
    });
    updateValue('manager-month-sales', managerTotal);

    const target = 500000;
    const progress = Math.min((managerTotal / target) * 100, 100);
    document.getElementById('manager-progress').style.width = `${progress}%`;
    document.getElementById('manager-pct').textContent = progress.toFixed(1) + '%';


    // 3. Trends Chart (Custom Dark Theme settings)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyLabels = [];
    const dailyData = new Array(daysInMonth).fill(0);
    for (let i = 1; i <= daysInMonth; i++) dailyLabels.push(i); // Just numbers for mobile

    thisMonthData.forEach(s => {
        const d = new Date(s.date);
        dailyData[d.getDate() - 1] += s.totalAmount;
    });

    renderChart(dailyLabels, dailyData);


    // 4. Rankings (Market Board)
    const productStats = {};
    thisMonthData.forEach(s => {
        s.items.forEach(i => {
            const k = i.productName;
            if (!productStats[k]) productStats[k] = { name: k, sales: 0, cat: i.category, count: 0 };
            productStats[k].sales += (i.subtotal || 0);
            productStats[k].count += (i.quantity || 0);
        });
    });

    const sorted = Object.values(productStats).sort((a, b) => b.sales - a.sales).slice(0, 10);
    const rankContainer = document.getElementById('mobile-ranking-list');

    let rankHtml = '';
    sorted.forEach((item, idx) => {
        const colorClass = idx < 3 ? 'text-up' : '';
        rankHtml += `
            <div class="market-row">
                <div class="row-name">
                    ${item.name}
                    <span class="row-sub">${item.cat}</span>
                </div>
                <div class="row-price ${colorClass}">¥${item.sales.toLocaleString()}</div>
                <div class="row-change">${item.count}</div>
            </div>
        `;
    });
    rankContainer.innerHTML = rankHtml || '<div style="padding:15px; text-align:center; color:#555;">No Data</div>';

    // 5. History List (New)
    const historyContainer = document.getElementById('history-list');
    // Show last 20 transactions from all data
    const history = salesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
    let histHtml = '';
    history.forEach(h => {
        const timeStr = h.createdAt ? new Date(h.createdAt).toLocaleDateString() : h.date;
        histHtml += `
            <div class="history-item">
                <div>
                    <div>${h.customerName}</div>
                    <div class="history-date">${timeStr}</div>
                </div>
                <div style="font-weight:bold;">¥${h.totalAmount.toLocaleString()}</div>
            </div>
        `;
    });
    historyContainer.innerHTML = histHtml;
}

function updateValue(id, newValue) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '¥' + newValue.toLocaleString();
    // Add flash logic here if needed comparing to old value
}

function renderChart(labels, data) {
    const ctx = document.getElementById('mobileTrendChart').getContext('2d');

    if (trendChart) trendChart.destroy();

    // Create a gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(33, 150, 243, 0.5)');
    gradient.addColorStop(1, 'rgba(33, 150, 243, 0.0)');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales',
                data: data,
                borderColor: '#2196f3',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0, // Clean line like stock chart
                pointHoverRadius: 4,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#333',
                    titleColor: '#aaa',
                    bodyColor: '#fff',
                    borderColor: '#555',
                    borderWidth: 1
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { display: false } // Minimalist
                },
                x: {
                    grid: { color: 'transparent' },
                    ticks: {
                        color: '#666',
                        font: { size: 10 },
                        maxTicksLimit: 8
                    }
                }
            }
        }
    });
}

function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
