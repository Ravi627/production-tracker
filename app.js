// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

function processInput() {
  const text = document.getElementById('rawInput').value;
  if (!text.trim()) return;

  const data = parseProductionData(text);
  renderResults(data);
}

function parseProductionData(rawText) {
  const dateMatch = rawText.match(/\b\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}\b/);
  const date = dateMatch ? dateMatch[0].replace(/\s+/g, '') : new Date().toLocaleDateString();

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const machines = [];
  let currentMachine = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}$/)) continue;

    const dayMatch = line.match(/^Day\s*-\s*(\d+(?:\.\d+)?)\s*mtr/i);
    const nightMatch = line.match(/^Night\s*-\s*(\d+(?:\.\d+)?)\s*mtr/i);

    if (dayMatch && currentMachine) {
      currentMachine.day = parseFloat(dayMatch[1]);
    } else if (nightMatch && currentMachine) {
      currentMachine.night = parseFloat(nightMatch[1]);
    } else if (!line.toLowerCase().includes('mtr')) {
      if (currentMachine) {
        currentMachine.total = (currentMachine.day || 0) + (currentMachine.night || 0);
        machines.push(currentMachine);
      }
      currentMachine = {
        name: line.replace(/\s+/g, ' ').trim(),
        day: 0,
        night: 0,
        total: 0
      };
    }
  }

  if (currentMachine) {
    currentMachine.total = (currentMachine.day || 0) + (currentMachine.night || 0);
    machines.push(currentMachine);
  }

  const grandTotal = machines.reduce((acc, m) => acc + m.total, 0);
  return { date, machines, grandTotal };
}

function renderResults(data) {
  document.getElementById('outputCard').style.display = 'block';
  document.getElementById('reportDate').innerText = data.date;

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  data.machines.forEach(m => {
    const row = `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td>${m.day}</td>
        <td>${m.night}</td>
        <td><strong>${m.total} mtr</strong></td>
      </tr>
    `;
    tbody.innerHTML += row;
  });

  document.getElementById('grandTotalCell').innerText = `${data.grandTotal} mtr`;
}
