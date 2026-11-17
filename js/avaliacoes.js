/**
 * avaliacoes.js
 * Avaliações do Google Meu Negócio (Varejocar/Vespor) respondidas por dia,
 * positivas e negativas, com totais e gráfico mensal (SVG, sem bibliotecas).
 */
function totaisAvaliacoesGoogle(lista) {
  lista = lista || ESTADO.avaliacoesGoogle || [];
  let positivas = 0, negativas = 0;
  const mes = mesAtualChave();
  let positivasMes = 0, negativasMes = 0;
  lista.forEach((a) => {
    const q = Number(a.quantidade) || 0;
    if (a.tipo === "positiva") { positivas += q; if (chaveMes(a.data) === mes) positivasMes += q; }
    else { negativas += q; if (chaveMes(a.data) === mes) negativasMes += q; }
  });
  return { positivas, negativas, positivasMes, negativasMes, total: positivas + negativas };
}

/** Últimos N meses (AAAA-MM) terminando no mês atual, com totais positiva/negativa. */
function avaliacoesPorMes(meses = 6, lista) {
  lista = lista || ESTADO.avaliacoesGoogle || [];
  const chaves = [];
  const hoje = new Date();
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    chaves.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return chaves.map((chave) => {
    let positiva = 0, negativa = 0;
    lista.forEach((a) => { if (chaveMes(a.data) === chave) { if (a.tipo === "positiva") positiva += Number(a.quantidade) || 0; else negativa += Number(a.quantidade) || 0; } });
    const [ano, mes] = chave.split("-").map(Number);
    return { chave, rotulo: nomeMesCurto(mes - 1), positiva, negativa };
  });
}

function renderizarGraficoAvaliacoes(alvoId, lista) {
  const alvo = document.getElementById(alvoId);
  if (!alvo) return;
  const dados = avaliacoesPorMes(6, lista);
  const maximo = Math.max(...dados.map((d) => Math.max(d.positiva, d.negativa)), 1) * 1.2;
  const L = 560, A = 90, margemE = 8, margemB = 20, margemT = 8;
  const areaA = A - margemB - margemT;
  const larguraGrupo = (L - margemE * 2) / dados.length;
  const y = (v) => margemT + areaA - (v / maximo) * areaA;

  const barras = dados.map((d, i) => {
    const xGrupo = margemE + i * larguraGrupo;
    const wBarra = larguraGrupo * 0.3;
    const xPos = xGrupo + larguraGrupo * 0.18;
    const xNeg = xGrupo + larguraGrupo * 0.52;
    const yPos = y(d.positiva), yNeg = y(d.negativa);
    return `
      <g>
        <title>${d.rotulo}: ${d.positiva} positivas, ${d.negativa} negativas</title>
        <rect x="${xPos.toFixed(1)}" y="${yPos.toFixed(1)}" width="${wBarra.toFixed(1)}" height="${Math.max(margemT + areaA - yPos, 0).toFixed(1)}" rx="3" fill="var(--cor-sucesso)" ${d.positiva === 0 ? 'style="opacity:.2"' : ""}></rect>
        <rect x="${xNeg.toFixed(1)}" y="${yNeg.toFixed(1)}" width="${wBarra.toFixed(1)}" height="${Math.max(margemT + areaA - yNeg, 0).toFixed(1)}" rx="3" fill="var(--cor-perigo)" ${d.negativa === 0 ? 'style="opacity:.2"' : ""}></rect>
        <text x="${(xGrupo + larguraGrupo / 2).toFixed(1)}" y="${A - 8}" text-anchor="middle" class="grafico-rotulo">${d.rotulo}</text>
      </g>`;
  }).join("");

  alvo.innerHTML = `
    <svg viewBox="0 0 ${L} ${A}" class="grafico-svg" role="img" aria-label="Avaliações do Google respondidas por mês">${barras}</svg>
    <p class="card-sub" style="margin:6px 0 0;"><span style="color:var(--cor-sucesso)">●</span> Positivas &nbsp; <span style="color:var(--cor-perigo)">●</span> Negativas</p>`;
}
