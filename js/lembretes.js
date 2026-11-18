/**
 * lembretes.js
 * Lembretes fiscais do MEI e alertas gerais do painel:
 *  - DAS mensal: vence todo dia 20.
 *  - DASN-SIMEI (declaração anual): até 31 de maio.
 *  - Pagamentos em atraso e limite do MEI.
 */

function proximoVencimentoDAS() {
  // Mês cujo DAS ainda não foi pago, a partir do mês atual (vence dia 20 do mês seguinte à competência;
  // aqui tratamos pelo mês do vencimento para simplificar a marcação).
  const hoje = new Date();
  const pagos = ESTADO.configuracoes.dasPagos || [];
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth(); // 0-11
  for (let i = 0; i < 14; i++) {
    const chave = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    const venc = `${chave}-20`;
    if (!pagos.includes(chave) && (venc >= hojeISO() || i === 0)) {
      return { chave, vencimento: venc };
    }
    mes++;
    if (mes > 11) { mes = 0; ano++; }
  }
  return null;
}

function proximoPrazoDASN() {
  const hoje = hojeISO();
  const ano = new Date().getFullYear();
  const prazo = hoje <= `${ano}-05-31` ? `${ano}-05-31` : `${ano + 1}-05-31`;
  return prazo;
}

function itemAlerta(nivel, titulo, detalhe, botao) {
  return `
    <div class="item-alerta ${nivel || ""}">
      <div>
        <b>${titulo}</b>
        <span class="item-alerta-detalhe">${detalhe}</span>
      </div>
      ${botao || ""}
    </div>`;
}

/** Lembretes de dinheiro: DAS, declaração anual, pagamentos em atraso e limite do MEI. */
function itensLembretesFinanceiro() {
  const itens = [];
  const hoje = hojeISO();

  const das = proximoVencimentoDAS();
  if (das) {
    const dias = diasEntre(hoje, das.vencimento);
    itens.push(itemAlerta(dias < 0 ? "perigo" : dias <= 5 ? "alerta" : "", "🧾 DAS do MEI",
      `Vence em ${formatarDataBR(das.vencimento)} ${dias < 0 ? `(atrasado há ${-dias} dia(s))` : dias === 0 ? "(hoje)" : `(em ${dias} dia(s))`}`,
      `<button class="botao sucesso pequeno" data-das="${das.chave}">Já paguei</button>`));
  }

  const prazo = proximoPrazoDASN();
  const diasDasn = diasEntre(hoje, prazo);
  if (diasDasn <= 60) {
    itens.push(itemAlerta(diasDasn <= 15 ? "alerta" : "", "📑 Declaração anual do MEI (DASN-SIMEI)", `Prazo até ${formatarDataBR(prazo)} (em ${diasDasn} dia(s))`));
  }

  const t = totaisPagamentos();
  if (t.atrasados > 0) {
    itens.push(itemAlerta("perigo", "💳 Pagamentos em atraso", `${t.atrasados} pagamento(s) somando ${formatarMoeda(t.valorAtrasado)}`,
      `<button class="botao secundario pequeno" data-ir="pagamentos">Ver</button>`));
  }

  const limite = Number(ESTADO.configuracoes.limiteMeiAnual || 81000);
  const fat = calcularFaturamentoAno();
  const pct = (fat / limite) * 100;
  if (pct >= 70) {
    itens.push(itemAlerta(pct >= 90 ? "perigo" : "alerta", "⚠️ Limite do MEI", `Você já usou ${pct.toFixed(1)}% do limite anual (${formatarMoeda(fat)} de ${formatarMoeda(limite)})`));
  }
  return itens;
}

/** Lembretes do trabalho: follow-ups, demandas para responder/atrasadas, relógio e aniversários. */
function itensLembretesServicos() {
  const itens = [];
  const hoje = hojeISO();

  obterFollowUps().forEach((it) => {
    const destino = it.tipo === "lead" ? "prospeccao" : it.tipo === "orcamento" ? "orcamentos" : "funil";
    itens.push(itemAlerta((it.atraso || 0) > 0 ? "alerta" : "", `${it.tipo === "lead" ? "🔎" : it.tipo === "orcamento" ? "📄" : "📞"} ${escaparHtml(it.titulo)}`, escaparHtml(it.detalhe),
      `<button class="botao secundario pequeno" data-ir="${destino}">Abrir</button>`));
  });

  const demandas = ESTADO.demandas || [];
  const responder = demandas.filter((d) => d.status === "responder");
  if (responder.length) {
    itens.push(itemAlerta("alerta", "✉️ Demandas para responder", `${responder.length} aguardando resposta: ${escaparHtml(responder.slice(0, 2).map((d) => d.titulo).join("; "))}${responder.length > 2 ? "…" : ""}`,
      `<button class="botao secundario pequeno" data-ir="painel">Ver</button>`));
  }
  const atrasadas = demandas.filter((d) => ["fazer", "andamento"].includes(d.status) && d.data && d.data < hoje);
  if (atrasadas.length) {
    itens.push(itemAlerta("perigo", "⏰ Demandas atrasadas", `${atrasadas.length} planejada(s) para dias anteriores e ainda em aberto`,
      `<button class="botao secundario pequeno" data-ir="painel">Ver</button>`));
  }

  (ESTADO.clientes || []).forEach((c) => {
    if (!c.aniversario) return;
    const [, mm, dd] = c.aniversario.split("-");
    let prox = `${hoje.slice(0, 4)}-${mm}-${dd}`;
    if (prox < hoje) prox = `${Number(hoje.slice(0, 4)) + 1}-${mm}-${dd}`;
    const dias = diasEntre(hoje, prox);
    if (dias <= 7) itens.push(itemAlerta("", `🎂 Aniversário: ${escaparHtml(c.nome)}`, dias === 0 ? "É hoje! Mande uma mensagem." : `Em ${dias} dia(s), dia ${dd}/${mm}`,
      `<button class="botao secundario pequeno" data-abrir-cliente-tarefa="${c.id}">Abrir</button>`));
  });

  if (ESTADO.cronometroAtivo) {
    const tarefa = tarefaPorId(ESTADO.cronometroAtivo.tarefaId);
    itens.push(itemAlerta("", "⏱️ Relógio rodando", escaparHtml(tarefa ? tarefa.descricao : "Tarefa"),
      tarefa && tarefa.clienteId ? `<button class="botao secundario pequeno" data-abrir-cliente-tarefa="${tarefa.clienteId}">Abrir</button>` : ""));
  }
  return itens;
}

function ligarLembretes(alvo) {
  alvo.querySelectorAll("[data-das]").forEach((b) => b.addEventListener("click", () => {
    atualizarEstado((e) => {
      e.configuracoes.dasPagos = e.configuracoes.dasPagos || [];
      if (!e.configuracoes.dasPagos.includes(b.dataset.das)) e.configuracoes.dasPagos.push(b.dataset.das);
    });
    renderizarLembretes();
  }));
  alvo.querySelectorAll("[data-das-desfazer]").forEach((b) => b.addEventListener("click", () => {
    atualizarEstado((e) => { e.configuracoes.dasPagos = (e.configuracoes.dasPagos || []).filter((x) => x !== b.dataset.dasDesfazer); });
    renderizarLembretes();
  }));
  alvo.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => irParaPagina(b.dataset.ir)));
  alvo.querySelectorAll("[data-abrir-cliente-tarefa]").forEach((b) => b.addEventListener("click", () => abrirPainelCliente(b.dataset.abrirClienteTarefa)));
}

/** Página "Lembretes": duas seções, Serviços e Financeiro. */
function renderizarPaginaLembretes() {
  const pagina = document.getElementById("pagina-lembretes");
  if (!pagina) return;
  const servicos = itensLembretesServicos();
  const financeiro = itensLembretesFinanceiro();
  const pagos = [...(ESTADO.configuracoes.dasPagos || [])].sort().reverse().slice(0, 6);
  const vazio = `<p style="color:var(--cor-texto-suave); font-size:13px; margin:12px 0 0;">Tudo em dia. ✅</p>`;
  pagina.innerHTML = `
    <div class="painel-grafico-funil" style="margin-bottom:16px;">
      <h3>💼 Serviços <span class="card-sub" style="display:inline;">(${servicos.length})</span></h3>
      <div id="lembretes-servicos">${servicos.join("") || vazio}</div>
    </div>
    <div class="painel-grafico-funil">
      <h3>💰 Financeiro <span class="card-sub" style="display:inline;">(${financeiro.length})</span></h3>
      <div id="lembretes-financeiro">${financeiro.join("") || vazio}</div>
      ${pagos.length ? `<h4 style="margin:16px 0 6px;">DAS marcados como pagos</h4>
        <div class="das-pagos">${pagos.map((c) => `<span class="chip-mini">DAS ${c.slice(5)}/${c.slice(0, 4)} ✔ <button class="link-desfazer" data-das-desfazer="${c}" title="Desfazer: marcar como não pago">desfazer</button></span>`).join("")}</div>` : ""}
    </div>`;
  ligarLembretes(pagina);
}

/** Atualiza o contador do botão no topo do Painel e, se a página estiver aberta, a lista. */
function renderizarLembretes() {
  const total = itensLembretesServicos().length + itensLembretesFinanceiro().length;
  const n = document.getElementById("lembretes-contagem");
  if (n) n.textContent = total;
  const pagina = document.getElementById("pagina-lembretes");
  if (pagina && pagina.classList.contains("ativa")) renderizarPaginaLembretes();
}
