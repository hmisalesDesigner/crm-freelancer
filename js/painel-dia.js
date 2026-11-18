/**
 * painel-dia.js
 * Visão geral do dia no Painel: "Novos leads" e "Tarefas de hoje" em cards "pasta",
 * cada um com filtros em pílulas (como no layout Workspace) e planejamento de atividades.
 */

let FILTRO_LEADS = "todos", FILTRO_TAREFAS = "todas";
let BUSCA_LEADS = "", BUSCA_TAREFAS = "";
let BUSCA_ABERTA = { leads: false, tarefas: false };

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

  const rotPrio = (p) => `<small class="rotulo rotulo-${p}">${ROTULO_PRIORIDADE[p]}</small>`;
  alvoTarefas.innerHTML = visiveis.slice(0, 8).map((t) => {
    if (t.kind === "follow") {
      const it = t.it;
      const wa = linkWhatsapp(it.contato, it.mensagem);
      const icone = it.tipo === "contato" ? "📞" : it.tipo === "lead" ? "🔎" : "📄";
      return `<div class="card-pasta">
        <span class="aba-avatar neutra">${icone}</span>
        <button class="aba-icone" data-ir="${it.tipo === "lead" ? "prospeccao" : it.tipo === "orcamento" ? "orcamentos" : "funil"}" title="Abrir" aria-label="Abrir">↗</button>
        <h4 class="card-pasta-nome">${escaparHtml(it.titulo)}</h4>
        <p class="card-pasta-sub">${escaparHtml(it.detalhe)}</p>
        <div class="card-pasta-linha card-pasta-meta">
          <div><small class="rotulo">Tipo</small><div class="chips-mini"><span class="chip-mini">Follow-up</span>${t.atrasada ? `<span class="chip-mini chip-atraso">Atrasado</span>` : ""}</div></div>
          <div class="direita">${rotPrio(t.prioridade)}</div>
        </div>
        <div class="card-pasta-acoes">
          ${wa ? `<a class="botao sucesso pequeno" href="${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
          <button class="botao secundario pequeno" data-feito-dia="${t.i}">Feito</button>
        </div>
      </div>`;
    }
    const d = t.d;
    return `<div class="card-pasta">
      <span class="aba-avatar neutra">🛠️</span>
      <button class="aba-icone" data-ir="painel" title="Demandas" aria-label="Abrir">↗</button>
      <h4 class="card-pasta-nome">${escaparHtml(d.titulo)}</h4>
      <p class="card-pasta-sub">${escaparHtml(d.cliente || "")} · ${STATUS_DEMANDA[d.status]}</p>
      <div class="card-pasta-linha card-pasta-meta">
        <div><small class="rotulo">Categoria</small><div class="chips-mini">${d.categoria ? seloCategoria(d.categoria) : `<span class="chip-mini">—</span>`}${t.atrasada ? `<span class="chip-mini chip-atraso">Atrasada</span>` : ""}</div></div>
        <div class="direita">${rotPrio(t.prioridade)}</div>
      </div>
      <div class="card-pasta-acoes">
        <button class="botao sucesso pequeno" data-concluir-dia="${d.id}">Concluir</button>
      </div>
    </div>`;
  }).join("") || `<p class="card-sub" style="grid-column:1/-1;">${tarefas.length ? "Nenhuma tarefa neste filtro." : "Nada pendente para hoje. 🎉"}</p>`;
  if (visiveis.length > 8) alvoTarefas.insertAdjacentHTML("beforeend", `<p class="card-sub" style="grid-column:1/-1;margin:0;">+ ${visiveis.length - 8} tarefa(s) — veja a lista completa em Demandas</p>`);

  /* --- planejar atividade (como a linha pré-pronta da planilha) --- */
  const btnPlan = document.getElementById("plano-add");
  if (btnPlan && !btnPlan.dataset.ok) {
    btnPlan.dataset.ok = "1";
    const sel = document.getElementById("plano-categoria");
    sel.innerHTML = `<option value="">Categoria</option>` + Object.keys(CATEGORIA_DEMANDA).map((c) => `<option>${c}</option>`).join("");
    const enviar = () => {
      const inp = document.getElementById("plano-texto"); const t = inp.value.trim(); if (!t) return;
      const dia = document.getElementById("plano-dia").value === "amanha" ? somarDiasISO(hojeISO(), 1) : hojeISO();
      const prioridade = document.getElementById("plano-prioridade").value;
      atualizarEstado((e) => { e.demandas.push({ id: gerarId(), cliente: "Vespor", titulo: t, data: dia, status: "fazer", categoria: sel.value || undefined, prioridade }); });
      inp.value = ""; atualizarPainel();
    };
    btnPlan.addEventListener("click", enviar);
    document.getElementById("plano-texto").addEventListener("keydown", (ev) => { if (ev.key === "Enter") enviar(); });
  }

  /* --- ações --- */
  const secoes = { leads: () => [FILTRO_LEADS, BUSCA_LEADS], tarefas: () => [FILTRO_TAREFAS, BUSCA_TAREFAS] };
  document.querySelectorAll("#painel-leads-filtros [data-busca-toggle], #painel-tarefas-filtros [data-busca-toggle]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.buscaToggle; BUSCA_ABERTA[k] = !BUSCA_ABERTA[k];
    if (!BUSCA_ABERTA[k]) { if (k === "leads") BUSCA_LEADS = ""; else BUSCA_TAREFAS = ""; }
    renderizarVisaoDoDia();
    const inp = document.querySelector(`[data-busca-input="${k}"]`); if (inp) inp.focus();
  }));
  document.querySelectorAll("[data-busca-input]").forEach((inp) => inp.addEventListener("input", () => {
    const k = inp.dataset.buscaInput; if (k === "leads") BUSCA_LEADS = inp.value; else BUSCA_TAREFAS = inp.value;
    renderizarVisaoDoDia();
    const novo = document.querySelector(`[data-busca-input="${k}"]`); if (novo) { novo.focus(); novo.setSelectionRange(novo.value.length, novo.value.length); }
  }));
  document.querySelectorAll("[data-filtro-leads]").forEach((b) => b.addEventListener("click", () => { FILTRO_LEADS = b.dataset.filtroLeads; renderizarVisaoDoDia(); }));
  document.querySelectorAll("[data-filtro-tarefas]").forEach((b) => b.addEventListener("click", () => { FILTRO_TAREFAS = b.dataset.filtroTarefas; renderizarVisaoDoDia(); }));
  document.querySelectorAll("#painel-leads [data-ir], #painel-tarefas-dia [data-ir]").forEach((b) => b.addEventListener("click", () => irParaPagina(b.dataset.ir)));
  alvoTarefas.querySelectorAll("[data-concluir-dia]").forEach((b) => b.addEventListener("click", () => {
    atualizarEstado((e) => { const d = e.demandas.find((x) => x.id === b.dataset.concluirDia); if (d) { d.status = "concluida"; d.data = hojeISO(); } });
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
