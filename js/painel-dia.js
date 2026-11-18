/**
 * painel-dia.js
 * Visão geral do dia no topo do Painel: leads para trabalhar e tarefas de hoje
 * (follow-ups vencidos + demandas em andamento), em cards "pasta".
 */

function bolinhasNivelHtml(score) {
  const cheios = Math.max(1, Math.min(5, Math.round(score / 20)));
  const cores = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
  return cores.map((c, i) => `<i class="bolinha-nivel" style="${i < cheios ? "background:" + c : ""}"></i>`).join("");
}

function renderizarVisaoDoDia() {
  const alvoLeads = document.getElementById("painel-leads");
  const alvoTarefas = document.getElementById("painel-tarefas-dia");
  if (!alvoLeads || !alvoTarefas) return;
  const hoje = hojeISO();

  /* --- leads --- */
  const ativos = (ESTADO.leads || [])
    .filter((l) => !STATUS_LEAD_ENCERRADOS.includes(l.status))
    .map((l) => ({ l, score: calcularScoreLead(l) }))
    .sort((a, b) => b.score - a.score);
  document.getElementById("painel-leads-contagem").textContent = ativos.length;
  alvoLeads.innerHTML = ativos.slice(0, 4).map(({ l, score }) => {
    const nome = l.nome || l.perfil || "?";
    const iniciais = nome.replace(/^@/, "").split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
    const wa = linkWhatsapp(l.whatsapp, mensagemParaLead(l));
    const atrasado = l.proximoContato && l.proximoContato <= hoje;
    return `<div class="card-pasta">
      <span class="aba-avatar">${escaparHtml(iniciais)}</span>
      <button class="aba-icone" data-ir="prospeccao" title="Abrir na Prospecção" aria-label="Abrir">↗</button>
      <h4 class="card-pasta-nome">${escaparHtml(nome)}</h4>
      <p class="card-pasta-sub">${escaparHtml(l.nicho || l.tipo || "")}${l.seguidores != null ? " · " + Number(l.seguidores).toLocaleString("pt-BR") + " seg." : ""}</p>
      <div class="card-pasta-linha">
        <span class="selo ${prioridadeLead(score)}">${score} · ${prioridadeLead(score)}</span>
        <span class="bolinhas-nivel" title="Interesse: ${score}/100">${bolinhasNivelHtml(score)}</span>
      </div>
      <div class="card-pasta-linha">
        <span class="card-sub" style="margin:0;">${escaparHtml(l.status)}</span>
        <span class="card-sub" style="margin:0;${atrasado ? "color:var(--cor-perigo);font-weight:600;" : ""}">${l.proximoContato ? "Follow-up " + formatarDataBR(l.proximoContato) : ""}</span>
      </div>
      ${wa ? `<div class="card-pasta-acoes"><a class="botao sucesso pequeno" href="${wa}" target="_blank" rel="noopener">💬 WhatsApp</a></div>` : ""}
    </div>`;
  }).join("") || `<p class="card-sub" style="grid-column:1/-1;">Nenhum lead ativo. Capture perfis na aba Prospecção.</p>`;

  /* --- tarefas de hoje --- */
  const followups = obterFollowUps();
  const hojeStr = hojeISO();
  const emAndamento = (ESTADO.demandas || []).filter((d) => (d.status === "andamento" || d.status === "fazer") && (!d.data || d.data <= hojeStr))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "andamento" ? -1 : 1));
  const feitasHoje = (ESTADO.demandas || []).filter((d) => d.status === "concluida" && d.data === hojeStr).length;
  const amanha = (ESTADO.demandas || []).filter((d) => d.status === "fazer" && d.data === somarDiasISO(hojeStr, 1)).length;
  const meta = Number((ESTADO.configuracoes || {}).metaAtividadesDia || 8);
  const resumo = document.getElementById("painel-plano-resumo");
  if (resumo) resumo.textContent = `Hoje: ${feitasHoje}/${meta} concluídas` + (amanha ? ` · ${amanha} já planejada(s) para amanhã` : "");
  document.getElementById("painel-tarefas-contagem").textContent = followups.length + emAndamento.length;
  const cardsFollow = followups.slice(0, 4).map((it, i) => {
    const wa = linkWhatsapp(it.contato, it.mensagem);
    const icone = it.tipo === "contato" ? "📞" : it.tipo === "lead" ? "🔎" : "📄";
    return `<div class="card-pasta">
      <span class="aba-avatar neutra">${icone}</span>
      <button class="aba-icone" data-ir="${it.tipo === "lead" ? "prospeccao" : it.tipo === "orcamento" ? "orcamentos" : "funil"}" title="Abrir" aria-label="Abrir">↗</button>
      <h4 class="card-pasta-nome">${escaparHtml(it.titulo)}</h4>
      <p class="card-pasta-sub">${escaparHtml(it.detalhe)}</p>
      <div class="card-pasta-acoes">
        ${wa ? `<a class="botao sucesso pequeno" href="${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
        <button class="botao secundario pequeno" data-feito-dia="${i}">Feito</button>
      </div>
    </div>`;
  });
  const cardsDemandas = emAndamento.slice(0, Math.max(0, 12 - cardsFollow.length)).map((d) => `
    <div class="card-pasta">
      <span class="aba-avatar neutra">🛠️</span>
      <button class="aba-icone" data-ir="painel" title="Demandas" aria-label="Abrir">↗</button>
      <h4 class="card-pasta-nome">${escaparHtml(d.titulo)}</h4>
      <p class="card-pasta-sub">${escaparHtml(d.cliente || "")} · ${d.status === "fazer" ? "A fazer" : "Em andamento"}</p>
      <div class="card-pasta-acoes">${seloCategoria(d.categoria)}
        <button class="botao sucesso pequeno" data-concluir-dia="${d.id}">Concluir</button>
      </div>
    </div>`);
  alvoTarefas.innerHTML = cardsFollow.concat(cardsDemandas).join("") || `<p class="card-sub" style="grid-column:1/-1;">Nada pendente para hoje. 🎉</p>`;

  /* --- planejar atividade (como a linha pré-pronta da planilha) --- */
  const btnPlan = document.getElementById("plano-add");
  if (btnPlan && !btnPlan.dataset.ok) {
    btnPlan.dataset.ok = "1";
    const sel = document.getElementById("plano-categoria");
    sel.innerHTML = `<option value="">Categoria</option>` + Object.keys(CATEGORIA_DEMANDA).map((c) => `<option>${c}</option>`).join("");
    const enviar = () => {
      const inp = document.getElementById("plano-texto"); const t = inp.value.trim(); if (!t) return;
      const dia = document.getElementById("plano-dia").value === "amanha" ? somarDiasISO(hojeISO(), 1) : hojeISO();
      atualizarEstado((e) => { e.demandas.push({ id: gerarId(), cliente: "Vespor", titulo: t, data: dia, status: "fazer", categoria: sel.value || undefined }); });
      inp.value = ""; atualizarPainel();
    };
    btnPlan.addEventListener("click", enviar);
    document.getElementById("plano-texto").addEventListener("keydown", (ev) => { if (ev.key === "Enter") enviar(); });
  }

  /* --- ações --- */
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
