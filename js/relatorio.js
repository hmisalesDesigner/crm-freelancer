/**
 * relatorio.js
 * Relatório do cliente em formato de apresentação (slides em A4 paisagem): mensal ou retrospectiva do ano.
 * Abre numa nova aba com "Imprimir / Salvar PDF" e "Baixar arquivo" (HTML único, pode ser enviado ou hospedado).
 * Usa as atividades concluídas, as avaliações do Google e as campanhas marcadas em cada atividade.
 * Não mostra valores em dinheiro: é um relatório de entregas para o cliente.
 */
const NOMES_MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function _esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _limpaTitulo(t) { return String(t || "").replace(/^[•\s-]+/, "").trim(); }

/** Dados do período: tipo "mes" (chave AAAA-MM) ou "ano" (chave AAAA). */
function dadosRelatorioCliente(cliente, tipo, chave) {
  const cats = Object.keys(CATEGORIA_DEMANDA);
  const doPeriodo = (data) => data && String(data).startsWith(chave);
  const atividades = demandasDoCliente(cliente).filter((d) => d.status === "concluida" && doPeriodo(d.data)).sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const porCat = {}; cats.forEach((c) => (porCat[c] = 0));
  atividades.forEach((d) => { if (porCat[d.categoria] != null) porCat[d.categoria]++; });
  const unidades = tipo === "mes"
    ? Array.from({ length: new Date(Number(chave.slice(0, 4)), Number(chave.slice(5, 7)), 0).getDate() }, (_, i) => ({ rotulo: String(i + 1), chave: `${chave}-${String(i + 1).padStart(2, "0")}` }))
    : NOMES_MES_LONGO.map((_, i) => ({ rotulo: nomeMesCurto(i), chave: `${chave}-${String(i + 1).padStart(2, "0")}` }));
  const serie = unidades.map((u) => {
    const o = { rotulo: u.rotulo, total: 0 }; cats.forEach((c) => (o[c] = 0));
    atividades.forEach((d) => { if (String(d.data).startsWith(u.chave)) { o.total++; if (o[d.categoria] != null) o[d.categoria]++; } });
    return o;
  });
  const dias = new Set(atividades.map((d) => d.data));
  const campanhas = {};
  atividades.forEach((d) => {
    const nome = (d.campanha || "").trim(); if (!nome) return;
    campanhas[nome] = campanhas[nome] || { total: 0, porCat: {} };
    campanhas[nome].total++; campanhas[nome].porCat[d.categoria || "Outros"] = (campanhas[nome].porCat[d.categoria || "Outros"] || 0) + 1;
  });
  const aval = avaliacoesDoCliente(cliente).filter((a) => doPeriodo(a.data));
  const avalSerie = unidades.map((u) => {
    const o = { rotulo: u.rotulo, positiva: 0, negativa: 0 };
    aval.forEach((a) => { if (String(a.data).startsWith(u.chave)) o[a.tipo === "positiva" ? "positiva" : "negativa"] += Number(a.quantidade) || 0; });
    return o;
  });
  const avalTot = { positivas: avalSerie.reduce((s, x) => s + x.positiva, 0), negativas: avalSerie.reduce((s, x) => s + x.negativa, 0) };
  const destaques = ((cliente.destaques || {})[chave] || "").trim();
  return { cats, atividades, porCat, serie, dias: dias.size, campanhas, avalSerie, avalTot, destaques, total: atividades.length };
}

function _graficoBarrasEmpilhadas(serie, cats, altura = 380) {
  const L = 960, mE = 34, mB = 26, mT = 14, A = altura, areaA = A - mB - mT;
  const max = Math.max(...serie.map((s) => s.total), 1);
  const w = (L - mE - 8) / serie.length;
  const passo = Math.max(1, Math.ceil(max / 5));
  let grade = "";
  for (let v = 0; v <= max; v += passo) { const y = mT + areaA - (v / max) * areaA; grade += `<line x1="${mE}" x2="${L}" y1="${y}" y2="${y}" stroke="#e5e7eb"/><text x="${mE - 6}" y="${y + 4}" text-anchor="end" class="eix">${v}</text>`; }
  const barras = serie.map((s, i) => {
    let yAcum = mT + areaA; const x = mE + i * w + w * 0.15;
    const segs = cats.map((c) => { const h = (s[c] / max) * areaA; yAcum -= h; return h > 0 ? `<rect x="${x.toFixed(1)}" y="${yAcum.toFixed(1)}" width="${(w * 0.7).toFixed(1)}" height="${h.toFixed(1)}" fill="${CATEGORIA_DEMANDA[c].corRel}"><title>${s.rotulo} · ${c}: ${s[c]}</title></rect>` : ""; }).join("");
    const topo = s.total > 0 ? `<text x="${(x + w * 0.35).toFixed(1)}" y="${(yAcum - 4).toFixed(1)}" text-anchor="middle" class="val">${s.total}</text>` : "";
    return `${segs}${topo}<text x="${(x + w * 0.35).toFixed(1)}" y="${A - 8}" text-anchor="middle" class="eix">${s.rotulo}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${L} ${A}" class="graf">${grade}${barras}</svg>`;
}

function _graficoAvaliacoes(serie, altura = 300) {
  const L = 960, mE = 34, mB = 26, mT = 14, A = altura, areaA = A - mB - mT;
  const max = Math.max(...serie.map((s) => Math.max(s.positiva, s.negativa)), 1);
  const w = (L - mE - 8) / serie.length;
  const barras = serie.map((s, i) => {
    const x = mE + i * w; const hp = (s.positiva / max) * areaA, hn = (s.negativa / max) * areaA;
    return `<rect x="${(x + w * 0.12).toFixed(1)}" y="${(mT + areaA - hp).toFixed(1)}" width="${(w * 0.36).toFixed(1)}" height="${hp.toFixed(1)}" fill="#2f9e44"><title>${s.rotulo}: ${s.positiva} positivas</title></rect>
      <rect x="${(x + w * 0.52).toFixed(1)}" y="${(mT + areaA - hn).toFixed(1)}" width="${(w * 0.36).toFixed(1)}" height="${hn.toFixed(1)}" fill="#e03131"><title>${s.rotulo}: ${s.negativa} negativas</title></rect>
      ${s.positiva ? `<text x="${(x + w * 0.3).toFixed(1)}" y="${(mT + areaA - hp - 4).toFixed(1)}" text-anchor="middle" class="val">${s.positiva}</text>` : ""}
      <text x="${(x + w / 2).toFixed(1)}" y="${A - 8}" text-anchor="middle" class="eix">${s.rotulo}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${L} ${A}" class="graf"><line x1="${mE}" x2="${L}" y1="${mT + areaA}" y2="${mT + areaA}" stroke="#cbd5e1"/>${barras}</svg>`;
}

const CORES_REL = { "Arte": "#7048e8", "Vídeo/Áudio": "#f76707", "Suporte": "#1c7ed6", "Revisão": "#2f9e44" };
Object.keys(CORES_REL).forEach((c) => { CATEGORIA_DEMANDA[c].corRel = CORES_REL[c]; });

function htmlRelatorioCliente(cliente, tipo, chave) {
  const d = dadosRelatorioCliente(cliente, tipo, chave);
  const autor = _esc(ESTADO.configuracoes.nomeProfissional || "Henrique Designer e Editor de vídeos");
  const ano = chave.slice(0, 4);
  const periodo = tipo === "mes" ? `${NOMES_MES_LONGO[Number(chave.slice(5, 7)) - 1]} de ${ano}` : ano;
  const titulo = tipo === "mes" ? `Relatório de ${periodo}` : `Retrospectiva ${ano}`;
  const unidade = tipo === "mes" ? "dia" : "mês";
  const legenda = d.cats.map((c) => `<span><i style="background:${CORES_REL[c]}"></i>${c}</span>`).join("");
  const lerNum = (c) => d.porCat[c] || 0;

  const kpis = [
    ["Atividades concluídas", d.total],
    ...d.cats.map((c) => [c === "Arte" ? "Artes" : c === "Vídeo/Áudio" ? "Vídeo e áudio" : c === "Suporte" ? "Suporte e operação" : "Revisões e ajustes", lerNum(c)]),
    [tipo === "mes" ? "Dias com entregas" : "Dias com entregas no ano", d.dias],
  ];
  const melhor = d.serie.reduce((m, s) => (s.total > m.total ? s : m), { total: -1, rotulo: "" });
  const slides = [];

  slides.push(`<section class="slide capa"><div class="marca">${_esc(cliente.nome)}</div><h1>${titulo}</h1><p class="sub">${tipo === "mes" ? "O que foi feito neste mês" : "Um ano de trabalho em números"}</p><p class="autor">${autor}</p></section>`);

  slides.push(`<section class="slide"><h2>${tipo === "mes" ? "O mês em números" : "O ano em números"}</h2>
    <div class="kpis">${kpis.map(([r, v], i) => `<div class="kpi ${i === 0 ? "destaque" : ""}"><b>${v}</b><span>${r}</span></div>`).join("")}</div>
    ${d.total ? `<p class="frase">${tipo === "mes" ? "Foram" : "Ao longo do ano foram"} <b>${d.total} atividades</b> entregues em <b>${d.dias} dias</b>${melhor.total > 0 ? `, com pico ${tipo === "mes" ? "no dia" : "em"} <b>${melhor.rotulo}</b> (${melhor.total}).` : "."}</p>` : `<p class="frase">Nenhuma atividade concluída registrada neste período.</p>`}</section>`);

  if (d.total) slides.push(`<section class="slide"><h2>Atividades por ${unidade}</h2>${_graficoBarrasEmpilhadas(d.serie, d.cats)}<div class="leg">${legenda}</div></section>`);

  const nomesCamp = Object.keys(d.campanhas).sort((a, b) => d.campanhas[b].total - d.campanhas[a].total);
  if (nomesCamp.length || d.destaques) {
    slides.push(`<section class="slide"><h2>Campanhas e destaques</h2>
      ${nomesCamp.length ? `<div class="camps">${nomesCamp.map((n) => `<div class="camp"><h3>${_esc(n)}</h3><p>${Object.entries(d.campanhas[n].porCat).map(([c, q]) => `<b>${q}</b> ${_esc(c === "Arte" ? (q > 1 ? "artes" : "arte") : c === "Vídeo/Áudio" ? "vídeo/áudio" : c === "Suporte" ? "suporte" : c === "Revisão" ? (q > 1 ? "revisões" : "revisão") : c)}`).join(" · ")}</p></div>`).join("")}</div>` : ""}
      ${d.destaques ? `<div class="destaques">${_esc(d.destaques).replace(/\n/g, "<br>")}</div>` : ""}</section>`);
  }

  if (d.avalTot.positivas + d.avalTot.negativas > 0) {
    slides.push(`<section class="slide"><h2>Avaliações do Google respondidas</h2>
      <div class="kpis duplo"><div class="kpi ok"><b>${d.avalTot.positivas}</b><span>positivas respondidas</span></div><div class="kpi ruim"><b>${d.avalTot.negativas}</b><span>negativas tratadas</span></div></div>
      ${_graficoAvaliacoes(d.avalSerie)}<div class="leg"><span><i style="background:#2f9e44"></i>Positivas</span><span><i style="background:#e03131"></i>Negativas</span></div></section>`);
  }

  // Principais entregas, agrupadas por categoria (pedaços de 12 por slide)
  d.cats.forEach((c) => {
    const itens = d.atividades.filter((x) => x.categoria === c);
    for (let i = 0; i < itens.length; i += 12) {
      slides.push(`<section class="slide"><h2><i class="bola" style="background:${CORES_REL[c]}"></i>${c} <small>${itens.length} no período${itens.length > 12 ? ` · ${i / 12 + 1}/${Math.ceil(itens.length / 12)}` : ""}</small></h2>
        <ul class="entregas">${itens.slice(i, i + 12).map((x) => `<li><time>${formatarDataBR(x.data).slice(0, 5)}</time>${_esc(_limpaTitulo(x.titulo).slice(0, 170))}</li>`).join("")}</ul></section>`);
    }
  });

  slides.push(`<section class="slide capa fim"><h1>Obrigado!</h1><p class="sub">${autor}</p></section>`);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${_esc(cliente.nome)} – ${titulo}</title><style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; } body { margin: 0; background: #e5e7eb; font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #1f2937; }
  .barra { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; justify-content: center; padding: 10px; background: #111827; }
  .barra button { background: #f59e0b; border: 0; border-radius: 8px; padding: 9px 16px; font-weight: 700; cursor: pointer; } .barra button.sec { background: #374151; color: #fff; }
  .slide { width: 297mm; height: 210mm; margin: 14px auto; background: #fff; padding: 16mm 18mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; box-shadow: 0 2px 12px #0003; }
  .slide h2 { margin: 0 0 8mm; font-size: 26px; border-left: 6px solid #f59e0b; padding-left: 12px; } .slide h2 small { font-size: 14px; color: #6b7280; font-weight: 500; margin-left: 8px; }
  .bola { display: inline-block; width: 14px; height: 14px; border-radius: 50%; margin-right: 8px; }
  .capa { background: linear-gradient(135deg, #111827, #1e3a8a); color: #fff; display: flex; flex-direction: column; justify-content: center; } .capa h1 { font-size: 54px; margin: 6px 0; } .capa .marca { font-size: 20px; letter-spacing: 3px; text-transform: uppercase; color: #fbbf24; } .capa .sub { font-size: 22px; opacity: .85; } .capa .autor { position: absolute; bottom: 16mm; left: 18mm; opacity: .7; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; } .kpis.duplo { grid-template-columns: 1fr 1fr; margin-bottom: 8mm; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; } .kpi b { display: block; font-size: 44px; line-height: 1; } .kpi span { color: #6b7280; font-size: 15px; } .kpi.destaque { background: #fffbeb; border-color: #f59e0b; } .kpi.ok b { color: #2f9e44; } .kpi.ruim b { color: #e03131; }
  .frase { font-size: 20px; margin-top: 10mm; } .graf { width: 100%; height: auto; } .graf .eix { font-size: 11px; fill: #6b7280; } .graf .val { font-size: 11px; font-weight: 700; fill: #111827; }
  .leg { display: flex; gap: 16px; justify-content: center; margin-top: 8px; font-size: 14px; } .leg i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; }
  .camps { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; } .camp { background: #f5f3ff; border-radius: 12px; padding: 14px 18px; } .camp h3 { margin: 0 0 6px; } .camp p { margin: 0; font-size: 17px; }
  .destaques { margin-top: 8mm; font-size: 18px; line-height: 1.6; white-space: normal; }
  .entregas { list-style: none; padding: 0; margin: 0; } .entregas li { padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px; display: flex; gap: 12px; } .entregas time { color: #6b7280; min-width: 46px; font-variant-numeric: tabular-nums; }
  @media print { body { background: #fff; } .barra { display: none; } .slide { margin: 0; box-shadow: none; } }
  </style></head><body><div class="barra"><button onclick="window.print()">Imprimir / Salvar como PDF</button><button class="sec" id="baixar">Baixar arquivo</button></div>${slides.join("")}
  <script>document.getElementById("baixar").onclick=function(){var h="<!doctype html>"+document.documentElement.outerHTML.replace(/<div class="barra">[\\s\\S]*?<\\/div>/,"").replace(/<script>[\\s\\S]*?<\\/script>/,"");var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([h],{type:"text/html"}));a.download="${_esc(cliente.nome).replace(/\W+/g, "-")}-${chave}.html";a.click();};<\/script></body></html>`;
}

function abrirRelatorioCliente(cliente, tipo, chave) {
  const html = htmlRelatorioCliente(cliente, tipo, chave);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  if (!window.open(url, "_blank")) alert("O navegador bloqueou a nova aba. Permita pop-ups deste site e tente de novo.");
}

/** Bloco do painel do cliente: escolher período, destaques do período e abrir o relatório. */
function htmlRelatorioNoPainel() {
  const hoje = hojeISO();
  return `<div class="painel-grafico-funil" style="margin-bottom:16px;" id="bloco-relatorio">
    <h3>📊 Relatório para o cliente</h3>
    <p class="card-sub" style="margin:0 0 10px;">Apresentação com números e gráficos das atividades concluídas (e avaliações do Google, quando houver). Abre em outra aba: use "Salvar como PDF".</p>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
      <input type="month" id="rel-mes" value="${hoje.slice(0, 7)}">
      <button class="botao pequeno" id="rel-abrir-mes">Relatório do mês</button>
      <input type="number" id="rel-ano" value="${hoje.slice(0, 4)}" min="2020" max="2100" style="width:90px;">
      <button class="botao secundario pequeno" id="rel-abrir-ano">Retrospectiva do ano</button>
    </div>
    <label class="card-sub" for="rel-destaques">Destaques do período escolhido (aparecem no slide “Campanhas e destaques”; marque também a campanha em cada atividade):</label>
    <textarea id="rel-destaques" rows="3" placeholder="Ex.: Em maio foi realizada a campanha de Fórmula 1 na empresa; contribuí com as artes digitais e a edição dos vídeos." style="width:100%; margin-top:4px;"></textarea>
  </div>`;
}

function ligarRelatorioCliente(cliente) {
  const mesEl = document.getElementById("rel-mes"), anoEl = document.getElementById("rel-ano"), txt = document.getElementById("rel-destaques");
  if (!mesEl) return;
  let chaveAtual = mesEl.value;
  const carregar = (chave) => { chaveAtual = chave; const c = ESTADO.clientes.find((x) => x.id === cliente.id); txt.value = ((c && c.destaques) || {})[chave] || ""; };
  const salvar = () => atualizarEstado((e) => { const c = e.clientes.find((x) => x.id === cliente.id); c.destaques = c.destaques || {}; if (txt.value.trim()) c.destaques[chaveAtual] = txt.value.trim(); else delete c.destaques[chaveAtual]; });
  txt.addEventListener("change", salvar);
  mesEl.addEventListener("change", () => { salvar(); carregar(mesEl.value); });
  anoEl.addEventListener("focus", () => { salvar(); carregar(String(anoEl.value)); });
  anoEl.addEventListener("change", () => { carregar(String(anoEl.value)); });
  mesEl.addEventListener("focus", () => { salvar(); carregar(mesEl.value); });
  carregar(mesEl.value);
  const atual = () => ESTADO.clientes.find((x) => x.id === cliente.id);
  document.getElementById("rel-abrir-mes").addEventListener("click", () => { carregar(mesEl.value); salvar(); abrirRelatorioCliente(atual(), "mes", mesEl.value); });
  document.getElementById("rel-abrir-ano").addEventListener("click", () => { carregar(String(anoEl.value)); salvar(); abrirRelatorioCliente(atual(), "ano", String(anoEl.value)); });
}
