const data = window.DASHBOARD_DATA;
const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
const number = value => new Intl.NumberFormat("pt-BR").format(value || 0);
const percent = value => new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0);
const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
const option = (value, label = value) => `<option value="${value}">${label}</option>`;

function init() {
  $("updatedAt").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.generatedAt));
  const months = [...new Map(data.finance.map(row => [row.month, row.label])).entries()];
  $("monthFilter").innerHTML = months.map(([value, label]) => option(value, label)).join("");
  $("monthFilter").value = months.at(-1)[0];
  const lotOptions = option("all", "Todos") + data.lots.map(lot => option(lot)).join("");
  $("financeLotFilter").innerHTML = lotOptions;
  const thirdLots = [...new Set([...data.contractors.byLot, ...data.select.byLot].map(row => row.lot))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  $("thirdPartyLotFilter").innerHTML = option("all", "Todos") + thirdLots.map(lot => option(lot)).join("");
  $("statusFilter").addEventListener("change", renderWorkforce);
  $("monthFilter").addEventListener("change", renderFinance);
  $("financeLotFilter").addEventListener("change", renderFinance);
  $("thirdPartyLotFilter").addEventListener("change", renderThirdParties);
  renderWorkforce(); renderFinance(); renderThirdParties();
}

function renderWorkforce() {
  const status = $("statusFilter").value;
  const active = Object.values(data.workforce).reduce((total, lot) => total + lot.active, 0);
  const inactive = Object.values(data.workforce).reduce((total, lot) => total + lot.inactive, 0);
  const valueFor = lot => status === "all" ? lot.active + lot.inactive : lot[status];
  $("activeTotal").textContent = number(active); $("inactiveTotal").textContent = number(inactive);
  $("workforceTotal").textContent = number(Object.values(data.workforce).reduce((total, lot) => total + valueFor(lot), 0));
  $("workforceLabel").textContent = status === "active" ? "Funcionários ativos" : status === "inactive" ? "Funcionários inativos" : "Ativos + inativos";
  $("lotCards").innerHTML = data.lots.map(lot => `<article class="lot-card"><h3>${lot}</h3><strong>${number(valueFor(data.workforce[lot]))}</strong><span>${$("workforceLabel").textContent}</span></article>`).join("");
}

function financeRows(month, lot = "all") { return data.finance.filter(row => row.month === month && (lot === "all" || row.lot === lot)); }
function turnoverRows(month, lot = "all") { return data.turnover.filter(row => row.month === month && (lot === "all" || row.lot === lot)); }

function renderFinance() {
  const month = $("monthFilter").value; const lot = $("financeLotFilter").value;
  const selected = financeRows(month, lot);
  const turnoverSelected = turnoverRows(month, lot);
  const averageHeadcount = sum(turnoverSelected, "averageHeadcount");
  const dismissals = sum(turnoverSelected, "dismissals");
  const accumulatedAverageHeadcount = sum(turnoverSelected, "accumulatedAverageHeadcount");
  const accumulatedDismissals = sum(turnoverSelected, "accumulatedDismissals");
  $("salaryMetric").textContent = money(sum(selected, "salary"));
  $("overtimeMetric").textContent = money(sum(selected, "overtime"));
  $("dsrMetric").textContent = money(sum(selected, "dsr"));
  $("monthTotalMetric").textContent = money(sum(selected, "total"));
  $("accumulatedMetric").textContent = money(sum(data.finance.filter(row => row.month <= month && (lot === "all" || row.lot === lot)), "total"));
  $("admissionMetric").textContent = number(sum(turnoverSelected, "admissions"));
  $("dismissalMetric").textContent = number(dismissals);
  $("turnoverMetric").textContent = percent(averageHeadcount ? dismissals / averageHeadcount : 0);
  const label = $("monthFilter").selectedOptions[0].textContent;
  $("tableCaption").textContent = label;
  $("turnoverCaption").textContent = lot === "all" ? `Até ${label}` : `Até ${label} · ${lot}`;
  $("financeTable").innerHTML = data.lots.map(name => {
    const row = financeRows(month, name)[0] || {};
    const hidden = lot !== "all" && lot !== name;
    return `<tr${hidden ? ' style="opacity:.25"' : ""}><td>${name}</td><td>${money(row.salary)}</td><td>${money(row.overtime)}</td><td>${money(row.dsr)}</td><td><strong>${money(row.total)}</strong></td></tr>`;
  }).join("");
  const turnoverRowsHtml = data.lots.map(name => {
    const row = turnoverRows(month, name)[0] || {};
    const hidden = lot !== "all" && lot !== name;
    return `<tr${hidden ? ' style="opacity:.25"' : ""}><td>${name}</td><td>${number(row.accumulatedStartHeadcount)}</td><td>${number(row.accumulatedEndHeadcount)}</td><td>${number(row.accumulatedDismissals)}</td><td>${number(row.accumulatedAverageHeadcount)}</td><td><strong>${percent(row.accumulatedTurnoverRate)}</strong></td><td>${percent(row.accumulatedProportional)}</td></tr>`;
  }).join("");
  const totalRate = accumulatedAverageHeadcount ? accumulatedDismissals / accumulatedAverageHeadcount : 0;
  $("turnoverTable").innerHTML = `${turnoverRowsHtml}<tr><td><strong>Total</strong></td><td><strong>${number(sum(turnoverSelected, "accumulatedStartHeadcount"))}</strong></td><td><strong>${number(sum(turnoverSelected, "accumulatedEndHeadcount"))}</strong></td><td><strong>${number(accumulatedDismissals)}</strong></td><td><strong>${number(accumulatedAverageHeadcount)}</strong></td><td><strong>${percent(totalRate)}</strong></td><td><strong>${percent(sum(turnoverSelected, "accumulatedProportional"))}</strong></td></tr>`;
  renderFinanceChart(lot);
}

function renderFinanceChart(lot) {
  const months = [...new Map(data.finance.map(row => [row.month, row.label])).entries()];
  const values = months.map(([month]) => sum(financeRows(month, lot), "total"));
  const max = Math.max(...values, 1); const width = 780; const height = 280; const pad = { left: 54, right: 18, top: 18, bottom: 42 };
  const x = index => pad.left + index * ((width - pad.left - pad.right) / Math.max(values.length - 1, 1));
  const y = value => height - pad.bottom - value / max * (height - pad.top - pad.bottom);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = `${pad.left},${height-pad.bottom} ${points} ${x(values.length-1)},${height-pad.bottom}`;
  const grid = [0,.25,.5,.75,1].map(f => `<line class="chart-grid" x1="${pad.left}" y1="${y(max*f)}" x2="${width-pad.right}" y2="${y(max*f)}"/><text class="axis-label" x="${pad.left-8}" y="${y(max*f)+4}" text-anchor="end">${number(Math.round(max*f/1000))} mil</text>`).join("");
  const labels = months.map(([key,label], index) => index % 2 === 0 || index === months.length - 1 ? `<text class="axis-label" x="${x(index)}" y="${height-15}" text-anchor="middle">${label}</text>` : "").join("");
  const circles = values.map((value,index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="4"><title>${months[index][1]}: ${money(value)}</title></circle>`).join("");
  $("financeChart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img">${grid}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${points}"/>${circles}${labels}</svg>`;
  $("chartCaption").textContent = lot === "all" ? "Todos os lotes" : lot;
}

function filtered(rows, lot) { return lot === "all" ? rows : rows.filter(row => row.lot === lot); }
function renderBars(target, rows) {
  const max = Math.max(...rows.map(row => row.people), 1);
  $(target).innerHTML = rows.length ? rows.map(row => `<div class="bar-row"><strong>${row.lot}</strong><div class="bar-track"><div class="bar-fill" style="width:${row.people/max*100}%"></div></div><span class="bar-value">${row.people} | ${money(row.cost)}</span></div>`).join("") : `<p class="empty">Sem registros neste lote.</p>`;
}

function renderThirdParties() {
  const lot = $("thirdPartyLotFilter").value;
  const contractorLots = filtered(data.contractors.byLot, lot); const companies = filtered(data.contractors.companies, lot); const selectLots = filtered(data.select.byLot, lot);
  $("contractorPeople").textContent = number(sum(contractorLots, "people"));
  $("contractorCompanies").textContent = number(new Set(companies.map(row => row.company)).size);
  $("contractorCost").textContent = money(sum(contractorLots, "cost"));
  $("selectPeople").textContent = number(sum(selectLots, "people")); $("selectCost").textContent = money(sum(selectLots, "cost"));
  renderBars("contractorBars", contractorLots); renderBars("selectBars", selectLots);
  $("companyCaption").textContent = lot === "all" ? "Todos os lotes" : lot;
  $("companyList").innerHTML = companies.length ? companies.map(row => `<div class="company-item"><strong>${row.company}</strong><span>${row.lot} · ${row.people} pessoas · ${money(row.cost)}</span></div>`).join("") : `<p>Sem empreiteiras neste lote.</p>`;
}

init();
