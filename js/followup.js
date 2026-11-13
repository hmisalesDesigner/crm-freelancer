/**
 * followup.js
 * Alertas de acompanhamento: clientes com contato agendado para hoje/atrasado e
 * orçamentos enviados que ficaram sem resposta por alguns dias.
 */

function obterFollowUps() {
  const hoje = hojeISO();
  const limiteDias = Number(ESTADO.configuracoes.diasFollowUp) || 3;
  const itens = [];

  ESTADO.clientes.forEach((c) => {
    if (c.etapaFunil === "Inativos" || !c.proximoContato) return;
    if (c.proximoContato <= hoje) {
      itens.push({
        tipo: "contato",
        clienteId: c.id,
        atraso: diasEntre(c.proximoContato, hoje),
        titulo: c.nome,
        detalhe: c.proximoContato === hoje ? "Contato marcado para hoje" : `Contato atrasado há ${diasEntre(c.proximoContato, hoje)} dia(s)`,
        contato: c.contato,
        mensagem: `Olá, ${c.nome}! Tudo bem? Passando para retomar nosso contato.`,
      });
    }
  });

  ESTADO.orcamentos.forEach((o) => {
    if (o.aceito || o.recusado) return;
    const base = o.ultimoFollowUp || paraDataISO(o.dataEnvio);
    const dias = diasEntre(base, hoje);
    if (dias >= limiteDias) {
      const c = ESTADO.clientes.find((x) => x.id === o.clienteId);
      itens.push({
        tipo: "orcamento",
        orcamentoId: o.id,
        atraso: dias,
        titulo: c ? c.nome : "Orçamento",
        detalhe: `Orçamento de ${formatarMoeda(o.valor)} sem resposta há ${dias} dia(s)`,
        contato: c ? c.contato : "",
        mensagem: `Olá${c ? ", " + c.nome : ""}! Tudo bem? Conseguiu analisar o orçamento${o.descricao ? " de " + o.descricao : ""} (${formatarMoeda(o.valor)})? Fico à disposição para ajustar o que for preciso.`,
      });
    }
  });

  return itens.sort((a, b) => b.atraso - a.atraso);
}

function renderizarFollowUpsPainel() {
  const alvo = document.getElementById("painel-followups");
  if (!alvo) return;
  const itens = obterFollowUps();

  if (!itens.length) {
    alvo.innerHTML = `<p style="color:var(--cor-texto-suave); font-size:13px; margin:12px 0 0;">Nenhum follow-up pendente. 🎉</p>`;
    return;
  }

  alvo.innerHTML = itens.slice(0, 6).map((it, i) => {
    const wa = linkWhatsapp(it.contato, it.mensagem);
    return `
      <div class="item-alerta">
        <div style="min-width:0;">
          <b>${it.tipo === "contato" ? "📞" : "📄"} ${escaparHtml(it.titulo)}</b>
          <span class="item-alerta-detalhe">${escaparHtml(it.detalhe)}</span>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          ${wa ? `<a class="botao sucesso pequeno" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          <button class="botao secundario pequeno" data-followup="${i}">Feito</button>
        </div>
      </div>`;
  }).join("") + (itens.length > 6 ? `<p class="card-sub">+ ${itens.length - 6} outros pendentes</p>` : "");

  alvo.querySelectorAll("[data-followup]").forEach((btn) => btn.addEventListener("click", () => {
    const it = itens[Number(btn.dataset.followup)];
    atualizarEstado((e) => {
      if (it.tipo === "contato") {
        const c = e.clientes.find((x) => x.id === it.clienteId);
        if (c) { c.ultimoContato = hojeISO(); c.proximoContato = ""; }
      } else {
        const o = e.orcamentos.find((x) => x.id === it.orcamentoId);
        if (o) o.ultimoFollowUp = hojeISO();
      }
    });
    atualizarPainel();
  }));
}
