/**
 * src/chart-setup.js - Gerenciamento dos Gráficos Analíticos
 * Utiliza a biblioteca Chart.js via CDN
 */

import { getAppSettings } from './data.js';

let trendChartInstance = null;
let comparisonChartInstance = null;

function setupChartGlobals() {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.tooltip.backgroundColor = '#0e1326';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#f3f4f6';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.08)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
  }
}

export function renderTrendChart(canvas, cycleStats, processedReadings) {
  if (!canvas) return;
  setupChartGlobals();
  
  if (typeof Chart === 'undefined') {
    canvas.parentElement.innerHTML = '<div style="color: var(--color-red); padding: 20px; text-align: center;">Erro: Não foi possível carregar a biblioteca de gráficos (Chart.js). Verifique sua conexão.</div>';
    return;
  }

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  const { startDate, endDate, totalDays } = cycleStats;
  const settings = getAppSettings();
  const hydrometers = settings.hydrometers;

  const labels = [];
  const cycleDates = [];
  let tempDate = new Date(startDate);
  
  for (let i = 0; i < totalDays; i++) {
    labels.push(tempDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    cycleDates.push(new Date(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }

  const datasets = Object.keys(hydrometers).map(meterId => {
    const meter = hydrometers[meterId];
    const dataPoints = [];

    const meterReadings = processedReadings
      .filter(r => r.meterId === meterId && !r.isInitial && new Date(r.date) >= startDate && new Date(r.date) <= endDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    cycleDates.forEach(date => {
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const sum = meterReadings
        .filter(r => new Date(r.date) <= dayEnd)
        .reduce((total, r) => total + r.consumption, 0);

      if (date <= today) {
        dataPoints.push(Number(sum.toFixed(3)));
      } else {
        dataPoints.push(null);
      }
    });

    return {
      label: meterId,
      data: dataPoints,
      borderColor: meter.color,
      backgroundColor: meter.color + '10',
      borderWidth: 3,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.2,
      spanGaps: true
    };
  });

  datasets.push({
    label: 'Meta (20 m³)',
    data: Array(totalDays).fill(20),
    borderColor: 'rgba(239, 68, 68, 0.6)',
    borderWidth: 2,
    borderDash: [6, 6],
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    order: -1
  });

  const ctx = canvas.getContext('2d');
  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 12, font: { weight: '600' } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) label += context.parsed.y.toFixed(3) + ' m³';
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.02)' },
          ticks: { maxRotation: 45, minRotation: 45 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          title: { display: true, text: 'Volume Acumulado (m³)', font: { weight: '600' } },
          suggestedMax: 22
        }
      }
    }
  });
}

export function renderComparisonChart(canvas, currentStats, prevStats) {
  if (!canvas) return;
  setupChartGlobals();
  
  if (typeof Chart === 'undefined') return;

  if (comparisonChartInstance) {
    comparisonChartInstance.destroy();
  }

  const settings = getAppSettings();
  const hydrometers = settings.hydrometers;

  const labels = Object.keys(hydrometers);
  const currentData = [];
  const prevData = [];

  labels.forEach(id => {
    currentData.push(currentStats.meters[id] ? currentStats.meters[id].consumption : 0);
    prevData.push(prevStats && prevStats.meters[id] ? prevStats.meters[id].consumption : 0);
  });

  const datasets = [];
  
  if (prevStats) {
    datasets.push({
      label: `Ciclo Anterior (${prevStats.label})`,
      data: prevData,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      borderRadius: 4
    });
  }

  datasets.push({
    label: `Ciclo Atual (${currentStats.label})`,
    data: currentData,
    backgroundColor: Object.values(hydrometers).map(m => m.color),
    borderRadius: 4
  });

  const ctx = canvas.getContext('2d');
  comparisonChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(id => `${id} (${hydrometers[id].alias || hydrometers[id].name.split(' ')[0]})`),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 12, font: { weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(3)} m³`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          title: { display: true, text: 'Consumo (m³)', font: { weight: '600' } },
          suggestedMax: 22
        }
      }
    }
  });
}
