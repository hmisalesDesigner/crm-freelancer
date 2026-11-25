/**
 * painel-dia.js
 * Visão geral do dia no Painel: "Novos leads" e "Tarefas de hoje" em cards "pasta",
 * cada um com filtros em pílulas (como no layout Workspace) e planejamento de atividades.
 */

let FILTRO_LEADS = "todos", FILTRO_TAREFAS = "todas", FILTRO_CLIENTES = "todos";
let BUSCA_LEADS = "", BUSCA_TAREFAS = "", BUSCA_CLIENTES = "";
let BUSCA_ABERTA = { leads: false, tarefas: false, clientes: false };

const FILTROS_LEADS = [["todos", "Todos"], ["quente", "🔥 Lead quente"], ["baixo", "Interesse baixo"], ["medio", "Interesse médio"], ["alto", "Interesse alto"]];
const FILTROS_TAREFAS = [["todas", "Todas"], ["atrasada", "Atrasadas"], ["alta", "Prioridade alta"], ["media", "Prioridade média"], ["baixa", "Prioridade baixa"]];
const ROTULO_PRIORIDADE = { alta: "Prioridade alta", media: "Prioridade média", baixa: "Prioridade baixa" };

function nivelLead(score) { return Math.max(1, Math.min(5, Math.round(score / 20))); }

function bolinhasNivelHtml(score) {
  const cheios = nivelLead(score);
  const cores = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
  return cores.map((c, i) => `<i class="bolinha-nivel" style="${i < cheios ? "background:" + c : ""}"></i>`).join("");
}

function filtroLeadAceita(f, score) {
  const n = nivelLead(score);
  if (f === "quente") return prioridadeLead(score) === "quente";
  if (f === "baixo") return n <= 2;
  if (f === "medio") return n === 3;
  if (f === "alto") return n >= 4;
  return true;
}

function barraFiltros(chave, lista, atual, aberta, busca) {
  return `<button class="chip chip-icone" data-busca-toggle="${chave}" title="Buscar" aria-label="Buscar">🔍</button>`
    + (aberta ? `<input class="busca-dia" data-busca-input="${chave}" placeholder="Buscar..." value="${escaparHtml(busca)}">` : "")
    + lista.map(([v, r]) => `<button class="chip${v === atual ? " ativo" : ""}" data-filtro-${chave}="${v}">${r}</button>`).join("");
}

function cartaLeadHtml(l, score) {
  const nome = l.nome || l.perfil || "?";
  const iniciais = nome.replace(/^@/, "").split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  const wa = linkWhatsapp(l.whatsapp, mensagemParaLead(l));
  const prio = prioridadeLead(score);
  const rotulo = prio === "quente" ? "🔥 Lead quente" : prio === "morno" ? "Interesse médio" : "Baixo interesse";
  const origem = [l.perfil ? "Instagram" : "", l.whatsapp ? "WhatsApp" : "", l.tipo || ""].filter(Boolean);
  const atrasado = l.proximoContato && l.proximoContato <= hojeISO();
  return `<div class="card-pasta">
      <span class="aba-avatar">${escaparHtml(iniciais)}</span>
      <button class="aba-icone" data-ir="prospeccao" title="Abrir na Prospecção" aria-label="Abrir">↗</button>
      <h4 class="card-pasta-nome">${escaparHtml(nome)}</h4>
      <p class="card-pasta-sub">${escaparHtml(l.nicho || l.tipo || "")}${l.seguidores != null ? " · " + Number(l.seguidores).toLocaleString("pt-BR") + " seg." : ""}</p>
      <div class="card-pasta-linha card-pasta-meta">
        <div><small class="rotulo">Origem</small><div class="chips-mini">${origem.map((o) => `<span class="chip-mini">${escaparHtml(o)}</span>`).join("") || `<span class="chip-mini">—</span>`}</div></div>
        <div class="direita"><small class="rotulo ${prio === "quente" ? "rotulo-quente" : ""}">${rotulo}</small><span class="bolinhas-nivel" title="Interesse: ${score}/100">${bolinhasNivelHtml(score)}</span></div>
      </div>
      <div class="card-pasta-linha">
        <span class="card-sub" style="margin:0;">${escaparHtml(l.status)}${l.proximoContato ? ` · <span style="${atrasado ? "color:var(--cor-perigo);font-weight:600;" : ""}">Follow-up ${formatarDataBR(l.proximoContato)}</span>` : ""}</span>
        ${wa ? `<a class="botao sucesso pequeno" href="${wa}" target="_blank" rel="noopener">💬</a>` : ""}
      </div>
    </div>`;
}

function renderizarVisaoDoDia() {
  const alvoLeads = document.getElementById("painel-leads");
  const alvoTarefas = document.getElementById("painel-tarefas-dia");
  if (!alvoLeads || !alvoTarefas) return;
  const hojeStr = hojeISO();

  /* --- leads --- */
  const ativos = (ESTADO.leads || [])
    .filter((l) => !STATUS_LEAD_ENCERRADOS.includes(l.status))
    .map((l) => ({ l, score: calcularScoreLead(l) }))
    .sort((a, b) => b.score - a.score);
  document.getElementById("painel-leads-contagem").textContent = ativos.length;
  const buscaL = BUSCA_LEADS.trim().toLowerCase();
  const leadsFiltrados = ativos.filter(({ l, score }) => filtroLeadAceita(FILTRO_LEADS, score)
    && (!buscaL || `${l.nome || ""} ${l.perfil || ""} ${l.nicho || ""}`.toLowerCase().includes(buscaL)));
  document.getElementById("painel-leads-filtros").innerHTML = barraFiltros("leads", FILTROS_LEADS, FILTRO_LEADS, BUSCA_ABERTA.leads, BUSCA_LEADS);
  alvoLeads.innerHTML = leadsFiltrados.slice(0, 4).map(({ l, score }) => cartaLeadHtml(l, score)).join("")
    || `<p class="card-sub" style="grid-column:1/-1;">${ativos.length ? "Nenhum lead neste filtro." : "Nenhum lead ativo. Capture perfis na aba Prospecção."}</p>`;
  if (leadsFiltrados.length > 4) alvoLeads.insertAdjacentHTML("beforeend", `<p class="card-sub" style="grid-column:1/-1;margin:0;">+ ${leadsFiltrados.length - 4} lead(s) na aba Prospecção</p>`);

  /* --- tarefas de hoje --- */
  const followups = obterFollowUps();
  const demandasAbertas = (ESTADO.demandas || [])
    .filter((d) => ["andamento", "fazer", "responder"].includes(d.status) && (!d.data || d.data <= hojeStr))
    .sort((a, b) => (a.status === "andamento" ? 0 : 1) - (b.status === "andamento" ? 0 : 1));
  const feitasHoje = (ESTADO.demandas || []).filter((d) => d.status === "concluida" && d.data === hojeStr).length;
  const amanha = (ESTADO.demandas || []).filter((d) => ["fazer", "responder"].includes(d.status) && d.data === somarDiasISO(hojeStr, 1)).length;
  const metaDia = Number((ESTADO.configuracoes || {}).metaAtividadesDia || 8);
  const resumo = document.getElementById("painel-plano-resumo");
  if (resumo) resumo.textContent = `Hoje: ${feitasHoje}/${metaDia} concluídas` + (amanha ? ` · ${amanha} já planejada(s) para amanhã` : "");

  const tarefas = followups.map((it, i) => {
    const prioridade = it.tipo === "lead" ? ({ 5: "alta", 4: "alta", 3: "media" }[nivelLead(calcularScoreLead(ESTADO.leads.find((x) => x.id === it.leadId) || {}))] || "baixa") : "media";
    return { kind: "follow", it, i, prioridade, atrasada: (it.atraso || 0) > 0, texto: `${it.titulo} ${it.detalhe}` };
  }).concat(demandasAbertas.map((d) => ({
    kind: "dem", d, prioridade: d.prioridade || "media",
    atrasada: d.status !== "andamento" && !!d.data && d.data < hojeStr, texto: `${d.titulo} ${d.cliente || ""}`,
  })));
  document.getElementById("painel-tarefas-contagem").textContent = tarefas.length;
  document.getElementById("painel-tarefas-filtros").innerHTML = barraFiltros("tarefas", FILTROS_TAREFAS, FILTRO_TAREFAS, BUSCA_ABERTA.tarefas, BUSCA_TAREFAS);
  const buscaT = BUSCA_TAREFAS.trim().toLowerCase();
  const visiveis = tarefas.filter((t) => (FILTRO_TAREFAS === "todas" || (FILTRO_TAREFAS === "atrasada" ? t.atrasada : t.prioridade === FILTRO_TAREFAS))
    && (!buscaT || t.texto.toLowerCase().includes(buscaT)));

  const lista = visiveis.slice(0, 8);
  const rotPrio = (p) => `<small class="rotulo rotulo-${p}">${ROTULO_PRIORIDADE[p]}</small>`;
  const cartaTarefa = (o, destaque) => `<div class="card-tarefa${destaque ? " destaque" : ""}">
      <div class="tarefa-tab"><span class="tarefa-avatar">${o.avatar}</span></div>
      <div class="tarefa-acoes-topo">
        <button class="circulo-btn" data-adiar-dia="${o.chave}" title="Adiar para amanhã" aria-label="Adiar para amanhã">🔔</button>
        <button class="circulo-btn" ${o.verCliente ? `data-ver-cliente="${o.verCliente}"` : `data-ir="${o.ir}"`} title="Abrir" aria-label="Abrir">↗</button>
      </div>
      <div class="tarefa-corpo">
        <div class="tarefa-titulo"><span class="tarefa-icone">${o.icone}</span><div><h4>${escaparHtml(o.titulo)}</h4><p>${escaparHtml(o.sub)}</p></div></div>
        <div class="tarefa-chips">${o.chips}${o.prioridade ? rotPrio(o.prioridade) : ""}</div>
        <small class="rotulo">${o.rotuloSelect || "Status"}</small>
        <div class="tarefa-rodape">
          ${o.seletor}
          <span class="tarefa-icones">${o.wa ? `<a class="circulo-mini" href="${o.wa}" target="_blank" rel="noopener" title="WhatsApp">💬</a>` : ""}${o.attrFeito ? `<button class="circulo-mini" ${o.attrFeito} title="Concluir" aria-label="Concluir">✔</button>` : ""}</span>
        </div>
      </div>
    </div>`;
  alvoTarefas.innerHTML = lista.map((t, n) => {
    const atraso = t.atrasada ? `<span class="chip-mini chip-atraso">Atrasada</span>` : "";
    if (t.kind === "follow") {
      const it = t.it;
      return cartaTarefa({
        avatar: it.tipo === "contato" ? "📞" : it.tipo === "lead" ? "🔎" : "📄",
        chave: "f:" + t.i, ir: it.tipo === "lead" ? "prospeccao" : it.tipo === "orcamento" ? "orcamentos" : "funil",
        icone: it.tipo === "orcamento" ? "📄" : "✉️", titulo: it.titulo, sub: it.detalhe,
        chips: `<span class="chip-mini">Follow-up</span>${atraso}`, prioridade: t.prioridade,
        seletor: `<select class="tarefa-select" data-status-follow="${t.i}"><option>Pendente</option><option value="feito">Feito</option></select>`,
        wa: linkWhatsapp(it.contato, it.mensagem), attrFeito: `data-feito-dia="${t.i}"`,
      }, n === 0);
    }
    const d = t.d;
    return cartaTarefa({
      avatar: escaparHtml(((d.cliente || "?")[0] || "?").toUpperCase()),
      chave: "d:" + d.id, ir: "painel", icone: "🛠️", titulo: d.titulo,
      sub: `${d.cliente || ""}${d.data ? " · " + formatarDataBR(d.data) : ""}`,
      chips: `${d.categoria ? seloCategoria(d.categoria) : ""}${atraso}`, prioridade: t.prioridade,
      seletor: `<select class="tarefa-select" data-status-dem="${d.id}">${Object.keys(STATUS_DEMANDA).map((k) => `<option value="${k}"${k === d.status ? " selected" : ""}>${STATUS_DEMANDA[k]}</option>`).join("")}</select>`,
      wa: "", attrFeito: `data-concluir-dia="${d.id}"`,
    }, n === 0);
  }).join("") || `<p class="card-sub" style="grid-column:1/-1;">${tarefas.length ? "Nenhuma tarefa neste filtro." : "Nada pendente para hoje. 🎉"}</p>`;
  if (visiveis.length > 8) alvoTarefas.insertAdjacentHTML("beforeend", `<p class="card-sub" style="grid-column:1/-1;margin:0;">+ ${visiveis.length - 8} tarefa(s) — veja a lista completa em Demandas</p>`);

  /* --- clientes (visão de todos) --- */
  const clientes = ESTADO.clientes || [];
  const etapasPresentes = ETAPAS_FUNIL.filter((e) => clientes.some((c) => c.etapaFunil === e));
  document.getElementById("painel-clientes-contagem").textContent = clientes.length;
  document.getElementById("painel-clientes-filtros").innerHTML = barraFiltros("clientes", [["todos", "Todos"]].concat(etapasPresentes.map((e) => [e, e])), FILTRO_CLIENTES, BUSCA_ABERTA.clientes, BUSCA_CLIENTES);
  const buscaC = BUSCA_CLIENTES.trim().toLowerCase();
  const clientesVisiveis = clientes.filter((c) => (FILTRO_CLIENTES === "todos" || c.etapaFunil === FILTRO_CLIENTES) && (!buscaC || `${c.nome || ""} ${c.contato || ""} ${c.demanda || ""}`.toLowerCase().includes(buscaC)));
  const fixoId = (ESTADO.configuracoes || {}).clienteFixoId;
  const ativoId = ESTADO.cronometroAtivo ? ((tarefaPorId(ESTADO.cronometroAtivo.tarefaId) || {}).clienteId) : null;
  document.getElementById("painel-clientes").innerHTML = clientesVisiveis.map((c) => {
    const total = (c.historicoFinanceiro || []).reduce((acc, h) => acc + Number(h.valor || 0), 0);
    const abertas = demandasDoCliente(c).filter((d) => d.status !== "concluida").length;
    const iniciais = (c.nome || "?").trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
    return cartaTarefa({
      avatar: c.foto ? `<img src="${c.foto}" alt="">` : escaparHtml(iniciais),
      chave: "c:" + c.id, verCliente: c.id, icone: "👤", titulo: c.nome || "Sem nome",
      sub: c.contato || (c.demanda || "").slice(0, 40) || "Sem contato",
      chips: `<span class="chip-mini">${abertas} demanda(s) em aberto</span><span class="chip-mini">${formatarMoeda(total)}</span>${c.proximoContato ? `<span class="chip-mini${c.proximoContato <= hojeStr ? " chip-atraso" : ""}">Contato ${formatarDataBR(c.proximoContato)}</span>` : ""}`,
      rotuloSelect: "Etapa", prioridade: "",
      seletor: `<select class="tarefa-select" data-etapa-cliente="${c.id}">${ETAPAS_FUNIL.map((e) => `<option${e === c.etapaFunil ? " selected" : ""}>${e}</option>`).join("")}</select>`,
      wa: linkWhatsapp(c.contato, ""), attrFeito: "",
    }, c.id === (ativoId || fixoId));
  }).join("") || `<p class="card-sub" style="grid-column:1/-1;">${clientes.length ? "Nenhum cliente neste filtro." : "Nenhum cliente cadastrado ainda."}</p>`;

  renderizarAgendaSemana();

  /* --- planejar atividade (como a linha pré-pronta da planilha) --- */
  const btnPlan = document.getElementById("plano-add");
  if (btnPlan && !btnPlan.dataset.ok) {
    btnPlan.dataset.ok = "1";
    const sel = document.getElementById("plano-categoria");
    sel.innerHTML = `<option value="">Categoria</option>` + Object.keys(CATEGORIA_DEMANDA).map((c) => `<option>${c}</option>`).join("");
    const enviar = () => {
      const inp = document.getElementById("plano-texto"); const t = inp.value.trim(); if (!t) return;
      const escolha = document.getElementById("plano-dia").value;
      const dia = escolha === "amanha" ? somarDiasISO(hojeISO(), 1) : escolha === "ontem" ? somarDiasISO(hojeISO(), -1) : escolha === "outra" ? (document.getElementById("plano-data").value || hojeISO()) : hojeISO();
      const prioridade = document.getElementById("plano-prioridade").value;
      const feita = document.getElementById("plano-feita").checked || dia < hojeISO(); // dia passado = atividade já feita
      atualizarEstado((e) => { e.demandas.push({ id: gerarId(), cliente: "Vespor", titulo: t, data: dia, planejadaPara: dia, status: feita ? "concluida" : "fazer", categoria: sel.value || undefined, prioridade }); });
      inp.value = ""; inp.focus(); atualizarPainel();
    };
    btnPlan.addEventListener("click", enviar);
    document.getElementById("plano-dia").addEventListener("change", (ev) => {
      document.getElementById("plano-data").style.display = ev.target.value === "outra" ? "" : "none";
      if (ev.target.value === "ontem") document.getElementById("plano-feita").checked = true;
    });
    document.getElementById("plano-texto").addEventListener("keydown", (ev) => { if (ev.key === "Enter") enviar(); });
  }

  /* --- ações --- */
  document.querySelectorAll("#painel-leads-filtros [data-busca-toggle], #painel-tarefas-filtros [data-busca-toggle], #painel-clientes-filtros [data-busca-toggle]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.buscaToggle; BUSCA_ABERTA[k] = !BUSCA_ABERTA[k];
    if (!BUSCA_ABERTA[k]) { if (k === "leads") BUSCA_LEADS = ""; else if (k === "clientes") BUSCA_CLIENTES = ""; else BUSCA_TAREFAS = ""; }
    renderizarVisaoDoDia();
    const inp = document.querySelector(`[data-busca-input="${k}"]`); if (inp) inp.focus();
  }));
  document.querySelectorAll("[data-busca-input]").forEach((inp) => inp.addEventListener("input", () => {
    const k = inp.dataset.buscaInput; if (k === "leads") BUSCA_LEADS = inp.value; else if (k === "clientes") BUSCA_CLIENTES = inp.value; else BUSCA_TAREFAS = inp.value;
    renderizarVisaoDoDia();
    const novo = document.querySelector(`[data-busca-input="${k}"]`); if (novo) { novo.focus(); novo.setSelectionRange(novo.value.length, novo.value.length); }
  }));
  document.querySelectorAll("[data-filtro-leads]").forEach((b) => b.addEventListener("click", () => { FILTRO_LEADS = b.dataset.filtroLeads; renderizarVisaoDoDia(); }));
  document.querySelectorAll("[data-filtro-clientes]").forEach((b) => b.addEventListener("click", () => { FILTRO_CLIENTES = b.dataset.filtroClientes; renderizarVisaoDoDia(); }));
  document.querySelectorAll("#painel-clientes [data-ver-cliente]").forEach((b) => b.addEventListener("click", () => abrirPainelCliente(b.dataset.verCliente)));
  document.querySelectorAll("[data-etapa-cliente]").forEach((sel) => sel.addEventListener("change", () => {
    atualizarEstado((e) => { const c = e.clientes.find((x) => x.id === sel.dataset.etapaCliente); if (c) c.etapaFunil = sel.value; });
    atualizarPainel();
  }));
  document.querySelectorAll("[data-filtro-tarefas]").forEach((b) => b.addEventListener("click", () => { FILTRO_TAREFAS = b.dataset.filtroTarefas; renderizarVisaoDoDia(); }));
  document.querySelectorAll("#painel-leads [data-ir], #painel-tarefas-dia [data-ir]").forEach((b) => b.addEventListener("click", () => irParaPagina(b.dataset.ir)));
  alvoTarefas.querySelectorAll("[data-status-dem]").forEach((sel) => sel.addEventListener("change", () => {
    atualizarEstado((e) => { const d = e.demandas.find((x) => x.id === sel.dataset.statusDem); if (d) { if (sel.value === "concluida") concluirDemanda(d); else d.status = sel.value; } });
    atualizarPainel();
  }));
  alvoTarefas.querySelectorAll("[data-status-follow]").forEach((sel) => sel.addEventListener("change", () => {
    if (sel.value === "feito") alvoTarefas.querySelector(`[data-feito-dia="${sel.dataset.statusFollow}"]`).click();
  }));
  document.querySelectorAll("#painel-tarefas-dia [data-adiar-dia], #painel-clientes [data-adiar-dia]").forEach((b) => b.addEventListener("click", () => {
    const [tipo, ref] = b.dataset.adiarDia.split(":"); const amanha = somarDiasISO(hojeISO(), 1);
    atualizarEstado((e) => {
      if (tipo === "c") { const c = e.clientes.find((x) => x.id === ref); if (c) c.proximoContato = amanha; return; }
      if (tipo === "d") { const d = e.demandas.find((x) => x.id === ref); if (d) { d.planejadaPara = d.planejadaPara || d.data; d.data = amanha; } return; }
      const it = followups[Number(ref)];
      if (it.tipo === "lead") { const l = e.leads.find((x) => x.id === it.leadId); if (l) l.proximoContato = amanha; }
      else if (it.tipo === "contato") { const c = e.clientes.find((x) => x.id === it.clienteId); if (c) c.proximoContato = amanha; }
      else { const o = e.orcamentos.find((x) => x.id === it.orcamentoId); if (o) o.ultimoFollowUp = hojeISO(); }
    });
    atualizarPainel();
  }));
  alvoTarefas.querySelectorAll("[data-concluir-dia]").forEach((b) => b.addEventListener("click", () => {
    atualizarEstado((e) => { const d = e.demandas.find((x) => x.id === b.dataset.concluirDia); if (d) concluirDemanda(d); });
    atualizarPainel();
  }));
  alvoTarefas.querySelectorAll("[data-feito-dia]").forEach((btn) => btn.addEventListener("click", () => {
    const it = followups[Number(btn.dataset.feitoDia)];
    atualizarEstado((e) => {
      if (it.tipo === "lead") { const l = e.leads.find((x) => x.id === it.leadId); if (l) { l.ultimoContato = hojeISO(); l.proximoContato = ""; } }
      else if (it.tipo === "contato") { const c = e.clientes.find((x) => x.id === it.clienteId); if (c) { c.ultimoContato = hojeISO(); c.proximoContato = ""; } }
      else { const o = e.orcamentos.find((x) => x.id === it.orcamentoId); if (o) o.ultimoFollowUp = hojeISO(); }
    });
    atualizarPainel();
  }));
}


/* ---------- agenda da semana (como a Agenda Semanal da planilha) ---------- */
function renderizarAgendaSemana() {
  const alvo = document.getElementById("painel-agenda-semana");
  if (!alvo) return;
  const hoje = hojeISO();
  const seg = inicioSemanaISO(hoje);
  const dias = [0, 1, 2, 3, 4, 5, 6].map((i) => somarDiasISO(seg, i));
  const nomes = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const porDia = {}; dias.forEach((d) => (porDia[d] = []));
  let noDia = 0, outroDia = 0, abertas = 0;
  (ESTADO.demandas || []).forEach((d) => {
    const plan = d.status === "concluida" ? (d.planejadaPara || d.data) : d.data;
    if (!plan || !porDia[plan]) return;
    let cls = "ag-aberta", marca = "";
    if (d.status === "concluida") {
      if (d.data <= plan) { cls = "ag-ok"; noDia++; marca = "Feito no dia"; }
      else { cls = "ag-tarde"; outroDia++; marca = "Feito em outro dia (" + formatarDataBR(d.data).slice(0, 5) + ")"; }
    } else { abertas++; if (plan < hoje) { cls = "ag-atrasada"; marca = "Atrasada"; } }
    porDia[plan].push({ d, cls, marca });
  });
  const meta = Number((ESTADO.configuracoes || {}).metaAtividadesDia || 8);
  const feitasEm = (dia) => (ESTADO.demandas || []).filter((d) => d.status === "concluida" && d.data === dia).length;
  const uteisPassados = dias.slice(0, 5).filter((dia) => dia <= hoje);
  const totalFeitas = uteisPassados.reduce((t, dia) => t + feitasEm(dia), 0);
  const media = uteisPassados.length ? (totalFeitas / uteisPassados.length).toFixed(1).replace(".", ",") : "0";
  const resumo = document.getElementById("agenda-resumo");
  if (resumo) resumo.innerHTML = `<span class="leg">Meta ${meta}/dia · média ${media}</span><span class="leg ag-ok">${noDia} feitas no dia</span><span class="leg ag-tarde">${outroDia} em outro dia</span><span class="leg ag-aberta">${abertas} em aberto</span>`;
  const mostrar = dias.filter((dia, i) => i < 5 || porDia[dia].length);
  alvo.style.gridTemplateColumns = `repeat(${mostrar.length}, minmax(0, 1fr))`;
  alvo.innerHTML = mostrar.map((dia) => {
    const i = dias.indexOf(dia); const itens = porDia[dia];
    return `<div class="ag-coluna${dia === hoje ? " ag-hoje" : ""}">
      <div class="ag-cab"><b>${nomes[i]}</b><span>${formatarDataBR(dia).slice(0, 5)}</span><small class="${dia <= hoje ? (feitasEm(dia) >= meta ? "meta-ok" : "meta-baixa") : ""}" title="Concluídas neste dia / meta">${dia <= hoje ? feitasEm(dia) + "/" + meta : itens.length}</small></div>
      ${itens.slice(0, 10).map(({ d, cls, marca }) => `<div class="ag-item ${cls}" title="${escaparHtml(d.titulo)}${marca ? " — " + marca : ""}">${escaparHtml(d.titulo)}</div>`).join("") || `<div class="ag-vazio">—</div>`}
      ${itens.length > 10 ? `<div class="ag-vazio">+ ${itens.length - 10}</div>` : ""}
    </div>`;
  }).join("");
}
