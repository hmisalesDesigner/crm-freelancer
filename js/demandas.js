/**
 * demandas.js
 * Demandas do cliente Vespor (inclui Varejocar) no painel inicial:
 * A fazer -> Em andamento -> Concluída. O histórico da planilha entra como "Concluída".
 */
const STATUS_DEMANDA = { fazer: "A fazer", responder: "Para responder", andamento: "Em andamento", concluida: "Concluída" };
const CATEGORIA_DEMANDA = {
  "Arte": { classe: "cat-arte", cor: "#a78bfa" },
  "Suporte": { classe: "cat-suporte", cor: "#60a5fa" },
  "Vídeo/Áudio": { classe: "cat-video", cor: "#2dd4bf" },
  "Revisão": { classe: "cat-revisao", cor: "#f472b6" },
};

/** Marca a demanda como concluída hoje, guardando o dia em que ela estava planejada (agenda semanal). */
function concluirDemanda(d) {
  d.planejadaPara = d.planejadaPara || d.data || hojeISO();
  d.status = "concluida";
  d.data = hojeISO();
}

/** Segunda-feira da semana de uma data (AAAA-MM-DD), sem depender de fuso. */
function inicioSemanaISO(dataISO) {
  const [a, m, dia] = dataISO.split("-").map(Number);
  const dt = new Date(a, m - 1, dia);
  const dow = (dt.getDay() + 6) % 7; // segunda = 0
  return somarDiasISO(dataISO, -dow);
}

function seloCategoria(categoria) {
  const c = CATEGORIA_DEMANDA[categoria];
  if (!c) return "";
  return ` <span class="selo ${c.classe}">${categoria}</span>`;
}

function renderizarDemandasPainel() {
  const alvo = document.getElementById("painel-demandas");
  if (!alvo) return;
  const lista = ESTADO.demandas || [];
  const abertas = lista.filter((d) => d.status !== "concluida");
  const fazer = lista.filter((d) => d.status === "fazer").length;
  const andamento = lista.filter((d) => d.status === "andamento").length;
  const responder = lista.filter((d) => d.status === "responder").length;
  const concluidas = lista.filter((d) => d.status === "concluida");
  const limite = somarDiasISO(hojeISO(), -7);
  const hojeN = concluidas.filter((d) => d.data === hojeISO()).length;
  const semana = concluidas.filter((d) => d.data && d.data >= limite).length;
  const mes = mesAtualChave();
  const noMes = concluidas.filter((d) => d.data && chaveMes(d.data) === mes).length;
  const recentes = [...concluidas].sort((a, b) => (b.data || "").localeCompare(a.data || "") || 0).slice(0, 8);

  const porCategoria = {};
  lista.forEach((d) => { if (d.categoria) porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + 1; });
  const totalCategorizado = Object.values(porCategoria).reduce((a, b) => a + b, 0);
  const ordemCategorias = Object.keys(CATEGORIA_DEMANDA).filter((c) => porCategoria[c]);
  const barraCategorias = totalCategorizado
    ? `<div class="barra-categorias">${ordemCategorias.map((c) => `<span style="width:${((porCategoria[c] / totalCategorizado) * 100).toFixed(1)}%; background:${CATEGORIA_DEMANDA[c].cor}" title="${c}: ${porCategoria[c]}"></span>`).join("")}</div>
       <div class="legenda-categorias">${ordemCategorias.map((c) => `<span><span class="ponto" style="background:${CATEGORIA_DEMANDA[c].cor}"></span>${c}: ${porCategoria[c]}</span>`).join("")}</div>`
    : "";

  const linha = (d) => `
    <li class="demanda-item">
      <span class="selo ${d.status === "andamento" ? "enviado" : d.status === "responder" ? "morno" : "pendente"}">${STATUS_DEMANDA[d.status]}</span>
      <span class="demanda-titulo">${escaparHtml(d.titulo)}</span>${seloCategoria(d.categoria)}
      <span class="demanda-acoes">
        ${d.status === "fazer" || d.status === "responder" ? `<button class="botao secundario pequeno" data-dem="andamento" data-id="${d.id}">Iniciar</button>` : ""}
        <button class="botao sucesso pequeno" data-dem="concluida" data-id="${d.id}">Concluir</button>
        <button class="botao perigo pequeno" data-dem="excluir" data-id="${d.id}" title="Excluir">✕</button>
      </span>
    </li>`;

  alvo.innerHTML = `
    <div class="pilulas-dem">
      <div class="pilula-dem p-fazer"><span>A fazer</span><b>${fazer}</b></div>
      <div class="pilula-dem p-responder"><span>Para responder</span><b>${responder}</b></div>
      <div class="pilula-dem p-andamento"><span>Em andamento</span><b>${andamento}</b></div>
      <div class="pilula-dem p-ok"><span>Concluídas (Hoje)</span><b>${hojeN}</b></div>
      <span class="espaco-pilulas"></span>
      <div class="pilula-dem p-ok"><span>Concluídas (Semana)</span><b>${semana}</b></div>
      <div class="pilula-dem p-ok"><span>Concluídas (neste mês)</span><b>${noMes}</b></div>
      <div class="pilula-dem p-ok"><span>Concluídas (Ano)</span><b>${concluidas.length}</b> <small>no total</small></div>
    </div>
    <div class="linha-plano" style="margin-top:14px;">
      <input id="dem-novo" placeholder="Nova demanda (ex.: Arte promoção)">
      <select id="dem-status-novo"><option value="fazer">A fazer</option><option value="responder">Para responder</option><option value="andamento">Em andamento</option></select>
      <button class="botao pequeno" id="dem-add">+ Adicionar</button>
    </div>

    ${barraCategorias}
    <details class="lista-dem"><summary>Ver lista de demandas (${abertas.length} em aberto)</summary>
    <h4 style="margin:12px 0 6px;">Em aberto (${abertas.length})</h4>
    <ul class="demanda-lista">${abertas.length ? abertas.map(linha).join("") : `<li class="demanda-item" style="color:var(--cor-texto-suave)">Nada em aberto. Adicione uma nova demanda acima.</li>`}</ul>
    <h4 style="margin:12px 0 6px;">Concluídas recentemente</h4>
    <ul class="demanda-lista">${recentes.map((d) => `<li class="demanda-item"><span class="selo aceito">Concluída</span><span class="demanda-titulo">${escaparHtml(d.titulo)}</span>${seloCategoria(d.categoria)}<span class="card-sub">${d.data ? formatarDataBR(d.data) : ""}</span></li>`).join("") || `<li class="demanda-item" style="color:var(--cor-texto-suave)">Nenhuma ainda.</li>`}</ul></details>`;

  const adicionar = (texto, status) => {
    const t = (texto ?? document.getElementById("dem-novo").value).trim();
    if (!t) return;
    const andando = status || document.getElementById("dem-status-novo").value || "fazer";
    atualizarEstado((e) => { e.demandas.push({ id: gerarId(), cliente: "Vespor", titulo: t, data: hojeISO(), planejadaPara: hojeISO(), status: andando }); });
    renderizarDemandasPainel();
  };
  document.getElementById("dem-add").addEventListener("click", () => adicionar());
  document.getElementById("dem-novo").addEventListener("keydown", (ev) => { if (ev.key === "Enter") adicionar(); });
  alvo.querySelectorAll("[data-dem]").forEach((b) => b.addEventListener("click", () => {
    const acao = b.dataset.dem, id = b.dataset.id;
    atualizarEstado((e) => {
      if (acao === "excluir") { e.demandas = e.demandas.filter((x) => x.id !== id); return; }
      const d = e.demandas.find((x) => x.id === id);
      if (!d) return;
      if (acao === "concluida") concluirDemanda(d); else d.status = acao;
    });
    renderizarDemandasPainel();
  }));
}
