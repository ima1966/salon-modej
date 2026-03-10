// Inventory Management App Logic

document.addEventListener('DOMContentLoaded', () => {
    console.log('Inventory App Initialized');

    // CONFIG: Google Apps Script URL
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwL77JTuO4xydRdVgHV1AHfLPTqV68oFjvqnUHAN_wmeRsZtl1RPgL8U55_DLoOTkhx/exec';


    // UI Elements
    const searchInput = document.getElementById('searchInput');
    const fabButton = document.getElementById('fabAddStock');
    const navItems = document.querySelectorAll('.nav-item');

    // --- State ---
    let inventoryData = [];
    let currentEditItem = null;
    let currentViewMode = 'grid'; // 'grid' or 'table'

    // --- Initial Load ---
    loadInventory();

    // --- Event Listeners ---

    // FAB Button (Open Registration Modal)
    if (fabButton) {
        fabButton.addEventListener('click', () => {
            openRegisterModal();
        });
    }

    // Navigation Handling
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            const target = e.target.closest('.nav-item');
            if (target) target.classList.add('active');

            // Reload logic if "List" or "Home" clicked
            if (target && target.dataset.target === 'home') {
                loadInventory();
            }
        });
    });

    // Search Logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            applyFilters();
        });
    }

    // Manufacturer Filter Logic
    const filterBtns = document.querySelectorAll('.filter-btn');
    // Load from local storage or default to 'all'
    let currentManuFilter = localStorage.getItem('inv_manu') || 'all';

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Set filter
            currentManuFilter = btn.dataset.manu;
            localStorage.setItem('inv_manu', currentManuFilter); // Save state

            // Reset Sub Filter (User explicitly changed manufacturer, so reset category)
            currentCategoryFilter = 'all';
            localStorage.setItem('inv_cat', 'all'); // Save state

            updateCategoryButtons(currentManuFilter);

            applyFilters();
        });
    });

    // Sub Category Filter Logic (Dynamic Generation)
    const categoryFilterContainer = document.getElementById('categoryFilterContainer');

    function updateCategoryButtons(manufacturer) {
        if (!categoryFilterContainer) return;

        // Clear existing
        categoryFilterContainer.innerHTML = '';

        const targetManus = ['若よもぎ蒸し', 'ベルマン', 'クレンシア', '水素協会', 'ビューティーガレージ', 'BIDEN'];

        // Hide if 'all' or not in target list (if desired)
        if (manufacturer === 'all' || manufacturer === 'その他' || !targetManus.includes(manufacturer)) {
            categoryFilterContainer.classList.add('hidden');
            return;
        }

        categoryFilterContainer.classList.remove('hidden');

        // Get unique categories for this manufacturer
        const manuItems = inventoryData.filter(item => item.manufacturer === manufacturer);
        const categories = [...new Set(manuItems.map(item => item.category || '未分類'))].filter(c => c).sort();

        if (categories.length === 0) {
            categoryFilterContainer.classList.add('hidden');
            return;
        }


        // Create "All" button
        const allBtn = document.createElement('button');
        allBtn.className = `sub-filter-btn ${currentCategoryFilter === 'all' ? 'active' : ''}`;
        allBtn.textContent = '全て';
        allBtn.onclick = () => {
            document.querySelectorAll('.sub-filter-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            currentCategoryFilter = 'all';
            localStorage.setItem('inv_cat', 'all'); // Save state
            applyFilters();
        };
        categoryFilterContainer.appendChild(allBtn);

        // Create Category Buttons
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `sub-filter-btn ${currentCategoryFilter === cat ? 'active' : ''}`;
            btn.textContent = cat;
            btn.onclick = () => {
                document.querySelectorAll('.sub-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategoryFilter = cat;
                localStorage.setItem('inv_cat', cat); // Save state
                applyFilters();
            };
            categoryFilterContainer.appendChild(btn);
        });
    }

    // View Toggle Logic
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        // Init active state based on storage
        if (btn.dataset.view === currentViewMode) {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentViewMode = btn.dataset.view;
            localStorage.setItem('inv_view', currentViewMode); // Save state
            applyFilters(); // Re-render with new view
        });
    });

    function applyFilters() {
        // Guard against null searchInput if something is wrong
        const term = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = inventoryData.filter(item => {
            // 1. Search Term Check
            const matchesSearch =
                (item.name && item.name.toLowerCase().includes(term)) ||
                (item.id && String(item.id).toLowerCase().includes(term)) ||
                (item.category && item.category.toLowerCase().includes(term));

            if (!matchesSearch) return false;

            // 2. Manufacturer Check
            const itemManu = item.manufacturer || 'その他';
            let manuMatch = false;

            if (currentManuFilter === 'all') {
                manuMatch = true;
                // If 'all' manufacturers, we usually don't filter by sub-category
                // because categories might clash or be too many, but logic permits it if UI allowed.
            } else if (currentManuFilter === 'その他') {
                const mainManus = ['若よもぎ蒸し', 'ベルマン', 'クレンシア', '水素協会', 'ビューティーガレージ', 'BIDEN'];
                manuMatch = !mainManus.includes(itemManu);
            } else {
                manuMatch = itemManu === currentManuFilter;
            }

            if (!manuMatch) return false;

            // 3. Category Check (Sub filter)
            if (currentCategoryFilter !== 'all') {
                if ((item.category || '未分類') !== currentCategoryFilter) return false;
            }

            return true;
        });

        renderInventoryList(filtered);
    }

    // --- Modal Logic : Registration ---
    const registerModal = document.getElementById('registerModal');
    const closeRegisterBtn = document.getElementById('closeRegisterModal');
    const registerForm = document.getElementById('registerForm');
    const btnRegisterSubmit = document.getElementById('btnRegisterSubmit');

    // Duplicate Modal Elements
    const dupModal = document.getElementById('duplicateConfirmModal');
    const btnMergeStock = document.getElementById('btnMergeStock');
    const btnRegisterAnyway = document.getElementById('btnRegisterAnyway');
    const btnCancelDup = document.getElementById('btnCancelDup');
    let pendingRegisterPayload = null; // Store payload for later use
    let pendingUpdatePayload = null;   // Store payload for update
    let detectedDuplicateItem = null;  // Store found existing item
    let duplicateCheckMode = 'register'; // 'register' or 'update'
    // Load from local storage or default to 'all'
    let currentCategoryFilter = localStorage.getItem('inv_cat') || 'all';

    function openRegisterModal(isNew = false) {
        if (registerModal) registerModal.classList.remove('hidden');

        // Only reset default values if this is a fresh open
        if (isNew) {
            // Set Default Date to Today
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('regDate');
            if (dateInput) {
                dateInput.value = today;
            }

            // Default Quantity to 0
            const qtyInput = document.getElementById('regQuantity');
            if (qtyInput) qtyInput.value = '0';
        }

        // Disable FAB completely to prevent any interaction
        const fab = document.getElementById('fabAddStock');
        if (fab) fab.style.visibility = 'hidden';
    }

    const fabAddStock = document.getElementById('fabAddStock');
    if (fabAddStock) {
        fabAddStock.addEventListener('click', () => {
            // Reset Form for clean new entry
            if (registerForm) registerForm.reset();

            // Open Modal (New)
            openRegisterModal(true);
        });
    }

    const btnSnapshot = document.getElementById('btnSnapshot');
    const snapshotModal = document.getElementById('snapshotModal');
    const btnConfirmSnapshot = document.getElementById('btnConfirmSnapshot');
    const btnCancelSnapshot = document.getElementById('btnCancelSnapshot');
    const snapshotDateInput = document.getElementById('snapshotDate');

    if (btnSnapshot && snapshotModal) {
        // Open Modal
        btnSnapshot.addEventListener('click', () => {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            snapshotDateInput.value = today;
            snapshotModal.classList.remove('hidden');
        });

        // Cancel
        if (btnCancelSnapshot) {
            btnCancelSnapshot.addEventListener('click', () => {
                snapshotModal.classList.add('hidden');
            });
        }

        // Confirm
        if (btnConfirmSnapshot) {
            btnConfirmSnapshot.addEventListener('click', () => {
                const dateVal = snapshotDateInput.value;
                if (!dateVal) {
                    alert('日付を選択してください');
                    return;
                }

                btnConfirmSnapshot.disabled = true;
                btnConfirmSnapshot.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

                sendToGAS({
                    action: 'saveSnapshot',
                    yearMonth: dateVal
                }, () => {
                    alert('棚卸データを保存しました！\n(Google Sheetsの「棚卸履歴」を確認してください)');
                    snapshotModal.classList.add('hidden');
                    btnConfirmSnapshot.disabled = false;
                    btnConfirmSnapshot.innerHTML = 'この日付で保存する';
                }, () => {
                    btnConfirmSnapshot.disabled = false;
                    btnConfirmSnapshot.innerHTML = 'この日付で保存する'; // Reset on fail
                });
            });
        }
    }

    if (closeRegisterBtn) {
        closeRegisterBtn.addEventListener('click', () => {
            if (registerModal) registerModal.classList.add('hidden');
            const fab = document.getElementById('fabAddStock');
            if (fab) fab.style.visibility = 'visible';
        });
    }

    if (registerModal) {
        // Prevent clicks inside the modal content from bubbling up (Safety)
        const content = registerModal.querySelector('.modal-content');
        if (content) {
            content.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // REMOVED: "Click outside to close" logic
        // This was causing accidental closes during text selection dragging.
        // Users must now use the 'X' or 'Cancel' button to close.
    }

    // Registration Form Submit
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleRegisterSubmit();
        });
    }

    function handleRegisterSubmit() {
        // Collect Data
        const manuf = document.getElementById('regManufacturer').value.trim();
        const cat = document.getElementById('regCategory').value.trim();

        // Combine 4 Name Fields
        const nameParts = [
            document.getElementById('regName1').value.trim(),
            document.getElementById('regName2').value.trim(),
            document.getElementById('regName3').value.trim(),
            document.getElementById('regName4').value.trim()
        ];
        // Join with space, filter out empty strings
        const name = nameParts.filter(part => part !== '').join(' ');

        const model = document.getElementById('regModel').value.trim();
        let quantity = document.getElementById('regQuantity').value.trim();
        const price = document.getElementById('regPrice').value.trim();
        const date = document.getElementById('regDate').value;
        const btnRegisterSubmit = document.getElementById('btnRegisterSubmit');

        // Default Quantity to 0 if empty
        if (quantity === '') {
            quantity = '0';
        }

        // Validation (Allow quantity 0)
        if (!manuf || !cat || !name || !price || !date) {
            alert('「型番」と「数量」以外の項目は必須です（商品名はいずれか1つ以上）。\n数量は未入力の場合「0」として登録されます。');
            return;
        }

        const payload = {
            action: 'registerItem',
            item: {
                manufacturer: manuf,
                category: cat,
                name: name,
                model: model,
                quantity: quantity,
                price: price,
                arrivalDate: date
            }
        };

        // --- DUPLICATE CHECK ---
        const duplicate = checkDuplicate(payload.item);
        if (duplicate) {
            // Show Duplicate Modal
            duplicateCheckMode = 'register';
            detectedDuplicateItem = duplicate;
            pendingRegisterPayload = payload; // Save for later

            document.getElementById('dupItemName').innerText = duplicate.name;
            document.getElementById('dupCurrentStock').innerText = duplicate.stock;
            document.getElementById('dupNewStock').innerText = quantity;

            // Text Update
            btnMergeStock.innerText = '統合して在庫を追加する';

            if (dupModal) dupModal.classList.remove('hidden');
            return; // Stop here, wait for user choice
        }

        // If no duplicate, proceed normally
        executeRegister(payload, btnRegisterSubmit);
    }

    // Actual Registration Function
    function executeRegister(payload, btn) {
        // Disable Button
        if (btn) {
            btn.innerText = '送信中...';
            btn.disabled = true;
            btn.classList.add('btn-disabled');
        }

        sendToGAS(payload, () => {
            alert('登録完了しました！');
            document.getElementById('registerForm').reset();
            // Reset Date to Today
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('regDate');
            if (dateInput) dateInput.value = today;

            if (registerModal) registerModal.classList.add('hidden');

            // Restore FAB visibility
            const fab = document.getElementById('fabAddStock');
            if (fab) fab.style.visibility = 'visible';

            setTimeout(loadInventory, 1000);
        }, () => {
            if (btn) {
                btn.innerText = '登録する';
                btn.disabled = false;
                btn.classList.remove('btn-disabled');
            }
        });
    }

    // Check for duplicate functionality
    function checkDuplicate(newItem, excludeId = null) {
        // Check by Name ONLY (Model duplications are allowed for variants)
        return inventoryData.find(existing => {
            if (excludeId && String(existing.id) === String(excludeId)) return false; // Skip self
            return existing.name === newItem.name;
        });
    }

    // --- Duplicate Modal Events ---
    if (btnMergeStock) {
        btnMergeStock.addEventListener('click', (e) => {
            e.preventDefault();
            if (!detectedDuplicateItem) return;

            if (duplicateCheckMode === 'register') {
                // --- REGISTER MODE MERGE ---
                if (!pendingRegisterPayload) return;

                // Prepare Merge Payload (Update Item Details with new stock)
                const currentStock = Number(detectedDuplicateItem.stock) || 0;
                const newQty = Number(pendingRegisterPayload.item.quantity) || 0;
                const totalStock = currentStock + newQty;

                const mergePayload = {
                    action: 'updateItemDetails',
                    item: {
                        id: detectedDuplicateItem.id, // Use Existing ID
                        manufacturer: detectedDuplicateItem.manufacturer,
                        category: detectedDuplicateItem.category,
                        name: detectedDuplicateItem.name,
                        model: detectedDuplicateItem.model,
                        price: detectedDuplicateItem.price,
                        stock: totalStock // UPDATED STOCK
                    }
                };

                const btn = btnMergeStock;
                btn.innerText = '統合中...';
                btn.disabled = true;

                sendToGAS(mergePayload, () => {
                    alert('在庫を統合しました！\n(合計: ' + totalStock + '個)');
                    if (dupModal) dupModal.classList.add('hidden');
                    if (registerModal) registerModal.classList.add('hidden');
                    document.getElementById('registerForm').reset();
                    loadInventory();

                    // Restore FAB visibility
                    const fab = document.getElementById('fabAddStock');
                    if (fab) fab.style.visibility = 'visible';

                    btn.innerText = '統合して在庫を追加する';
                    btn.disabled = false;
                }, () => {
                    btn.innerText = '統合して在庫を追加する';
                    btn.disabled = false;
                });

            } else if (duplicateCheckMode === 'update') {
                // --- UPDATE MODE MERGE (Complicated!) ---
                // Scenario: User edited Item A to look like Item B.
                // Action: Add Item A's stock to Item B, then DELETE Item A.

                if (!currentEditItem) return;

                // Confirm dangerous action
                if (!confirm(`既存の商品「${detectedDuplicateItem.name}」が見つかりました。\n\n現在編集中の商品を削除し、その在庫を既存商品に統合しますか？\n(編集中の商品は消えます)`)) {
                    return;
                }

                // Calculate stock
                const targetStock = Number(detectedDuplicateItem.stock) || 0;
                // The stock value in input might have been changed by user
                const sourceStock = Number(document.getElementById('editStockInput').value) || 0;

                const totalStock = targetStock + sourceStock;

                // 1. Update Target Item
                const updateTargetPayload = {
                    action: 'updateItemDetails',
                    item: {
                        id: detectedDuplicateItem.id,
                        manufacturer: detectedDuplicateItem.manufacturer,
                        category: detectedDuplicateItem.category,
                        name: detectedDuplicateItem.name,
                        model: detectedDuplicateItem.model,
                        price: detectedDuplicateItem.price,
                        stock: totalStock
                    }
                };

                // 2. Delete Source Item
                const deleteSourcePayload = {
                    action: 'deleteItem',
                    itemId: currentEditItem.id
                };

                const btn = btnMergeStock;
                btn.innerText = '統合中...';
                btn.disabled = true;

                // Exec 1: Update Target
                sendToGAS(updateTargetPayload, () => {
                    // Exec 2: Delete Source
                    sendToGAS(deleteSourcePayload, () => {
                        alert('商品を統合しました！\n(編集中の商品は削除され、在庫が既存商品に追加されました)');
                        if (dupModal) dupModal.classList.add('hidden');
                        if (editModal) editModal.classList.add('hidden');
                        loadInventory();

                        btn.innerText = '統合して在庫を追加する';
                        btn.disabled = false;
                    });
                }, () => {
                    btn.innerText = '統合して在庫を追加する';
                    btn.disabled = false;
                    alert('統合処理に失敗しました');
                });
            }
        });
    }

    if (btnRegisterAnyway) {
        btnRegisterAnyway.addEventListener('click', (e) => {
            e.preventDefault();

            if (duplicateCheckMode === 'register') {
                if (!pendingRegisterPayload) return;
                const btn = document.getElementById('btnRegisterSubmit');
                if (dupModal) dupModal.classList.add('hidden');
                executeRegister(pendingRegisterPayload, btn);

            } else if (duplicateCheckMode === 'update') {
                // Just proceed with update as normal (allow duplicate)
                if (!pendingUpdatePayload) return;
                const btn = document.getElementById('btnUpdateItem');

                if (dupModal) dupModal.classList.add('hidden');
                executeUpdate(pendingUpdatePayload, btn);
            }
        });
    }

    if (btnCancelDup) {
        btnCancelDup.addEventListener('click', (e) => {
            e.preventDefault();
            if (dupModal) dupModal.classList.add('hidden');
            pendingRegisterPayload = null;
            detectedDuplicateItem = null;
        });
    }

    // --- Loading Logic ---
    function loadInventory() {
        const container = document.getElementById('inventoryList');
        // Ensure container exists
        if (!container) return;

        const loadingState = container.querySelector('.loading-state');
        if (loadingState) loadingState.style.display = 'block';

        fetch(GAS_URL + '?action=getInventory')
            .then(res => {
                if (!res.ok) {
                    throw new Error('Network response was not ok ' + res.statusText);
                }
                return res.json();
            })
            .then(data => {
                console.log("Loaded Data: ", data);
                inventoryData = data; // Store state

                // Restore UI State based on LocalStorage
                restoreUIState();

                // Instead of rendering all, apply current filters
                // This keeps the user on the same screen (e.g. "Hydrogen Association")
                applyFilters();
            })
            .catch(err => {
                console.error("Fetch Error:", err);
                const loadingState = container.querySelector('.loading-state');
                if (loadingState) loadingState.style.display = 'none';

                // Show Error directly in container or alert
                alert("在庫データの読み込みに失敗しました。\n" + err.message);
            });
    }

    function restoreUIState() {
        // 1. Restore Manufacturer Button
        const filterBtns = document.querySelectorAll('.filter-btn');
        let manuFound = false;

        filterBtns.forEach(b => {
            if (b.dataset.manu === currentManuFilter) {
                b.classList.add('active');
                manuFound = true;
            } else {
                b.classList.remove('active');
            }
        });

        // If currentManuFilter is invalid or 'all', ensure 'all' button is active
        if (!manuFound && currentManuFilter === 'all') {
            const allBtn = document.querySelector('.filter-btn[data-manu="all"]');
            if (allBtn) allBtn.classList.add('active');
        }

        // 2. Restore Sub Category Buttons
        // If a manufacturer is selected, regenerate sub-buttons
        if (currentManuFilter !== 'all') {
            updateCategoryButtons(currentManuFilter);
        } else {
            const categoryFilterContainer = document.getElementById('categoryFilterContainer');
            if (categoryFilterContainer) {
                categoryFilterContainer.innerHTML = '';
                categoryFilterContainer.classList.add('hidden');
            }
        }
    }

    function renderInventoryList(items) {
        const container = document.getElementById('inventoryList');
        if (!container) return;

        // Remove existing manufacturer sections but keep states
        const sections = container.querySelectorAll('.manufacturer-section');
        sections.forEach(s => s.remove());

        // Remove existing table containers if any
        const tables = container.querySelectorAll('.inventory-table-container');
        tables.forEach(t => t.remove());

        const loadingState = container.querySelector('.loading-state');
        if (loadingState) loadingState.style.display = 'none';

        if (!items || items.length === 0) {
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        } else {
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.classList.add('hidden');
        }

        // Group by Manufacturer
        const grouped = items.reduce((acc, item) => {
            const manu = item.manufacturer || 'その他';
            if (!acc[manu]) acc[manu] = [];
            acc[manu].push(item);
            return acc;
        }, {});

        // Sort Manufacturers
        const manuOrder = ['若よもぎ蒸し', 'ベルマン', 'クレンシア', '水素協会', 'ビューティーガレージ', 'BIDEN', 'その他'];
        const sortedManus = Object.keys(grouped).sort((a, b) => {
            let indexA = manuOrder.indexOf(a);
            let indexB = manuOrder.indexOf(b);
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;
            return indexA - indexB;
        });

        // Render based on View Mode
        sortedManus.forEach(manu => {
            const manuSection = document.createElement('div');
            manuSection.className = 'manufacturer-section';
            manuSection.dataset.manu = manu;

            // Header (Title)
            const title = document.createElement('h3');
            title.className = 'manufacturer-title';
            title.innerHTML = `<i class="fa-solid fa-building"></i> ${manu}`;
            manuSection.appendChild(title);

            // Content
            if (currentViewMode === 'table') {
                // --- TABLE VIEW ---
                const tableContainer = document.createElement('div');
                tableContainer.className = 'inventory-table-container';

                const table = document.createElement('table');
                table.className = 'inventory-table';

                // Table Header
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>商品名 / 型番</th>
                            <th>在庫数</th>
                            <th>定価(税込)</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;

                const tbody = table.querySelector('tbody');

                grouped[manu].forEach(item => {
                    const tr = document.createElement('tr');
                    tr.onclick = () => openEditModal(item);

                    const currentStock = Number(item.stock) || 0;
                    let badgeClass = 'stock-badge';
                    if (currentStock <= 3) badgeClass += ' low';
                    else badgeClass += ' good';

                    // Price is already Tax Included (Input as Tax Inc)
                    const priceVal = Number(item.price) || 0;
                    const priceStr = priceVal.toLocaleString();

                    tr.innerHTML = `
                        <td>
                            <div class="name-cell">${item.name}</div>
                            <div style="font-size:0.8rem; color:#6b7280;">${item.model || ''}</div>
                        </td>
                        <td>
                            <span class="${badgeClass}">
                                ${currentStock} <span style="font-size:0.75rem; font-weight:normal;">個</span>
                            </span>
                        </td>
                        <td class="price-cell">¥${priceStr}</td>
                    `;
                    tbody.appendChild(tr);
                });

                tableContainer.appendChild(table);
                manuSection.appendChild(tableContainer);

            } else {
                // --- GRID/TILE VIEW ---
                const grid = document.createElement('div');
                grid.className = 'product-grid';

                grouped[manu].forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'inventory-card';
                    card.onclick = () => openEditModal(item);

                    const currentStock = Number(item.stock) || 0;
                    let stockClass = 'stock-count';
                    if (currentStock <= 3) stockClass += ' low-stock';
                    else stockClass += ' good-stock';

                    // Name splitting logic
                    const nameParts = (item.name || '').split(' ');
                    const mainName = nameParts.slice(0, 2).join(' '); // First 2 parts
                    const subName = nameParts.slice(2).join(' ');

                    // Price is already Tax Included
                    const priceVal = Number(item.price) || 0;
                    const priceStr = priceVal.toLocaleString();

                    card.innerHTML = `
                        <div class="card-left">
                            <div class="name-container">
                                <h4 class="product-name-main">${mainName || '商品名なし'}</h4>
                                <div class="product-name-sub">${subName}</div>
                            </div>
                            <span class="product-code">${item.model || ''}</span>
                            <div class="card-price"><i class="fa-solid fa-tag"></i> ¥${priceStr} <span style="font-size:0.7em; color:#666;">(税込)</span></div>
                        </div>
                        <div class="card-right">
                            <div class="${stockClass}">
                                <span class="count">${currentStock}</span>
                                <span class="unit">個</span>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
                manuSection.appendChild(grid);
            }

            container.appendChild(manuSection);
        });
    }


    // --- Edit Modal Logic ---
    const editModal = document.getElementById('editModal');
    const closeEditBtn = document.getElementById('closeEditModal');

    // Edit Elements
    const editManufSelect = document.getElementById('editManufacturer');
    const editCategoryInput = document.getElementById('editCategory');
    const editName1 = document.getElementById('editName1');
    const editName2 = document.getElementById('editName2');
    const editName3 = document.getElementById('editName3');
    const editName4 = document.getElementById('editName4');
    const editModelInput = document.getElementById('editModel');
    const editPriceInput = document.getElementById('editPrice');

    // Stock Control in Edit Modal (Direct Input)
    const editStockInput = document.getElementById('editStockInput');
    const btnEditDecrease = document.getElementById('btnDecrease');
    const btnEditIncrease = document.getElementById('btnIncrease');

    const btnUpdateItem = document.getElementById('btnUpdateItem');
    const btnDeleteItem = document.getElementById('btnDeleteItem');

    function openEditModal(item) {
        currentEditItem = item;
        if (editModal) editModal.classList.remove('hidden');

        // Populate Fields
        document.getElementById('editItemId').value = item.id || '';
        if (editManufSelect) editManufSelect.value = item.manufacturer || 'その他';
        if (editCategoryInput) editCategoryInput.value = item.category || '';

        // Split Name
        const nameParts = (item.name || '').split(' ');
        if (editName1) editName1.value = nameParts[0] || '';
        if (editName2) editName2.value = nameParts[1] || '';
        if (editName3) editName3.value = nameParts[2] || '';
        if (editName4) editName4.value = nameParts.slice(3).join(' ') || '';

        if (editModelInput) editModelInput.value = item.model || '';
        if (editPriceInput) editPriceInput.value = item.price || '';

        // Stock: Set direct input value
        const stock = Number(item.stock) || 0;
        if (editStockInput) editStockInput.value = stock;
    }

    // --- Event Delegation for Edit Modal (Robust Button Handling) ---
    if (editModal) {
        editModal.addEventListener('click', (e) => {

            // 1. Decrease Button
            if (e.target.closest('#btnDecrease')) {
                e.preventDefault();
                const input = document.getElementById('editStockInput');
                if (input) {
                    let val = Number(input.value) || 0;
                    if (val > 0) val--;
                    input.value = val;
                }
                return;
            }

            // 2. Increase Button
            if (e.target.closest('#btnIncrease')) {
                e.preventDefault();
                const input = document.getElementById('editStockInput');
                if (input) {
                    let val = Number(input.value) || 0;
                    val++;
                    input.value = val;
                }
                return;
            }

            // 3.5 Copy/Duplicate Button
            if (e.target.closest('#btnCopyItem')) {
                e.preventDefault();
                if (!currentEditItem) return;

                // Close Edit Modal
                editModal.classList.add('hidden');

                // Open Register Modal (Not New, will overwrite data)
                openRegisterModal(false);

                // Prefill Data (Delayed to avoid instant clear by browser/modal reset)
                setTimeout(() => {
                    // Manufacturer
                    const manu = document.getElementById('editManufacturer').value;
                    const regManu = document.getElementById('regManufacturer');
                    if (regManu) regManu.value = manu;

                    // Category
                    const cat = document.getElementById('editCategory').value;
                    const regCat = document.getElementById('regCategory');
                    if (regCat) regCat.value = cat;

                    // Name (4 parts)
                    const name1 = document.getElementById('editName1').value;
                    const name2 = document.getElementById('editName2').value;
                    const name3 = document.getElementById('editName3').value;
                    const name4 = document.getElementById('editName4').value; // Might be volume

                    if (document.getElementById('regName1')) document.getElementById('regName1').value = name1;
                    if (document.getElementById('regName2')) document.getElementById('regName2').value = name2;
                    if (document.getElementById('regName3')) document.getElementById('regName3').value = name3;
                    if (document.getElementById('regName4')) document.getElementById('regName4').value = name4;

                    // Price (Clear it, do not copy)
                    if (document.getElementById('regPrice')) document.getElementById('regPrice').value = '';

                    // Date (Today)
                    const today = new Date().toISOString().split('T')[0];
                    if (document.getElementById('regDate')) document.getElementById('regDate').value = today;

                    // Reset Stock to 0 (New Item)
                    if (document.getElementById('regQuantity')) document.getElementById('regQuantity').value = '0';

                    // Reset Code/Model (Should be new)
                    if (document.getElementById('regModel')) document.getElementById('regModel').value = '';
                }, 150); // Small delay

                return;
            }

            // 4. Delete Button (Inside Edit Modal)
            if (e.target.closest('#btnDeleteItem')) {
                e.preventDefault();
                if (!currentEditItem) return;
                const id = document.getElementById('editItemId').value;

                if (!confirm('【警告】本当にこの商品を削除しますか？\n（在庫データは完全に消去されます。元に戻せません）')) {
                    return;
                }

                const btn = document.getElementById('btnDeleteItem');
                if (btn) {
                    btn.innerText = '削除中...';
                    btn.disabled = true;
                }

                sendToGAS({
                    action: 'deleteItem',
                    itemId: id
                }, () => {
                    alert('商品を削除しました');
                    if (editModal) editModal.classList.add('hidden');
                    loadInventory(); // Reload list
                }, () => {
                    // Fail
                    if (btn) {
                        btn.innerText = '削除';
                        btn.disabled = false;
                    }
                });
                return;
            }

            // 3. Update Button
            if (e.target.closest('#btnUpdateItem')) {
                e.preventDefault();
                if (!currentEditItem) return;

                const btn = document.getElementById('btnUpdateItem');

                // Collect Data (Re-fetch elements to ensure latest values)
                const id = document.getElementById('editItemId').value;
                const manuf = document.getElementById('editManufacturer').value;
                const cat = document.getElementById('editCategory').value.trim();

                const name = [
                    document.getElementById('editName1').value.trim(),
                    document.getElementById('editName2').value.trim(),
                    document.getElementById('editName3').value.trim(),
                    document.getElementById('editName4').value.trim()
                ].filter(p => p !== '').join(' ');

                const model = document.getElementById('editModel').value.trim();
                const price = document.getElementById('editPrice').value.trim();
                const stock = document.getElementById('editStockInput').value;

                if (!name || !cat || !price) {
                    alert('必須項目（メーカー、カテゴリ、商品名、価格）は入力してください。');
                    return;
                }

                const itemData = {
                    id: id,
                    manufacturer: manuf,
                    category: cat,
                    name: name,
                    model: model,
                    price: price,
                    stock: stock
                };

                const payload = {
                    action: 'updateItemDetails',
                    item: itemData
                };

                // --- DUPLICATE CHECK FOR UPDATE ---
                // Check if name/model conflicts with ANOTHER item (exclude self)
                const duplicate = checkDuplicate(itemData, id);

                if (duplicate) {
                    // Show Duplicate Modal
                    duplicateCheckMode = 'update';
                    detectedDuplicateItem = duplicate;
                    pendingUpdatePayload = payload;

                    document.getElementById('dupItemName').innerText = duplicate.name;
                    document.getElementById('dupCurrentStock').innerText = duplicate.stock;
                    // For update, "New Stock" display is tricky. Just show what user entered.
                    document.getElementById('dupNewStock').innerText = stock;

                    // Change Text for clarity
                    btnMergeStock.innerText = 'この商品に統合する (現在のデータは削除)';
                    btnRegisterAnyway.innerText = '重複を無視して保存';

                    if (dupModal) dupModal.classList.remove('hidden');
                    return;
                }

                if (!confirm('変更を保存しますか？')) return;

                executeUpdate(payload, btn);
                return;
            }

            // 5. Close Logic
            if (e.target === editModal || e.target.closest('#closeEditModal')) {
                editModal.classList.add('hidden');
                currentEditItem = null;
            }
        });
    }

    // Actual Update Function
    function executeUpdate(payload, btn) {
        if (btn) {
            btn.innerText = '保存中...';
            btn.disabled = true;
        }

        sendToGAS(payload, () => {
            alert('商品情報を更新しました');
            if (editModal) editModal.classList.add('hidden');
            loadInventory();
        }, () => {
            if (btn) {
                btn.innerText = '保存する';
                btn.disabled = false;
            }
        });
    }

    // Helper for GAS fetch
    function sendToGAS(payload, onSuccess, onFinally) {
        fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(() => {
            if (onSuccess) onSuccess();
        }).catch(err => {
            console.error(err);
            alert('通信エラーが発生しました');
        }).finally(() => {
            if (onFinally) onFinally();
        });
    }

});
