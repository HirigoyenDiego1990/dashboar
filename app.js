// --- ESTADO Y VARIABLES GLOBALES ---
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentCurrency = localStorage.getItem('currentCurrency') || 'ARS';
let budgets = JSON.parse(localStorage.getItem('budgets')) || {
    "Supermercado": 0,
    "Verduleria": 0,
    "Carniceria": 0,
    "Tarjeta": 0,
    "Transporte": 0,
    "Ocio": 0,
    "Otros": 0
};
let myChart = null;

const currencySymbols = {
    USD: 'US$',
    ARS: '$',
    EUR: '€'
};

// DOM Elements
const balanceEl = document.getElementById('total-balance');
const incomeEl = document.getElementById('total-income');
const expenseEl = document.getElementById('total-expense');
const formEl = document.getElementById('transaction-form');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const typeInput = document.getElementById('type');
const categoryInput = document.getElementById('category');
const currencyInput = document.getElementById('currency');
const globalCurrencySelect = document.getElementById('global-currency');
const groupedListEl = document.getElementById('grouped-transaction-list');
const exportBtn = document.getElementById('export-excel-btn');
const budgetListEl = document.getElementById('budget-list');
const setBudgetBtn = document.getElementById('set-budget-btn');

// DOM Elements de Filtros
const periodFilterSelect = document.getElementById('period-filter');
const customDateContainer = document.getElementById('custom-date-container');
const filterStartDate = document.getElementById('filter-start-date');
const filterEndDate = document.getElementById('filter-end-date');

// Moneda Global listener
if (globalCurrencySelect) {
    globalCurrencySelect.value = currentCurrency;
    globalCurrencySelect.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        localStorage.setItem('currentCurrency', currentCurrency);
        updateUI();
    });
}

// Filtro de Período Listeners
if (periodFilterSelect) {
    periodFilterSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customDateContainer.style.display = 'flex';
        } else {
            customDateContainer.style.display = 'none';
        }
        updateUI();
    });
}

if (filterStartDate) filterStartDate.addEventListener('change', updateUI);
if (filterEndDate) filterEndDate.addEventListener('change', updateUI);

if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
}

function init() {
    initChart();
    updateUI();
}

// --- OBTENER TRANSACCIONES FILTRADAS ---
function getFilteredTransactions() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    let filtered = transactions.map(t => {
        if (!t.date) t.date = todayStr;
        if (!t.currency) t.currency = 'ARS';
        return t;
    }).filter(t => t.currency === currentCurrency);

    const period = periodFilterSelect ? periodFilterSelect.value : 'this-month';
    const now = new Date();

    if (period === 'this-month') {
        const year = now.getFullYear();
        const month = now.getMonth();
        filtered = filtered.filter(t => {
            const [tYear, tMonth] = t.date.split('-').map(Number);
            return tYear === year && (tMonth - 1) === month;
        });
    } else if (period === 'last-month') {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const year = lastMonthDate.getFullYear();
        const month = lastMonthDate.getMonth();
        filtered = filtered.filter(t => {
            const [tYear, tMonth] = t.date.split('-').map(Number);
            return tYear === year && (tMonth - 1) === month;
        });
    } else if (period === 'custom') {
        const start = filterStartDate && filterStartDate.value ? filterStartDate.value : '1970-01-01';
        const end = filterEndDate && filterEndDate.value ? filterEndDate.value : '2099-12-31';
        filtered = filtered.filter(t => t.date >= start && t.date <= end);
    }

    return filtered;
}

function updateUI() {
    const filteredTransactions = getFilteredTransactions();
    const symbol = currencySymbols[currentCurrency] || '$';

    // 1. Calcular Totales con datos filtrados
    const total = filteredTransactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    if (balanceEl) balanceEl.innerText = `${symbol}${formatNumber(total)}`;
    if (incomeEl) incomeEl.innerText = `${symbol}${formatNumber(income)}`;
    if (expenseEl) expenseEl.innerText = `${symbol}${formatNumber(expense)}`;

    // 2. Renderizar Historial Filtrado
    renderGroupedList(filteredTransactions);

    // 3. Actualizar Gráfico Filtrado
    updateChart(filteredTransactions);

    // 4. Renderizar Barras de Presupuesto
    renderBudgets(filteredTransactions);

    // 5. Guardar en localStorage
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('budgets', JSON.stringify(budgets));
}

// --- RENDERIZAR BARRAS DE PRESUPUESTO ---
function renderBudgets(filteredTransactions) {
    if (!budgetListEl) return;
    budgetListEl.innerHTML = '';

    const symbol = currencySymbols[currentCurrency] || '$';
    const categories = Object.keys(budgets);

    // Calcular gastos por categoría del período seleccionado
    const expensesByCategory = {};
    filteredTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        });

    categories.forEach(cat => {
        const limit = budgets[cat] || 0;
        const spent = expensesByCategory[cat] || 0;

        // Si no hay presupuesto asignado para esta categoría, no la renderizamos
        if (limit <= 0) return;

        const percentage = Math.min(Math.round((spent / limit) * 100), 100);
        let statusClass = 'budget-status-ok';

        if (spent > limit) {
            statusClass = 'budget-status-exceeded';
        } else if (spent >= limit * 0.8) {
            statusClass = 'budget-status-warning';
        }

        const itemEl = document.createElement('div');
        itemEl.classList.add('budget-item');
        itemEl.innerHTML = `
            <div class="budget-info">
                <span class="budget-category">${escapeHTML(cat)}</span>
                <span class="budget-amounts">${symbol}${formatNumber(spent)} / ${symbol}${formatNumber(limit)} (${percentage}%)</span>
            </div>
            <div class="budget-bar-bg">
                <div class="budget-bar-fill ${statusClass}" style="width: ${percentage}%;"></div>
            </div>
        `;
        budgetListEl.appendChild(itemEl);
    });

    if (budgetListEl.children.length === 0) {
        budgetListEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary, #94a3b8); font-size: 0.85rem;">No has configurado límites de gasto todavía.</p>';
    }
}

// --- CONFIGURAR PRESUPUESTOS (PROMPT / DIÁLOGO) ---
// --- CONFIGURAR PRESUPUESTOS CON SWEETALERT2 ---
if (setBudgetBtn) {
    setBudgetBtn.addEventListener('click', async () => {
        const categories = Object.keys(budgets);
        const symbol = currencySymbols[currentCurrency] || '$';

        // Construir el formulario dentro del modal
        let formHTML = '<div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">';
        categories.forEach(cat => {
            const currentLimit = budgets[cat] || 0;
            formHTML += `
                <div>
                    <label style="font-size: 0.85rem; color: #94a3b8; display: block; margin-bottom: 0.3rem;">
                        ${escapeHTML(cat)} (${symbol})
                    </label>
                    <input type="number" id="swal-budget-${cat}" class="swal2-input" 
                           style="width: 100%; margin: 0; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 6px;" 
                           value="${currentLimit}" min="0" step="any">
                </div>
            `;
        });
        formHTML += '</div>';

        const { value: formValues } = await Swal.fire({
            title: `Límites de Presupuesto (${currentCurrency})`,
            html: formHTML,
            background: '#1e293b',
            color: '#f8fafc',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#64748b',
            focusConfirm: false,
            preConfirm: () => {
                const newBudgets = {};
                categories.forEach(cat => {
                    const input = document.getElementById(`swal-budget-${cat}`);
                    const val = parseFloat(input.value);
                    newBudgets[cat] = !isNaN(val) && val >= 0 ? val : 0;
                });
                return newBudgets;
            }
        });

        if (formValues) {
            budgets = formValues;
            updateUI();
            
            // Toast flotante de confirmación rápida
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Presupuestos actualizados',
                showConfirmButton: false,
                timer: 2000,
                background: '#1e293b',
                color: '#f8fafc'
            });
        }
    });
}

// --- RENDERIZAR LISTA AGRUPADA POR FECHA ---
function renderGroupedList(filteredTransactions) {
    if (!groupedListEl) return;
    groupedListEl.innerHTML = '';

    if (filteredTransactions.length === 0) {
        groupedListEl.innerHTML = `<p style="text-align: center; color: var(--text-secondary, #94a3b8); padding: 1.5rem;">No hay movimientos para el período seleccionado en ${currentCurrency}.</p>`;
        return;
    }

    const sortedTransactions = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    const groups = sortedTransactions.reduce((acc, transaction) => {
        const dateKey = transaction.date;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(transaction);
        return acc;
    }, {});

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
    const symbol = currencySymbols[currentCurrency] || '$';

    sortedDates.forEach(dateStr => {
        const groupItems = groups[dateStr];
        const groupEl = document.createElement('div');
        groupEl.classList.add('date-group');

        const formattedDate = formatDateTitle(dateStr);
        const dayBalance = groupItems.reduce((acc, item) => acc + (item.type === 'income' ? item.amount : -item.amount), 0);
        const dayBalanceFormatted = `${dayBalance >= 0 ? '+' : ''}${symbol}${formatNumber(dayBalance)}`;

        groupEl.innerHTML = `
            <div class="date-header">
                <span class="date-title">${formattedDate}</span>
                <span class="date-subtotal">Balance del día: ${dayBalanceFormatted}</span>
            </div>
            <ul class="transaction-list" style="list-style:none; padding:0; margin:0.5rem 0;"></ul>
        `;

        const ulEl = groupEl.querySelector('.transaction-list');

        groupItems.forEach(t => {
            const sign = t.type === 'income' ? '+' : '-';
            const li = document.createElement('li');
            li.classList.add('transaction-item', t.type);
            
            li.innerHTML = `
                <div class="item-info">
                    <span class="item-title">${escapeHTML(t.description)}</span>
                    <span class="item-category">${escapeHTML(t.category)} <small>(${t.currency})</small></span>
                </div>
                <div class="item-right">
                    <span class="item-amount">${sign}${symbol}${formatNumber(t.amount)}</span>
                    <button class="delete-btn" onclick="removeTransaction(${t.id})" aria-label="Eliminar">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            ulEl.appendChild(li);
        });

        groupedListEl.appendChild(groupEl);
    });
}

function formatDateTitle(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const itemDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    itemDate.setHours(0,0,0,0);

    if (itemDate.getTime() === today.getTime()) {
        return 'Hoy';
    } else if (itemDate.getTime() === yesterday.getTime()) {
        return 'Ayer';
    } else {
        return itemDate.toLocaleDateString('es-ES', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    }
}

function formatNumber(num) {
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// --- MANEJO DEL FORMULARIO ---
if (formEl) {
    formEl.addEventListener('submit', (e) => {
        e.preventDefault();

        const description = descriptionInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const date = dateInput.value || new Date().toISOString().split('T')[0];
        const type = typeInput.value;
        const category = categoryInput.value;
        const currency = currencyInput ? currencyInput.value : currentCurrency;

        if (!description || isNaN(amount) || amount <= 0) return;

        const newTransaction = {
            id: Date.now(),
            description,
            amount,
            date,
            type,
            category,
            currency
        };

        transactions.push(newTransaction);
        updateUI();

        descriptionInput.value = '';
        amountInput.value = '';
        descriptionInput.focus();
    });
}

window.removeTransaction = function(id) {
    Swal.fire({
        title: '¿Eliminar movimiento?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            transactions = transactions.filter(t => t.id !== id);
            updateUI();
        }
    });
};

// --- CHART.JS CONFIG ---
function initChart() {
    const canvas = document.getElementById('expense-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#64748b'],
                borderWidth: 2,
                borderColor: '#151a23'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { size: 11 } }
                }
            },
            cutout: '70%'
        }
    });
}

function updateChart(filteredTransactions = transactions) {
    if (!myChart) return;
    const expensesByCategory = {};
    filteredTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        });

    myChart.data.labels = Object.keys(expensesByCategory);
    myChart.data.datasets[0].data = Object.values(expensesByCategory);
    myChart.update();
}

// Exportar a Excel
function exportToExcel() {
    const dataToExport = getFilteredTransactions();

    if (dataToExport.length === 0) {
    Swal.fire({
        icon: 'warning',
        title: 'Sin datos',
        text: 'No hay movimientos registrados para exportar con los filtros actuales.',
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#2563eb'
    });
    return;
}

    const excelData = dataToExport.map(t => ({
        "Fecha": t.date,
        "Tipo": t.type === 'income' ? 'Ingreso' : 'Gasto',
        "Descripción": t.description,
        "Categoría": t.category,
        "Moneda": t.currency || 'ARS',
        "Monto": t.type === 'expense' ? -t.amount : t.amount
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Finanzas");

    worksheet['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 12 }
    ];

    const today = new Date();
    const fileName = `Reporte_Finanzas_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
}

document.addEventListener('DOMContentLoaded', init);