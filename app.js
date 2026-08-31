// Paste your deployed Google Apps Script Web App URL ending in /exec
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbwo_LrXLoptXRKtNurS4s7dQVbQ9rG7pd_2tcs7KNgUZM199hjPudFt5wdLi_oLth/exec';

let allProductionData = [];

// Initialize Dashboard on Load
window.addEventListener('DOMContentLoaded', () => {
  fetchProductionData();
  registerServiceWorker();
});

// 1. Fetch Data from Google Apps Script
async function fetchProductionData() {
  const machineBody = document.getElementById('machineTableBody');
  machineBody.innerHTML = '<tr><td colspan="5" class="text-center">Fetching live data from Sheet...</td></tr>';

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getProductionData`);
    const json = await res.json();

    if (json.status === 'success') {
      allProductionData = json.data;
      populateMonthFilter(allProductionData);
      filterData();
    } else {
      machineBody.innerHTML = '<tr><td colspan="5" class="text-center">No data found in Google Sheet.</td></tr>';
    }
  } catch (err) {
    machineBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: #dc2626;">Error loading data: ${err.message}</td></tr>`;
  }
}

// 2. Populate Month Filter Options
function populateMonthFilter(data) {
  const monthFilter = document.getElementById('monthFilter');
  const months = new Set();

  data.forEach(item => {
    if (item.date) {
      const parts = item.date.split('/');
      if (parts.length === 3) {
        // Formats MM/YYYY key
        const monthKey = `${parts[1].padStart(2, '0')}/${parts[2]}`;
        months.add(monthKey);
      }
    }
  });

  monthFilter.innerHTML = '<option value="ALL">All Recorded Data</option>';
  Array.from(months).sort().reverse().forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `Month: ${m}`;
    monthFilter.appendChild(opt);
  });
}

// 3. Filter & Aggregate Metrics
function filterData() {
  const selectedMonth = document.getElementById('monthFilter').value;

  const filtered = selectedMonth === 'ALL'
    ? allProductionData
    : allProductionData.filter(item => {
        if (!item.date) return false;
        const parts = item.date.split('/');
        return parts.length === 3 && `${parts[1].padStart(2, '0')}/${parts[2]}` === selectedMonth;
      });

  renderKPIsAndSummary(filtered);
  renderDailyLogs(filtered);
}

// 4. Render Summaries and KPIs
function renderKPIsAndSummary(data) {
  let totalMeters = 0;
  let totalDay = 0;
  let totalNight = 0;
  const machines = {};

  data.forEach(row => {
    const day = parseFloat(row.day) || 0;
    const night = parseFloat(row.night) || 0;
    const total = parseFloat(row.machineTotal) || (day + night);
    const mName = row.machine || 'Unknown';

    totalMeters += total;
    totalDay += day;
    totalNight += night;

    if (!machines[mName]) {
      machines[mName] = { day: 0, night: 0, total: 0 };
    }
    machines[mName].day += day;
    machines[mName].night += night;
    machines[mName].total += total;
  });

  // Update KPIs
  document.getElementById('kpiTotal').textContent = `${totalMeters.toLocaleString()} mtr`;
  document.getElementById('kpiDay').textContent = `${totalDay.toLocaleString()} mtr`;
  document.getElementById('kpiNight').textContent = `${totalNight.toLocaleString()} mtr`;

  let topMachine = '-';
  let maxOutput = 0;
  for (const [name, stats] of Object.entries(machines)) {
    if (stats.total > maxOutput) {
      maxOutput = stats.total;
      topMachine = `${name} (${maxOutput.toLocaleString()} m)`;
    }
  }
  document.getElementById('kpiTopMachine').textContent = topMachine;

  // Render Machine Summary Table
  const tbody = document.getElementById('machineTableBody');
  if (Object.keys(machines).length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No production records for this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = Object.entries(machines).map(([name, stats]) => {
    const share = totalMeters > 0 ? ((stats.total / totalMeters) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${stats.day.toLocaleString()}</td>
        <td>${stats.night.toLocaleString()}</td>
        <td><strong>${stats.total.toLocaleString()}</strong></td>
        <td>${share}%</td>
      </tr>
    `;
  }).join('');
}

// 5. Render Daily Shift Logs
function renderDailyLogs(data) {
  const tbody = document.getElementById('dailyTableBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No logs found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.slice().reverse().map(row => `
    <tr>
      <td>${row.date}</td>
      <td>${row.machine}</td>
      <td>${row.day || 0}</td>
      <td>${row.night || 0}</td>
      <td><strong>${row.machineTotal || 0}</strong></td>
    </tr>
  `).join('');
}

// 6. Queue WhatsApp Backfill Command to Google Sheets
async function requestBackfill() {
  const selectedDate = document.getElementById('backfillDate').value;
  const msg = document.getElementById('backfillMsg');

  if (!selectedDate) {
    alert('Please select a date.');
    return;
  }

  msg.style.color = '#0284c7';
  msg.textContent = `Sending command to fetch messages from ${selectedDate}...`;

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'requestBackfill',
        fromDate: selectedDate
      })
    });

    msg.style.color = '#16a34a';
    msg.textContent = `Backfill request queued for ${selectedDate}. PC Listener will process it shortly.`;
  } catch (err) {
    msg.style.color = '#dc2626';
    msg.textContent = `Error: ${err.message}`;
  }
}

// 7. Register Service Worker for PWA Installation
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker Active'))
      .catch(err => console.warn('SW registration failed:', err));
  }
}
