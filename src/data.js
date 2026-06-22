/**
 * src/data.js - Lógica de Negócios e Dados de Teste (Versão 2.1)
 * Controle de Consumo de Água - Mamma Mia
 */

// --- CONFIGURAÇÃO E CONFIGS ADMINISTRATIVAS ---
const DEFAULT_SETTINGS = {
  metaIndividual: 20,
  metaGlobal: 80,
  alertThreshold: 75,
  leakThreshold: 3.0,
  // Novos parâmetros para Central de Alertas
  alertOsDiasAberta: 7,
  alertOsDiasAguardando: 3,
  alertPerdasLimite: 5,
  alertChecklistHoras: 12,
  hydrometers: {
    'Y21T156506': { id: 'Y21T156506', name: 'Cozinha Principal & Massas', alias: 'YUKA', color: '#3b82f6', unit: 'YUKA' },
    'A25LM0975882': { id: 'A25LM0975882', name: 'Salão & Banheiros', alias: 'PJ', color: '#10b981', unit: 'YUKA' },
    'A25LM0975883': { id: 'A25LM0975883', name: 'Produção & Fornos', alias: 'PJ', color: '#f59e0b', unit: 'YUKA' },
    'A25LM0975884': { id: 'A25LM0975884', name: 'Jardim, Calçada & Limpeza', alias: 'PJ', color: '#8b5cf6', unit: 'YUKA' }
  },
  units: ['YUKA']
};

export function getAppSettings() {
  const settingsStr = localStorage.getItem('mamma_mia_water_settings_v2');
  if (!settingsStr) {
    localStorage.setItem('mamma_mia_water_settings_v2', JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed = JSON.parse(settingsStr);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings) {
  localStorage.setItem('mamma_mia_water_settings_v2', JSON.stringify(settings));
}

export function getCycleInfo(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;

  if (day >= 7) {
    startYear = year;
    startMonth = month;
    endYear = month === 11 ? year + 1 : year;
    endMonth = month === 11 ? 0 : month + 1;
  } else {
    startYear = month === 0 ? year - 1 : year;
    startMonth = month === 0 ? 11 : month - 1;
    endYear = year;
    endMonth = month;
  }

  const start = new Date(startYear, startMonth, 7, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 6, 23, 59, 59, 999);

  const startLabel = start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  const endLabel = end.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  const label = `${startLabel.toUpperCase()} - ${endLabel.toUpperCase()}`;
  const key = `${startYear}-${String(startMonth + 1).padStart(2, '0')}`;

  return { start, end, label, key };
}

export function formatDate(dateStr, includeTime = false) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
  return date.toLocaleDateString('pt-BR', options);
}

export function checkDuplicateDayReading(readings, meterId, dateStr, excludeId = null) {
  const targetDate = new Date(dateStr);
  const targetDayKey = `${targetDate.getFullYear()}-${targetDate.getMonth()}-${targetDate.getDate()}`;
  return readings.some(r => {
    if (r.id === excludeId || r.meterId !== meterId) return false;
    const rDate = new Date(r.date);
    const rDayKey = `${rDate.getFullYear()}-${rDate.getMonth()}-${rDate.getDate()}`;
    return targetDayKey === rDayKey;
  });
}

export function initializeData() {
  const STORAGE_KEY = 'mamma_mia_water_readings_v2';
  let readings = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!readings || readings.length === 0) {
    readings = generateMockReadings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
  }
  return readings;
}

export function saveReadings(readings) {
  const STORAGE_KEY = 'mamma_mia_water_readings_v2';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
}

function generateMockReadings() {
  const list = [];
  const startDay = new Date(2026, 3, 6, 12, 0, 0);
  const endDay = new Date(); endDay.setHours(12, 0, 0, 0);

  const accumulators = {
    'Y21T156506': 1250.00,
    'A25LM0975882': 840.00,
    'A25LM0975883': 2110.00,
    'A25LM0975884': 450.00
  };

  Object.keys(accumulators).forEach(id => {
    list.push({ id: `mock-base-${id}`, meterId: id, date: new Date(startDay).toISOString(), index: accumulators[id], isInitial: true });
  });

  let currentDay = new Date(startDay);
  currentDay.setDate(currentDay.getDate() + 1);

  while (currentDay <= endDay) {
    const dayOfWeek = currentDay.getDay();
    let factor = 1.0;
    if (dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 5) factor = 1.45;
    else if (dayOfWeek === 1) factor = 0.50;

    Object.keys(accumulators).forEach(id => {
      let dailyBase = 0;
      switch (id) {
        case 'Y21T156506': dailyBase = 0.52; break;
        case 'A25LM0975882': dailyBase = 0.40; break;
        case 'A25LM0975883':
          const isMayCycle = currentDay >= new Date(2026, 4, 7) && currentDay <= new Date(2026, 5, 6);
          dailyBase = isMayCycle ? 0.78 : 0.55; break;
        case 'A25LM0975884': dailyBase = 0.22; break;
      }
      let isLeakDay = id === 'A25LM0975883' && currentDay.getDate() === 20 && currentDay.getMonth() === 4;
      const randomNoise = 0.85 + Math.random() * 0.30;
      const consumptionToday = isLeakDay ? 3.450 : Number((dailyBase * factor * randomNoise).toFixed(3));
      accumulators[id] = Number((accumulators[id] + consumptionToday).toFixed(3));
      list.push({ id: `mock-${id}-${currentDay.getTime()}`, meterId: id, date: new Date(currentDay).toISOString(), index: accumulators[id] });
    });
    currentDay.setDate(currentDay.getDate() + 1);
  }

  return list.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function calculateConsumptions(readings) {
  const sorted = [...readings].sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastIndices = {};
  const processed = sorted.map(reading => {
    const meterId = reading.meterId;
    let consumption = 0;
    if (reading.isInitial) { consumption = 0; }
    else if (lastIndices[meterId] !== undefined) {
      consumption = Number((reading.index - lastIndices[meterId]).toFixed(3));
      if (consumption < 0) consumption = 0;
    }
    lastIndices[meterId] = reading.index;
    return { ...reading, consumption };
  });
  return processed.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getCycleStats(readings, cycleKey) {
  const settings = getAppSettings();
  const processedReadings = calculateConsumptions(readings);
  let startCycleDate, endCycleDate, label;

  if (cycleKey === 'current') {
    const info = getCycleInfo(new Date());
    startCycleDate = info.start; endCycleDate = info.end; label = info.label; cycleKey = info.key;
  } else {
    const [year, month] = cycleKey.split('-').map(Number);
    const info = getCycleInfo(new Date(year, month - 1, 15));
    startCycleDate = info.start; endCycleDate = info.end; label = info.label;
  }

  const cycleReadings = processedReadings.filter(r => {
    const rDate = new Date(r.date);
    return rDate >= startCycleDate && rDate <= endCycleDate && !r.isInitial;
  });

  const totalDays = Math.ceil((endCycleDate - startCycleDate) / (1000 * 60 * 60 * 24));
  const today = new Date();
  const now = today > endCycleDate ? endCycleDate : (today < startCycleDate ? startCycleDate : today);
  const elapsedDays = Math.max(1, Math.ceil((now - startCycleDate) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, totalDays - elapsedDays);

  const metersData = {};
  Object.keys(settings.hydrometers).forEach(id => {
    metersData[id] = {
      ...settings.hydrometers[id], limit: settings.metaIndividual, consumption: 0, readingsCount: 0,
      minDate: null, maxDate: null, firstIndex: null, lastIndex: null,
      dailyGoal: Number((settings.metaIndividual / totalDays).toFixed(3)), hasLeak: false, operationalAlerts: []
    };
  });

  cycleReadings.forEach(r => {
    const id = r.meterId;
    if (metersData[id]) {
      metersData[id].consumption += r.consumption;
      metersData[id].readingsCount++;
      const rDate = new Date(r.date);
      if (!metersData[id].minDate || rDate < metersData[id].minDate) { metersData[id].minDate = rDate; metersData[id].firstIndex = r.index; }
      if (!metersData[id].maxDate || rDate > metersData[id].maxDate) { metersData[id].maxDate = rDate; metersData[id].lastIndex = r.index; }
      if (r.consumption > settings.leakThreshold) metersData[id].hasLeak = true;
    }
  });

  let alertMetersCount = 0;
  Object.keys(metersData).forEach(id => {
    const m = metersData[id];
    m.consumption = Number(m.consumption.toFixed(3));
    m.balance = Number((m.limit - m.consumption).toFixed(3));
    m.dailyAverage = elapsedDays > 0 ? Number((m.consumption / elapsedDays).toFixed(3)) : 0;
    m.projection = Number((m.consumption + (m.dailyAverage * remainingDays)).toFixed(3));
    m.percentUsed = Number(((m.consumption / m.limit) * 100).toFixed(1));
    const thresholdVal = m.limit * (settings.alertThreshold / 100);
    if (m.consumption > m.limit) { m.status = 'danger'; alertMetersCount++; }
    else if (m.consumption >= thresholdVal || m.projection > m.limit) { m.status = 'warning'; alertMetersCount++; }
    else { m.status = 'success'; }
    if (m.dailyAverage > m.dailyGoal) m.dailyGoalStatus = 'danger';
    else if (m.dailyAverage >= (m.dailyGoal * 0.9)) m.dailyGoalStatus = 'warning';
    else m.dailyGoalStatus = 'success';
    if (m.maxDate) {
      const hoursSinceLastReading = (today - new Date(m.maxDate)) / (1000 * 60 * 60);
      if (hoursSinceLastReading > 24) m.operationalAlerts.push('Atraso: Sem leituras registradas há mais de 24 horas.');
    } else {
      m.operationalAlerts.push('Atraso: Nenhuma leitura no ciclo atual.');
    }
    const meterReadings = cycleReadings.filter(r => r.meterId === id);
    meterReadings.forEach(r => {
      if (r.consumption > m.dailyAverage * 1.5 && r.consumption > 0.5) m.operationalAlerts.push(`Pico: Consumo de +${r.consumption} m³ em ${formatDate(r.date)} está acima da média.`);
      if (r.consumption > settings.leakThreshold) m.operationalAlerts.push(`Vazamento: Possível vazamento detectado em ${formatDate(r.date)} (Consumo: +${r.consumption} m³).`);
    });
  });

  const totalConsumption = Object.values(metersData).reduce((sum, m) => sum + m.consumption, 0);
  const totalProjection = Object.values(metersData).reduce((sum, m) => sum + m.projection, 0);
  const globalPercentUsed = Number(((totalConsumption / settings.metaGlobal) * 100).toFixed(1));
  const globalBalance = Number((settings.metaGlobal - totalConsumption).toFixed(3));
  const generalDailyAverage = elapsedDays > 0 ? Number((totalConsumption / elapsedDays).toFixed(3)) : 0;
  const projectedEconomy = Number((settings.metaGlobal - totalProjection).toFixed(3));

  let highestConsumer = { name: 'N/A', consumption: 0 };
  let lowestConsumer = { name: 'N/A', consumption: Infinity };
  Object.values(metersData).forEach(m => {
    if (m.consumption > highestConsumer.consumption) highestConsumer = { name: m.alias || m.id, consumption: m.consumption };
    if (m.consumption < lowestConsumer.consumption && m.consumption > 0) lowestConsumer = { name: m.alias || m.id, consumption: m.consumption };
  });
  if (lowestConsumer.consumption === Infinity) lowestConsumer = { name: 'N/A', consumption: 0 };

  const ranking = Object.values(metersData).sort((a, b) => a.percentUsed - b.percentUsed)
    .map((m, index) => ({ position: index + 1, id: m.id, name: m.name, alias: m.alias, percentUsed: m.percentUsed, consumption: m.consumption }));

  let globalStatus = 'success';
  if (totalConsumption > settings.metaGlobal) globalStatus = 'danger';
  else if (totalProjection > settings.metaGlobal || totalConsumption > (settings.metaGlobal * 0.8)) globalStatus = 'warning';

  return {
    cycleKey, label, startDate: startCycleDate, endDate: endCycleDate, totalDays, elapsedDays, remainingDays,
    meters: metersData, totalConsumption: Number(totalConsumption.toFixed(3)), totalProjection: Number(totalProjection.toFixed(3)),
    globalPercentUsed, globalBalance, globalStatus, alertMetersCount, readingsCount: cycleReadings.length,
    highestConsumer, lowestConsumer, generalDailyAverage, projectedEconomy, ranking, metaGlobal: settings.metaGlobal
  };
}

export function getAvailableCycles(readings) {
  const cycles = new Set();
  readings.forEach(r => {
    const date = new Date(r.date);
    if (!isNaN(date.getTime())) { const info = getCycleInfo(date); cycles.add(info.key); }
  });
  return Array.from(cycles).sort((a, b) => b.localeCompare(a));
}

export function compareCycles(readings, currentCycleKey, previousCycleKey) {
  const currentStats = getCycleStats(readings, currentCycleKey);
  if (!previousCycleKey) return { diff: 0, percentDiff: 0, isEconomy: true, meters: {}, prevLabel: 'N/A', currentLabel: currentStats.label };
  const prevStats = getCycleStats(readings, previousCycleKey);
  const diff = Number((currentStats.totalConsumption - prevStats.totalConsumption).toFixed(3));
  const percentDiff = prevStats.totalConsumption > 0 ? Number(((diff / prevStats.totalConsumption) * 100).toFixed(1)) : 0;
  const isEconomy = diff < 0;
  const metersComparison = {};
  const settings = getAppSettings();
  Object.keys(settings.hydrometers).forEach(id => {
    const currM = currentStats.meters[id] ? currentStats.meters[id].consumption : 0;
    const prevM = prevStats.meters[id] ? prevStats.meters[id].consumption : 0;
    const mDiff = Number((currM - prevM).toFixed(3));
    const mPercentDiff = prevM > 0 ? Number(((mDiff / prevM) * 100).toFixed(1)) : 0;
    metersComparison[id] = { current: currM, previous: prevM, diff: mDiff, percentDiff: mPercentDiff, isEconomy: mDiff < 0 };
  });
  return { diff: Math.abs(diff), percentDiff: Math.abs(percentDiff), isEconomy, meters: metersComparison, prevLabel: prevStats.label, currentLabel: currentStats.label, prevConsumption: prevStats.totalConsumption, currentConsumption: currentStats.totalConsumption };
}

export function parseCSV(csvText, existingReadings) {
  const settings = getAppSettings();
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) throw new Error('O arquivo CSV está vazio ou possui formato inválido.');
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date') || h.includes('time') || h.includes('timestamp'));
  const meterIdx = headers.findIndex(h => h.includes('hidrometro') || h.includes('hidrômetro') || h.includes('meter') || h.includes('id') || h.includes('dispositivo'));
  const valueIdx = headers.findIndex(h => h.includes('leitura') || h.includes('valor') || h.includes('index') || h.includes('acumulad'));
  const newReadings = [];
  const errors = [];
  const isSheetsColFormat = headers.some(h => Object.keys(settings.hydrometers).some(id => h.includes(id.toLowerCase())));

  if (isSheetsColFormat && dateIdx !== -1) {
    const meterColumns = {};
    Object.keys(settings.hydrometers).forEach(id => {
      const colIdx = headers.findIndex(h => h.includes(id.toLowerCase()));
      if (colIdx !== -1) meterColumns[id] = colIdx;
    });
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (columns.length <= dateIdx) continue;
      const rawDate = columns[dateIdx];
      let parsedDate = parseDateString(rawDate);
      if (!parsedDate) { errors.push(`Linha ${i + 1}: Data inválida "${rawDate}".`); continue; }
      Object.keys(meterColumns).forEach(meterId => {
        const colIdx = meterColumns[meterId];
        if (colIdx < columns.length && columns[colIdx]) {
          const rawValue = columns[colIdx];
          const cleanValue = rawValue.replace(',', '.');
          const parsedValue = parseFloat(cleanValue);
          if (!isNaN(parsedValue) && parsedValue >= 0) {
            newReadings.push({ id: `imported-${meterId}-${parsedDate.getTime()}-${Math.floor(Math.random() * 1000)}`, meterId, date: parsedDate.toISOString(), index: Number(parsedValue.toFixed(3)) });
          }
        }
      });
    }
  } else {
    if (dateIdx === -1 || meterIdx === -1 || valueIdx === -1) throw new Error('Formato de colunas inválido. O CSV deve conter colunas para Data, Hidrômetro e Leitura.');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (columns.length <= Math.max(dateIdx, meterIdx, valueIdx)) { errors.push(`Linha ${i + 1}: Colunas insuficientes.`); continue; }
      const rawDate = columns[dateIdx]; const rawMeter = columns[meterIdx]; const rawValue = columns[valueIdx];
      let matchedMeterId = null;
      const cleanMeterStr = rawMeter.toUpperCase().trim();
      if (settings.hydrometers[cleanMeterStr]) matchedMeterId = cleanMeterStr;
      else {
        const foundKey = Object.keys(settings.hydrometers).find(key => key.includes(cleanMeterStr) || settings.hydrometers[key].alias.toUpperCase().includes(cleanMeterStr) || settings.hydrometers[key].name.toUpperCase().includes(cleanMeterStr));
        if (foundKey) matchedMeterId = foundKey;
      }
      if (!matchedMeterId) { errors.push(`Linha ${i + 1}: Hidrômetro "${rawMeter}" não cadastrado.`); continue; }
      let parsedDate = parseDateString(rawDate);
      if (!parsedDate) { errors.push(`Linha ${i + 1}: Data inválida "${rawDate}".`); continue; }
      const cleanValue = rawValue.replace(',', '.');
      const parsedValue = parseFloat(cleanValue);
      if (isNaN(parsedValue) || parsedValue < 0) { errors.push(`Linha ${i + 1}: Leitura acumulada inválida "${rawValue}".`); continue; }
      newReadings.push({ id: `imported-${matchedMeterId}-${parsedDate.getTime()}-${Math.floor(Math.random() * 1000)}`, meterId: matchedMeterId, date: parsedDate.toISOString(), index: Number(parsedValue.toFixed(3)) });
    }
  }

  if (newReadings.length === 0) throw new Error('Nenhuma leitura válida pôde ser importada. Detalhes:\n' + errors.slice(0, 5).join('\n'));

  const mergedMap = new Map();
  existingReadings.forEach(r => {
    const rDate = new Date(r.date);
    const dayKey = `${r.meterId}-${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
    mergedMap.set(dayKey, r);
  });

  let countImported = 0; let countOverwritten = 0;
  newReadings.sort((a, b) => new Date(a.date) - new Date(b.date));
  newReadings.forEach(r => {
    const rDate = new Date(r.date);
    const dayKey = `${r.meterId}-${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
    if (mergedMap.has(dayKey)) {
      const existing = mergedMap.get(dayKey);
      if (existing.isInitial) return;
      countOverwritten++;
    } else { countImported++; }
    mergedMap.set(dayKey, r);
  });

  const mergedList = Array.from(mergedMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
  return { mergedReadings: mergedList, importedCount: countImported, overwrittenCount: countOverwritten, errorsCount: errors.length, errors: errors.slice(0, 10) };
}

function parseDateString(rawDate) {
  if (rawDate.includes('/')) {
    const parts = rawDate.split(' ');
    const dateParts = parts[0].split('/');
    let hour = 12, minute = 0, second = 0;
    if (parts[1]) { const timeParts = parts[1].split(':'); hour = parseInt(timeParts[0]) || 0; minute = parseInt(timeParts[1]) || 0; second = parseInt(timeParts[2]) || 0; }
    return new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), hour, minute, second);
  } else {
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? null : d;
  }
}
