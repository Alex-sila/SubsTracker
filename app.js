// ============================================================
// SubsTracker — Полная логика (Clean Version v6.7 - No Hide Sum)
// ============================================================

const STORAGE_KEY = 'subs_tracker_data_v5';
const PIN_KEY = 'subs_tracker_pin';
const NOTIFY_KEY = 'subs_tracker_notify';
const THEME_KEY = 'subs_tracker_theme';
const ONBOARDING_KEY = 'subs_tracker_onboarding';

let subs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentPin = '';
let isPinSettingUp = false;
let chartInstance = null;
let uploadedBase64 = null;
let editingId = null; 

const $ = id => document.getElementById(id);

// ============================================================
// 1. ОНБОРДИНГ И ТЕМА
// ============================================================
window.startApp = function() {
  localStorage.setItem(ONBOARDING_KEY, 'true');
  $('onboarding').hidden = true;
  $('onboarding').classList.remove('active');
  $('pinScreen').hidden = false;
  $('pinScreen').classList.add('active');
  initPin();
};

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  if ($('themeSelect')) $('themeSelect').value = savedTheme;
  applyTheme(savedTheme);
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  changeTheme(next);
}

function changeTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

// ============================================================
// 2. ЛОГИКА PIN-КОДА
// ============================================================
function initPin() {
  const savedPin = localStorage.getItem(PIN_KEY);
  if (!savedPin) {
    isPinSettingUp = true;
    $('pinTitle').textContent = 'Придумайте PIN-код';
  } else {
    isPinSettingUp = false;
    $('pinTitle').textContent = 'Введите PIN-код';
  }
}

function enterPin(num) {
  if (currentPin.length >= 4) return;
  currentPin += num;
  updatePinDots();

  if (currentPin.length === 4) {
    setTimeout(() => {
      const savedPin = localStorage.getItem(PIN_KEY);
      if (isPinSettingUp) {
        localStorage.setItem(PIN_KEY, currentPin);
        alert('PIN-код установлен!');
        unlockApp();
      } else {
        if (currentPin === savedPin) { unlockApp(); } 
        else {
          alert('Неверный PIN-код!');
          currentPin = '';
          updatePinDots();
        }
      }
    }, 200);
  }
}

function deletePin() { currentPin = currentPin.slice(0, -1); updatePinDots(); }
function updatePinDots() { document.querySelectorAll('#pinDots span').forEach((dot, index) => dot.classList.toggle('filled', index < currentPin.length)); }

function unlockApp() {
  currentPin = ''; updatePinDots();
  $('pinScreen').hidden = true; $('pinScreen').classList.remove('active');
  $('mainScreen').hidden = false; $('mainScreen').classList.add('active');
  
  // УВЕДОМЛЕНИЯ ПО УМОЛЧАНИЮ ВКЛЮЧЕНЫ
  let notifyState = localStorage.getItem(NOTIFY_KEY);
  if (notifyState === null) {
    notifyState = 'true';
    localStorage.setItem(NOTIFY_KEY, 'true');
  }
  if ($('chkNotifications')) $('chkNotifications').checked = (notifyState === 'true');
  
  renderMainScreen();
}

// ============================================================
// 3. ГЛАВНЫЙ ЭКРАН И КАРТОЧКИ
// ============================================================
function toggleSearch() { 
  $('searchContainer').hidden = !$('searchContainer').hidden; 
}

function getMonthName(m) {
  const months = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return months[m] || '';
}

function renderMainScreen() {
  const list = $('subscriptionsList');
  list.innerHTML = '';

  let totalMonth = 0;
  let totalYear = 0;

  const searchQuery = $('searchInput').value.toLowerCase();
  const sortBy = $('sortSelect').value;

  let filteredSubs = subs.filter(s => s.name.toLowerCase().includes(searchQuery));

  filteredSubs.sort((a, b) => {
    if (sortBy === 'price') return b.price - a.price;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return a.day - b.day; 
  });

  if (filteredSubs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">💳</span>
        У вас пока нет подписок.<br>Нажмите <b>+</b>, чтобы добавить первую.
      </div>`;
  }

  filteredSubs.forEach(sub => {
    const price = Number(sub.price);
    const isYearly = sub.periodicity === 'yearly';

    if (!sub.isPaused) {
      if (isYearly) { totalMonth += price / 12; totalYear += price; } 
      else { totalMonth += price; totalYear += price * 12; }
    }

    let iconHTML = sub.iconBase64 ? `<img src="${sub.iconBase64}" alt="icon">` : (sub.icon || '💳');
    
    let dateText = isYearly 
      ? `Списание: ${sub.day} ${getMonthName(sub.month)}` 
      : `Списание: ${sub.day} число`;

    if (sub.isPaused) dateText = '❄️ Приостановлена';

    const card = document.createElement('div');
    card.className = 'sub-card';
    card.style.opacity = sub.isPaused ? '0.5' : '1';
    card.onclick = () => openEditModal(sub.id);

    // ПРЕМИАЛЬНАЯ СТРУКТУРА КАРТОЧКИ
    card.innerHTML = `
      <div class="sub-icon">${iconHTML}</div>
      <div class="sub-content">
        <div class="sub-header">
          <span class="sub-title">${sub.name}</span>
          <span class="sub-price">${price} ₽</span>
        </div>
        <div class="sub-footer">
          <span class="sub-date">${dateText}</span>
          <span class="sub-badge">${isYearly ? 'ГОД' : 'МЕС'}</span>
        </div>
      </div>
      <button class="delete-btn" onclick="event.stopPropagation(); deleteSub('${sub.id}')">🗑️</button>
    `;
    list.appendChild(card);
  });

  // ВСЕГДА ПОКАЗЫВАЕМ СУММУ (БЕЗ СКРЫТИЯ)
  $('totalMonthly').innerHTML = `${Math.round(totalMonth).toLocaleString('ru-RU')} ₽ <span>/ мес</span>`;
  $('totalYearly').textContent = `${Math.round(totalYear).toLocaleString('ru-RU')} ₽`;
}

function deleteSub(id) {
  const sub = subs.find(s => s.id === id);
  if (sub) {
    const savedMoney = sub.periodicity === 'yearly' ? sub.price : sub.price * 12;
    if (confirm(`Удалить подписку?\nВы сэкономите ${savedMoney} ₽ в год!`)) {
      subs = subs.filter(s => s.id !== id);
      saveData();
    }
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
  renderMainScreen();
  if (!$('analyticsScreen').hidden) renderAnalytics();
}

// ============================================================
// 4. ДОБАВЛЕНИЕ / РЕДАКТИРОВАНИЕ
// ============================================================
function openAddModal() {
  editingId = null;
  const daySelect = $('inpDay');
  if (daySelect.options.length === 0) {
    for (let i = 1; i <= 31; i++) {
      const opt = document.createElement('option'); opt.value = i; opt.textContent = `${i}`; daySelect.appendChild(opt);
    }
  }
  $('addForm').reset();
  $('modalTitle').textContent = 'Новая подписка';
  $('inpName').dataset.icon = '💳';
  uploadedBase64 = null;
  toggleDateFields(); 
  $('addModal').hidden = false;
}

function openEditModal(id) {
  const sub = subs.find(s => s.id === id);
  if (!sub) return;
  
  editingId = id;
  openAddModal(); 
  $('modalTitle').textContent = 'Редактировать';
  
  $('inpName').value = sub.name;
  $('inpPrice').value = sub.price;
  $('inpDay').value = sub.day;
  $('inpCategory').value = sub.category;
  $('inpStartDate').value = sub.startDate;
  
  if (sub.periodicity === 'yearly') {
    document.querySelector('input[value="yearly"]').checked = true;
    $('inpMonth').value = sub.month || 1;
  } else {
    document.querySelector('input[value="monthly"]').checked = true;
  }
  toggleDateFields();
  uploadedBase64 = sub.iconBase64;
  editingId = id; 
  $('addModal').hidden = false;
}

function closeAddModal() { $('addModal').hidden = true; }

function fillPreset(name, price, icon, category) {
  $('inpName').value = name;
  $('inpPrice').value = price;
  $('inpName').dataset.icon = icon;
  $('inpCategory').value = category;
}

function toggleDateFields() {
  const isYearly = document.querySelector('input[name="period"]:checked').value === 'yearly';
  $('monthField').style.display = isYearly ? 'block' : 'none';
}

$('inpIcon').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) { uploadedBase64 = event.target.result; };
    reader.readAsDataURL(file);
  } else { uploadedBase64 = null; }
});

function saveSubscription(e) {
  e.preventDefault();
  const name = $('inpName').value.trim();
  const price = Number($('inpPrice').value);
  const day = Number($('inpDay').value);
  const category = $('inpCategory').value;
  const periodicity = document.querySelector('input[name="period"]:checked').value;
  const month = periodicity === 'yearly' ? Number($('inpMonth').value) : null;
  const startDate = $('inpStartDate').value || new Date().toISOString().split('T')[0];
  const icon = $('inpName').dataset.icon || '💳';
  const isPaused = editingId ? subs.find(s => s.id === editingId).isPaused : false;

  if (!editingId && subs.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    if (!confirm('Подписка с таким названием уже есть. Добавить дубль?')) return;
  }

  const newSub = {
    id: editingId || Date.now().toString(),
    name, price, day, category, periodicity, month, startDate, icon, isPaused,
    iconBase64: uploadedBase64
  };

  if (editingId) {
    const idx = subs.findIndex(s => s.id === editingId);
    subs[idx] = newSub;
  } else {
    subs.push(newSub);
  }

  saveData();
  closeAddModal();
}

// ============================================================
// 5. АНАЛИТИКА
// ============================================================
function renderAnalytics() {
  const categories = {
    entertainment: { name: 'Развлечения', sum: 0, color: '#8B5CF6' },
    music: { name: 'Музыка', sum: 0, color: '#EC4899' },
    soft: { name: 'Софт', sum: 0, color: '#3B82F6' },
    utility: { name: 'Связь и интернет', sum: 0, color: '#F59E0B' },
    other: { name: 'Другое', sum: 0, color: '#64748B' }
  };

  let totalMonth = 0;

  subs.forEach(sub => {
    const price = Number(sub.price);
    const monthlyPrice = sub.periodicity === 'yearly' ? price / 12 : price;
    if (categories[sub.category]) categories[sub.category].sum += monthlyPrice;
    else categories['other'].sum += monthlyPrice;
    totalMonth += monthlyPrice;
  });

  $('analyticsText').innerHTML = `Сумма ваших подписок: <b>${Math.round(totalMonth)} ₽/мес</b>.<br>За год это выйдет <b>${Math.round(totalMonth * 12)} ₽</b>.`;

  const ctx = $('categoryChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const labels = [], data = [], bgColors = [];
  for (const key in categories) {
    if (categories[key].sum > 0) { labels.push(categories[key].name); data.push(Math.round(categories[key].sum)); bgColors.push(categories[key].color); }
  }
  if (data.length === 0) { labels.push('Нет данных'); data.push(1); bgColors.push('#334155'); }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8' } } } }
  });

  const catList = $('categoryList');
  catList.innerHTML = '';
  for (const key in categories) {
    if (categories[key].sum > 0) {
      const div = document.createElement('div');
      div.className = 'category-item';
      div.innerHTML = `<span>${categories[key].name}</span><b>${Math.round(categories[key].sum)} ₽</b>`;
      catList.appendChild(div);
    }
  }
}

function shareStats() {
  const total = $('totalYearly').textContent;
  const text = `Я трачу ${total} в год на подписки! А ты? Посчитай свои траты в SubsTracker.`;
  
  if (navigator.share) {
    navigator.share({ title: 'Мои подписки', text: text }).catch(console.error);
  } else {
    navigator.clipboard.writeText(text);
    alert('Текст скопирован в буфер обмена!');
  }
}

// ============================================================
// 6. НАВИГАЦИЯ И НАСТРОЙКИ
// ============================================================
function switchTab(tab) {
  $('mainScreen').hidden = true; 
  $('analyticsScreen').hidden = true; 
  
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  if (tab === 'main') { 
    $('mainScreen').hidden = false; 
    document.querySelectorAll('.nav-item')[0].classList.add('active'); 
  }
  else if (tab === 'analytics') { 
    $('analyticsScreen').hidden = false; 
    document.querySelectorAll('.nav-item')[1].classList.add('active'); 
    renderAnalytics(); 
  }
}

function goToSettings() { $('settingsModal').hidden = false; }
function closeSettings() { $('settingsModal').hidden = true; }
function openLegal() { $('settingsModal').hidden = true; $('legalModal').hidden = false; }
function closeLegal() { $('legalModal').hidden = true; }

function toggleNotifications() {
  const isChecked = $('chkNotifications').checked;
  localStorage.setItem(NOTIFY_KEY, isChecked);
  if (isChecked && window.Capacitor && window.Capacitor.Plugins.LocalNotifications) {
    window.Capacitor.Plugins.LocalNotifications.requestPermissions();
  }
}

function backupData() {
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(subs));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", "substracker_backup.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("Резервная копия успешно сохранена!");
  } catch (e) {
    alert("Ошибка при сохранении: " + e.message);
  }
}

function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        subs = imported;
        saveData();
        alert('Данные успешно загружены!');
      }
    } catch (err) { alert('Ошибка чтения файла.'); }
  };
  reader.readAsText(file);
}

function clearData() {
  if (confirm('Удалить ВСЕ подписки? Это действие нельзя отменить.')) {
    localStorage.removeItem(STORAGE_KEY);
    subs = [];
    saveData();
    closeSettings();
  }
}

// ============================================================
// СТАРТ ПРИЛОЖЕНИЯ
// ============================================================
initTheme();
document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem(THEME_KEY)) localStorage.setItem(THEME_KEY, 'dark');
  
  const btnStart = document.getElementById('btnStart');
  if (btnStart) {
    btnStart.addEventListener('click', startApp);
    btnStart.addEventListener('touchstart', function(e) {
      e.preventDefault(); 
      startApp();
    }, { passive: false });
  }

  if (localStorage.getItem(ONBOARDING_KEY) === 'true') {
    $('onboarding').hidden = true;
    $('onboarding').classList.remove('active');
    $('pinScreen').hidden = false;
    $('pinScreen').classList.add('active');
    initPin();
  }
});