/**
 * grafico.js
 * Gráfico de barras do faturamento mensal (SVG, sem bibliotecas), com linha de meta.
 */

function renderizarGraficoFaturamento() {
  const alvo = document.getElementById("painel-grafico-faturamento");
  if (!alvo) return;

  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth();
  const valores = faturamentoPorMes(ano);
  const meta = Number(ESTADO.configuracoes.metaMensal || 0);
  const maximo = Math.max(...valores, meta, 1) * 1.15;

  const L = 560, A = 220, margemE = 8, margemB = 26, margemT = 14;
  const areaA = A - margemB - margemT;
  const larguraBarra = (L - margemE * 2) / 12;
  const y = (v) => margemT + areaA - (v / maximo) * areaA;

  const barras = valores.map((v, i) => {
    const x = margemE + i * larguraBarra + larguraBarra * 0.16;
    const w = larguraBarra * 0.68;
    const yTopo = y(v);
    const h = margemT + areaA - yTopo;
    const atual = i === mesAtual;
    return `
      <g>
        <title>${nomeMesCurto(i)}: ${formatarMoeda(v)}</title>
        <rect x="${x.toFixed(1)}" y="${yTopo.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="4"
              class="${atual ? "barra-mes atual" : "barra-mes"}" ${v === 0 ? 'style="opacity:.25"' : ""}></rect>
        <text x="${(x + w / 2).toFixed(1)}" y="${A - 8}" text-anchor="middle" class="grafico-rotulo">${nomeMesCurto(i)}</text>
      </g>`;
  }).join("");

  const linhaMeta = meta > 0
    ? `<line x1="0" x2="${L}" y1="${y(meta).toFixed(1)}" y2="${y(meta).toFixed(1)}" class="linha-meta"></line>
       <text x="${L - 4}" y="${(y(meta) - 5).toFixed(1)}" text-anchor="end" class="grafico-rotulo meta">Meta ${formatarMoeda(meta)}</text>`
    : "";

  const total = valores.reduce((a, b) => a + b, 0);
  const limite = Number(ESTADO.configuracoes.limiteMeiAnual || 81000);

  alvo.innerHTML = `
    <svg viewBox="0 0 ${L} ${A}" class="grafico-svg" role="img" aria-label="Faturamento mensal de ${ano}">
      ${linhaMeta}
      ${barras}
    </svg>
    <p class="card-sub" style="margin:8px 0 0;">
      ${ano}: ${formatarMoeda(total)} faturados (${((total / limite) * 100).toFixed(1)}% do limite MEI).
      ${meta > 0 ? "" : "Defina uma meta mensal em Configurações para ver a linha de meta."}
    </p>`;
}
