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
  const L = 560, A = 180, margemE = 8, margemB = 26, margemT = 14;
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

function renderizarPaginaAvaliacoes() {
  const alvo = document.getElementById("pagina-avaliacoes");
  if (!alvo) return;
  const t = totaisAvaliacoesGoogle();
  const lista = [...(ESTADO.avaliacoesGoogle || [])].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const recentes = lista.slice(0, 10);

  alvo.innerHTML = `
    <p class="card-sub" style="margin:0 0 12px;">Avaliações do Google Meu Negócio respondidas (cliente Vespor / Varejocar).</p>
    <div class="cards-resumo" style="grid-template-columns: repeat(3, 1fr); margin-bottom:16px;">
      <div class="card"><span class="card-label">Positivas respondidas</span><span class="card-valor" style="color:var(--cor-sucesso)">${t.positivas}</span><span class="card-sub">${t.positivasMes} neste mês</span></div>
      <div class="card"><span class="card-label">Negativas respondidas</span><span class="card-valor" style="color:var(--cor-perigo)">${t.negativas}</span><span class="card-sub">${t.negativasMes} neste mês</span></div>
      <div class="card"><span class="card-label">Registrar avaliações de hoje</span>
        <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
          <input id="av-cliente" placeholder="Cliente" value="Vespor" style="width:100px;">
          <input type="date" id="av-data" value="${hojeISO()}" style="flex:1; min-width:110px;">
          <input type="number" id="av-positivas" placeholder="Positivas" min="0" style="width:90px;">
          <input type="number" id="av-negativas" placeholder="Negativas" min="0" style="width:90px;">
          <button class="botao pequeno" id="av-add">+</button>
        </div>
      </div>
    </div>
    <div class="painel-grafico-funil" style="margin-bottom:16px;">
      <h3>Evolução mensal</h3>
      <div id="grafico-avaliacoes"></div>
    </div>
    <h4 style="margin:12px 0 6px;">Últimos registros</h4>
    <ul class="demanda-lista">${recentes.map((a) => `<li class="demanda-item"><span class="selo ${a.tipo === "positiva" ? "aceito" : "atrasado"}">${a.tipo === "positiva" ? "Positiva" : "Negativa"}</span><span class="demanda-titulo">${a.quantidade} avaliaç${a.quantidade === 1 ? "ão" : "ões"}</span><span class="card-sub">${formatarDataBR(a.data)}</span></li>`).join("") || `<li class="demanda-item" style="color:var(--cor-texto-suave)">Nenhum registro ainda.</li>`}</ul>`;

  renderizarGraficoAvaliacoes("grafico-avaliacoes");

  document.getElementById("av-add").addEventListener("click", () => {
    const cliente = document.getElementById("av-cliente").value.trim() || "Vespor";
    const data = document.getElementById("av-data").value || hojeISO();
    const pos = Math.max(parseInt(document.getElementById("av-positivas").value, 10) || 0, 0);
    const neg = Math.max(parseInt(document.getElementById("av-negativas").value, 10) || 0, 0);
    if (pos <= 0 && neg <= 0) { alert("Informe ao menos uma quantidade."); return; }
    atualizarEstado((e) => {
      if (pos > 0) e.avaliacoesGoogle.push({ id: gerarId(), data, tipo: "positiva", quantidade: pos, cliente });
      if (neg > 0) e.avaliacoesGoogle.push({ id: gerarId(), data, tipo: "negativa", quantidade: neg, cliente });
    });
    renderizarPaginaAvaliacoes();
  });
}
