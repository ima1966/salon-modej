/**
 * Inventory Management Logic
 * Connects to the same GAS backend as Sales App
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwAaTNKwE6RvKUqp2ghLXIOZcRnQxPxu6DvmR-eEsUUwCP0PPDDGflMqVsLi7cZPZmT/exec';

let inventoryList = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchInventory();
});

// --- Navigation ---
function switchTab(tabId, btn) {
    // Hide all
    document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    // Show target
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    if (btn) btn.classList.add('active');

    // Refresh data if going to list
    if (tabId === 'list') {
        fetchInventory();
    }
}

// --- API Calls ---
async function fetchInventory() {
    showLoading(true);
    try {
        const res = await fetch(GAS_URL + '?action=getInventory');
        const json = await res.json();

        inventoryList = json; // format: [{category, name, stock...}]
        renderList(inventoryList);
        updateProductSelect(); // also refresh dropdowns

    } catch (e) {
        alert('在庫データの取得に失敗しました');
        console.error(e);
    } finally {
        showLoading(false);
    }
}

async function submitStockIn() {
    const cat = document.getElementById('in-category').value;
    const name = document.getElementById('in-product').value;
    const qty = document.getElementById('in-qty').value;

    if (!cat || !name || !qty) {
        alert('全ての項目を選択してください');
        return;
    }

    if (!confirm(`【入庫確認】\n\n${name}\n数量: +${qty}個\n\n登録しますか？`)) return;

    showLoading(true);
    try {
        const payload = {
            action: 'addStock',
            item: {
                category: cat,
                name: name,
                qtyToAdd: Number(qty)
            }
        };

        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Optimistic UI update or wait
        alert('入庫を登録しました');
        // Reset form
        document.getElementById('in-qty').value = 1;
        fetchInventory(); // Refresh

    } catch (e) {
        alert('送信エラー');
    } finally {
        showLoading(false);
    }
}

async function submitNewProduct() {
    const cat = document.getElementById('new-category').value;
    const name = document.getElementById('new-name').value;
    const price = document.getElementById('new-price').value;
    const stock = document.getElementById('new-stock').value;

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    if (!confirm(`【新規登録】\n\nカテゴリー: ${cat}\n商品名: ${name}\n初期在庫: ${stock}個\n\n登録しますか？`)) return;

    showLoading(true);
    try {
        // Re-use addStock action but with new item logic handled by GAS or simplified here
        // Actually, GAS's addStock handles new items if they don't exist!
        const payload = {
            action: 'addStock',
            item: {
                category: cat,
                name: name,
                price: price,
                qtyToAdd: stock // Initial stock
            }
        };

        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        alert('新規商品を登録しました');
        document.getElementById('new-name').value = '';
        document.getElementById('new-price').value = '';
        document.getElementById('new-stock').value = '0';
        fetchInventory();

    } catch (e) {
        alert('登録エラー');
    } finally {
        showLoading(false);
    }
}

// --- UI Rendering ---
function renderList(list) {
    const container = document.getElementById('stock-list-container');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center;">データがありません</div>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'stock-list-item';
        div.innerHTML = `
            <div class="stock-info">
                <span class="stock-cat">${item.category}</span>
                <div class="stock-name">${item.name}</div>
            </div>
            <div class="stock-qty ${item.stock < 5 ? 'low' : ''}">${item.stock}</div>
        `;
        container.appendChild(div);
    });
}

function filterList(cat) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (cat === 'ALL') {
        renderList(inventoryList);
    } else {
        const filtered = inventoryList.filter(i => i.category.includes(cat) || i.category === cat);
        renderList(filtered);
    }
}

function updateProductSelect() {
    const cat = document.getElementById('in-category').value;
    const select = document.getElementById('in-product');
    select.innerHTML = '';

    if (!cat) {
        select.disabled = true;
        select.innerHTML = '<option>メーカーを選択してください</option>';
        return;
    }

    const products = inventoryList.filter(i => i.category === cat);
    if (products.length === 0) {
        select.disabled = true;
        select.innerHTML = '<option>商品が見つかりません</option>';
        return;
    }

    select.disabled = false;
    products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.text = p.name;
        select.appendChild(option);
    });
}

// --- Utils ---
function modQty(delta) {
    const input = document.getElementById('in-qty');
    let v = parseInt(input.value) || 0;
    v += delta;
    if (v < 1) v = 1;
    input.value = v;
}

function setQty(val) {
    document.getElementById('in-qty').value = val;
}

function showLoading(show) {
    const el = document.getElementById('loading-indicator');
    if (el) el.style.display = show ? 'block' : 'none';
}
