import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc,        // 👈 Necesario para referenciar el documento
  updateDoc,  // 👈 Necesario para actualizar montos
  deleteDoc,   // 👈 Necesario para eliminar objetivos
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCX7pRLWvnUrK2txyTHk_ZFE_ujmVs4HiM",
    authDomain: "finanzas-app-af367.firebaseapp.com",
    projectId: "finanzas-app-af367",
    storageBucket: "finanzas-app-af367.firebasestorage.app",
    messagingSenderId: "592476181589",
    appId: "1:592476181589:web:fe0180b384abd0a06bf0dc"
  };

  // Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// Elementos de la interfaz del usuario
const userInfoContainer = document.getElementById("userInfo");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const btnLogout = document.getElementById("btnLogout");

// 🔒 GUARDIÁN DE SEGURIDAD & PERFIL DE USUARIO
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Si no está logueado, redirigir al login
    window.location.href = "login.html";
  } else {
    currentUser = user;

    // Mostrar avatar y nombre obtenido de Google Auth
    if (userAvatar) userAvatar.src = user.photoURL || "https://via.placeholder.com/38";
    if (userName) userName.textContent = user.displayName || user.email;
    if (userInfoContainer) userInfoContainer.classList.remove("d-none");

    // 📥 Cargar TODOS los datos del usuario desde Firestore
    await cargarDatos();
    await cargarObjetivosAhorro();
    await cargarPresupuestos(); // 👈 NUEVO: presupuestos también viven en Firestore, por usuario
  }
});

// 📥 CARGAR DATOS DESDE FIRESTORE
async function cargarDatos() {
  try {
    const q = query(
      collection(db, "transacciones"), 
      where("userId", "==", currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    
    transactions = []; // Guardamos directamente en 'transactions'
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      transactions.push({
        id: docSnapshot.id,
        description: data.descripcion || data.description || '',
        amount: parseFloat(data.monto || data.amount || 0),
        type: data.tipo || data.type || 'expense', // "income" | "expense" | "ahorro" | "retiro_ahorro"
        category: data.categoria || data.category || 'Otros',
        currency: data.moneda || data.currency || 'ARS',
        date: data.fecha ? data.fecha.split('T')[0] : new Date().toISOString().split('T')[0]
      });
    });

    updateUI(); 
  } catch (error) {
    console.error("Error al cargar movimientos:", error);
  }
}

// 📤 GUARDAR MOVIMIENTO EN FIRESTORE
async function agregarMovimiento(description, amount, type, category, currency, date) {
  if (!currentUser) {
    console.error("No hay usuario autenticado.");
    return;
  }

  try {
    // Inserta directamente en la colección "transacciones" de Firestore
    await addDoc(collection(db, "transacciones"), {
      userId: currentUser.uid,
      descripcion: description,
      monto: parseFloat(amount),
      tipo: type,
      categoria: category,
      moneda: currency || 'ARS',
      fecha: date || new Date().toISOString()
    });

    // Vuelve a leer Firestore para sincronizar el estado global
    await cargarDatos();

  } catch (error) {
    console.error("Error al guardar en Firestore:", error);
  }
}

// --- ESTADO Y VARIABLES GLOBALES ---
let transactions = []; // Unificado a "transactions"
let currentCurrency = localStorage.getItem('currentCurrency') || 'ARS';

// Los presupuestos ahora se guardan en Firestore (colección "presupuestos", 1 doc por usuario).
// Este objeto es solo el valor por defecto mientras se cargan los datos reales del usuario.
let budgets = {
    "Alquiler": 0,
    "Supermercado": 0,
    "Carniceria": 0,
    "Verduleria": 0,
    "Servicios": 0,
    "Deporte": 0,
    "Viajes": 0,
    "Mascota": 0,
    "Tarjeta": 0,
    "Transporte": 0,
    "Ocio": 0,
    "Ahorro": 0,
    "Otros": 0
};
let budgetsDocId = null; // id del documento en Firestore para saber si hay que crear o actualizar

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
const savingsEl = document.getElementById('total-savings'); 
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

    const income = filteredTransactions
        .filter(t => t.type === 'income' || t.type === 'ingreso')
        .reduce((acc, t) => acc + t.amount, 0);

    const expense = filteredTransactions
        .filter(t => t.type === 'expense' || t.type === 'egreso' || t.type === 'retiro_ahorro' || t.type === 'withdraw_savings')
        .reduce((acc, t) => acc + t.amount, 0);

    // Fondo acumulado total por transacciones
    const totalSavingsTransactions = filteredTransactions.reduce((acc, t) => {
        if (t.type === 'ahorro' || t.type === 'savings') return acc + t.amount;
        if (t.type === 'retiro_ahorro' || t.type === 'withdraw_savings') return acc - t.amount;
        return acc;
    }, 0);

    // Total de dinero ya asignado a objetivos activos
    const totalInGoals = savingsGoals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);

    // Ahorro libre que te queda para repartir
    const freeSavings = Math.max(0, totalSavingsTransactions - totalInGoals);

    // Balance disponible en cuenta corriente
    const totalBalance = income - expense - totalSavingsTransactions;

    if (balanceEl) balanceEl.innerText = `${symbol}${formatNumber(totalBalance)}`;
    if (incomeEl) incomeEl.innerText = `${symbol}${formatNumber(income)}`;
    if (expenseEl) expenseEl.innerText = `${symbol}${formatNumber(expense)}`;
    
    // Mostramos el Ahorro Libre y entre paréntesis el total
    if (savingsEl) {
        savingsEl.innerHTML = `${symbol}${formatNumber(freeSavings)} <span style="font-size: 0.75rem; color: #94a3b8; display: block; font-weight: normal;">(Total: ${symbol}${formatNumber(totalSavingsTransactions)})</span>`;
    }

    renderGroupedList(filteredTransactions);
    updateChart(filteredTransactions);
    renderBudgets(filteredTransactions);
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

// --- CONFIGURAR PRESUPUESTOS CON SWEETALERT2 ---
if (setBudgetBtn) {
    setBudgetBtn.addEventListener('click', async () => {
        // 1. Obtener TODAS las categorías presentes en el <select id="category">
        const selectCategory = document.getElementById('category');
        const categories = Array.from(selectCategory.options).map(opt => opt.value);

        const symbol = currencySymbols[currentCurrency] || '$';

        // 2. Construir el formulario dentro del modal
        let formHTML = '<div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 60vh; overflow-y: auto; padding-right: 0.5rem;">';
        
        categories.forEach(cat => {
            const currentLimit = budgets[cat] || 0; // Si no existía en budgets, muestra 0
            // Sanitizar ID para evitar problemas con espacios o caracteres especiales
            const safeId = encodeURIComponent(cat);

            formHTML += `
                <div>
                    <label style="font-size: 0.85rem; color: #94a3b8; display: block; margin-bottom: 0.3rem;">
                        ${escapeHTML(cat)} (${symbol})
                    </label>
                    <input type="number" id="swal-budget-${safeId}" class="swal2-input" 
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
                const newBudgets = { ...budgets }; // Mantiene categorías previas si las hubiera
                categories.forEach(cat => {
                    const safeId = encodeURIComponent(cat);
                    const input = document.getElementById(`swal-budget-${safeId}`);
                    if (input) {
                        const val = parseFloat(input.value);
                        newBudgets[cat] = !isNaN(val) && val >= 0 ? val : 0;
                    }
                });
                return newBudgets;
            }
        });

        if (formValues) {
            budgets = formValues;
            updateUI();

            try {
                await guardarPresupuestos(budgets);

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
            } catch (error) {
                console.error("Error al guardar presupuestos:", error);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: 'No se pudo guardar en la nube',
                    showConfirmButton: false,
                    timer: 2500,
                    background: '#1e293b',
                    color: '#f8fafc'
                });
            }
        }
    });
}

// --- CARGAR PRESUPUESTOS DESDE FIRESTORE ---
async function cargarPresupuestos() {
    if (!currentUser) return;

    try {
        const q = query(
            collection(db, "presupuestos"),
            where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Ya existe un documento de presupuestos para este usuario: lo usamos
            const docSnap = querySnapshot.docs[0];
            budgetsDocId = docSnap.id;
            const data = docSnap.data();
            // Combinamos con los valores por defecto por si se agregó una categoría nueva luego
            budgets = { ...budgets, ...(data.limites || {}) };
        } else {
            // Primera vez que este usuario configura presupuestos: no hay doc todavía
            budgetsDocId = null;
        }

        updateUI();
    } catch (error) {
        console.error("Error al cargar presupuestos:", error);
    }
}

// --- GUARDAR (CREAR O ACTUALIZAR) PRESUPUESTOS EN FIRESTORE ---
async function guardarPresupuestos(nuevosLimites) {
    if (!currentUser) return;

    if (budgetsDocId) {
        // Ya existe un doc para este usuario: lo actualizamos
        await updateDoc(doc(db, "presupuestos", budgetsDocId), {
            limites: nuevosLimites
        });
    } else {
        // Primer guardado: creamos el documento
        const nuevoDoc = await addDoc(collection(db, "presupuestos"), {
            userId: currentUser.uid,
            limites: nuevosLimites
        });
        budgetsDocId = nuevoDoc.id;
    }
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
            <button class="delete-btn" onclick="removeTransaction('${t.id}')" aria-label="Eliminar">
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
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const type = typeInput.value;
    const category = categoryInput.value;
    const date = dateInput.value || new Date().toISOString().split('T')[0];
    const currency = currentCurrency || 'ARS';

    if (!description || isNaN(amount) || amount <= 0) return;

    // 👇 LLAMADA A FIRESTORE OBLIGATORIA
    await agregarMovimiento(description, amount, type, category, currency, date);

    // Limpiar campos
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
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // 1. Borrar de Firestore en la nube
                await deleteDoc(doc(db, "transacciones", id));
                
                // 2. Recargar datos de la nube para actualizar la interfaz
                await cargarDatos();
            } catch (error) {
                console.error("Error al eliminar de Firestore:", error);
                Swal.fire('Error', 'No se pudo eliminar el movimiento', 'error');
            }
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

document.addEventListener('DOMContentLoaded', () => {
    // 1. Referencias a los elementos del DOM
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const htmlElement = document.documentElement; // La etiqueta <html>

    // 2. Función para establecer el tema visual
    // theme: 'dark' o 'light'
    const setTheme = (theme) => {
        if (theme === 'dark') {
            htmlElement.setAttribute('data-theme', 'dark');
            themeIcon.classList.replace('fa-moon', 'fa-sun'); // Muestra sol en modo oscuro
            localStorage.setItem('themePreference', 'dark'); // Guarda preferencia
        } else {
            // Modo claro por defecto
            htmlElement.removeAttribute('data-theme');
            themeIcon.classList.replace('fa-sun', 'fa-moon'); // Muestra luna en modo claro
            localStorage.setItem('themePreference', 'light'); // Guarda preferencia
        }
    };

    // 3. Cargar la preferencia guardada al iniciar
    const savedTheme = localStorage.getItem('themePreference');
    
    // Si hay una preferencia guardada, úsala. Si no, usa el modo claro (vacío).
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        // Opcional: Podrías detectar la preferencia del sistema operativo aquí
        // si quisieras, pero por defecto asumimos claro.
        setTheme('light');
    }

    // 4. Escuchar el evento de clic en el botón
    btnThemeToggle.addEventListener('click', () => {
        // Verificamos el estado actual
        const currentTheme = htmlElement.getAttribute('data-theme');
        
        if (currentTheme === 'dark') {
            setTheme('light'); // Cambiar a claro
        } else {
            setTheme('dark');  // Cambiar a oscuro
        }
    });
});

// 🚪 CERRAR SESIÓN
btnLogout.addEventListener("click", async () => {
  const result = await Swal.fire({
    title: "¿Cerrar sesión?",
    text: "Vas a salir de tu cuenta personal.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#212529",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Sí, salir",
    cancelButtonText: "Cancelar"
  });

  if (result.isConfirmed) {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      Swal.fire("Error", "No se pudo cerrar la sesión.", "error");
    }
  }
});

// ==========================================
// 🎯 GESTIÓN DE OBJETIVOS DE AHORRO
// ==========================================

let savingsGoals = [];
const savingsListEl = document.getElementById('savings-list');
const addSavingsGoalBtn = document.getElementById('add-savings-goal-btn');

// 1. CARGAR OBJETIVOS DESDE FIRESTORE
async function cargarObjetivosAhorro() {
    if (!currentUser || !savingsListEl) return;

    try {
        const q = query(
            collection(db, "objetivos_ahorro"),
            where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);

        savingsGoals = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            savingsGoals.push({
                id: docSnap.id,
                title: data.title || 'Objetivo',
                targetAmount: parseFloat(data.targetAmount || 0),
                currentAmount: parseFloat(data.currentAmount || 0)
            });
        });

        renderSavingsGoals();
    } catch (error) {
        console.error("Error al cargar objetivos de ahorro:", error);
    }
}

// 2. RENDERIZAR OBJETIVOS EN EL DOM
function renderSavingsGoals() {
    if (!savingsListEl) return;
    savingsListEl.innerHTML = '';

    if (savingsGoals.length === 0) {
        savingsListEl.innerHTML = `
            <p style="color: #94a3b8; font-size: 0.9rem; text-align: center; padding: 1rem 0;">
                No tienes objetivos activos. ¡Crea el primero!
            </p>
        `;
        return;
    }

    const symbol = currencySymbols[currentCurrency] || '$';

    savingsGoals.forEach(goal => {
        const percentage = goal.targetAmount > 0 
            ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
            : 0;

        const isCompleted = percentage >= 100;

        const goalCard = document.createElement('div');
        goalCard.className = 'savings-item';
        goalCard.innerHTML = `
            <div class="savings-info">
                <div class="savings-title">
                    <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-bullseye'}" style="color: ${isCompleted ? '#10b981' : '#38bdf8'};"></i>
                    <span>${goal.title}</span>
                </div>
                <span class="savings-amount">${symbol}${formatNumber(goal.currentAmount)} / ${symbol}${formatNumber(goal.targetAmount)}</span>
            </div>
            <div class="progress-bar-container" style="background: #334155; border-radius: 999px; height: 8px; overflow: hidden; margin: 8px 0;">
                <div class="progress-bar" style="width: ${percentage}%; background: ${isCompleted ? '#10b981' : '#38bdf8'}; height: 100%; transition: width 0.4s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #94a3b8;">
                <span class="progress-percentage">${percentage}% completado ${isCompleted ? '🎉' : ''}</span>
                <div style="display: flex; gap: 8px;">
                    <button onclick="abonarObjetivo('${goal.id}')" title="Añadir dinero" style="background: transparent; border: none; color: #10b981; cursor: pointer;">
                        <i class="fa-solid fa-plus-circle"></i>
                    </button>
                    <button onclick="eliminarObjetivo('${goal.id}')" title="Eliminar objetivo" style="background: transparent; border: none; color: #ef4444; cursor: pointer;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        savingsListEl.appendChild(goalCard);
    });
}

// 3. MODAL: CREAR NUEVO OBJETIVO
if (addSavingsGoalBtn) {
    addSavingsGoalBtn.addEventListener('click', async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Nuevo Objetivo de Ahorro',
            html: `
                <input id="swal-goal-title" class="swal2-input" placeholder="Nombre (ej. Vacaciones, Auto)" style="background: #0f172a; color: #fff; border: 1px solid #334155;">
                <input id="swal-goal-target" type="number" class="swal2-input" placeholder="Monto Meta (ej. 300000)" style="background: #0f172a; color: #fff; border: 1px solid #334155;">
                <input id="swal-goal-current" type="number" class="swal2-input" placeholder="Ahorro Inicial (Opcional)" value="0" style="background: #0f172a; color: #fff; border: 1px solid #334155;">
            `,
            focusConfirm: false,
            background: '#1e293b',
            color: '#f8fafc',
            showCancelButton: true,
            confirmButtonColor: '#38bdf8',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Crear Objetivo',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const title = document.getElementById('swal-goal-title').value.trim();
                const target = parseFloat(document.getElementById('swal-goal-target').value);
                const current = parseFloat(document.getElementById('swal-goal-current').value) || 0;

                if (!title || isNaN(target) || target <= 0) {
                    Swal.showValidationMessage('Ingresa un nombre y un monto meta válido.');
                    return false;
                }
                return { title, targetAmount: target, currentAmount: current };
            }
        });

        if (formValues) {
            try {
                await addDoc(collection(db, "objetivos_ahorro"), {
                    userId: currentUser.uid,
                    title: formValues.title,
                    targetAmount: formValues.targetAmount,
                    currentAmount: formValues.currentAmount,
                    createdAt: new Date().toISOString()
                });
                await cargarObjetivosAhorro();
            } catch (error) {
                console.error("Error al guardar objetivo:", error);
            }
        }
    });
}

// 4. MODAL: ABONAR DINERO A UN OBJETIVO EXISTENTE
window.abonarObjetivo = async function(id) {
    const goal = savingsGoals.find(g => g.id === id);
    if (!goal) return;

    // 1. Calcular cuánto ahorro libre hay actualmente
    const totalSavingsTransactions = transactions.reduce((acc, t) => {
        if (t.type === 'ahorro' || t.type === 'savings') return acc + t.amount;
        if (t.type === 'retiro_ahorro' || t.type === 'withdraw_savings') return acc - t.amount;
        return acc;
    }, 0);
    const totalInGoals = savingsGoals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);
    const freeSavings = Math.max(0, totalSavingsTransactions - totalInGoals);
    const symbol = currencySymbols[currentCurrency] || '$';

    if (freeSavings <= 0) {
        Swal.fire({
            title: 'Sin ahorro disponible',
            text: 'No tienes fondos libres en tu caja de ahorro. Primero destina dinero a Ahorro desde el formulario principal.',
            icon: 'info',
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#38bdf8'
        });
        return;
    }

    // 2. Pedir el monto con el límite del ahorro libre
    const { value: montoSumar } = await Swal.fire({
        title: `Sumar a "${goal.title}"`,
        input: 'number',
        inputLabel: `Monto a asignar (Disponible libre: ${symbol}${formatNumber(freeSavings)})`,
        inputPlaceholder: 'Ej. 5000',
        background: '#1e293b',
        color: '#f8fafc',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Asignar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            const num = parseFloat(value);
            if (!value || isNaN(num) || num <= 0) {
                return 'Ingresa un monto mayor a 0';
            }
            if (num > freeSavings) {
                return `No puedes asignar más de ${symbol}${formatNumber(freeSavings)}`;
            }
        }
    });

    if (montoSumar) {
        try {
            const nuevoTotal = goal.currentAmount + parseFloat(montoSumar);
            const docRef = doc(db, "objetivos_ahorro", id);
            await updateDoc(docRef, { currentAmount: nuevoTotal });
            
            // Recargar datos y refrescar la interfaz
            await cargarObjetivosAhorro();
            updateUI(); 
        } catch (error) {
            console.error("Error al actualizar objetivo:", error);
        }
    }
};

// 5. ELIMINAR OBJETIVO
window.eliminarObjetivo = async function(id) {
    const confirm = await Swal.fire({
        title: '¿Eliminar este objetivo?',
        text: 'Los datos de la meta serán borrados.',
        icon: 'warning',
        showCancelButton: true,
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        try {
            await deleteDoc(doc(db, "objetivos_ahorro", id));
            await cargarObjetivosAhorro();
        } catch (error) {
            console.error("Error al eliminar objetivo:", error);
        }
    }
};