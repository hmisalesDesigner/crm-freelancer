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

function renderizarLembretes() {
  const alvo = document.getElementById("painel-lembretes");
  if (!alvo) return;
  const itens = [];
  const hoje = hojeISO();

  const das = proximoVencimentoDAS();
  if (das) {
    const dias = diasEntre(hoje, das.vencimento);
    const nivel = dias < 0 ? "perigo" : dias <= 5 ? "alerta" : "";
    itens.push(`
      <div class="item-alerta ${nivel}">
        <div>
          <b>🧾 DAS do MEI</b>
          <span class="item-alerta-detalhe">Vence em ${formatarDataBR(das.vencimento)} ${dias < 0 ? `(atrasado há ${-dias} dia(s))` : dias === 0 ? "(hoje)" : `(em ${dias} dia(s))`}</span>
        </div>
        <button class="botao sucesso pequeno" data-das="${das.chave}">Já paguei</button>
      </div>`);
  }

  const prazo = proximoPrazoDASN();
  const diasDasn = diasEntre(hoje, prazo);
  if (diasDasn <= 60) {
    itens.push(`
      <div class="item-alerta ${diasDasn <= 15 ? "alerta" : ""}">
        <div>
          <b>📑 Declaração anual do MEI (DASN-SIMEI)</b>
          <span class="item-alerta-detalhe">Prazo até ${formatarDataBR(prazo)} (em ${diasDasn} dia(s))</span>
        </div>
      </div>`);
  }

  const t = totaisPagamentos();
  if (t.atrasados > 0) {
    itens.push(`
      <div class="item-alerta perigo">
        <div>
          <b>💳 Pagamentos em atraso</b>
          <span class="item-alerta-detalhe">${t.atrasados} pagamento(s) somando ${formatarMoeda(t.valorAtrasado)}</span>
        </div>
        <button class="botao secundario pequeno" data-ir="pagamentos">Ver</button>
      </div>`);
  }

  const limite = Number(ESTADO.configuracoes.limiteMeiAnual || 81000);
  const fat = calcularFaturamentoAno();
  const pct = (fat / limite) * 100;
  if (pct >= 70) {
    itens.push(`
      <div class="item-alerta ${pct >= 90 ? "perigo" : "alerta"}">
        <div>
          <b>⚠️ Limite do MEI</b>
          <span class="item-alerta-detalhe">Você já usou ${pct.toFixed(1)}% do limite anual (${formatarMoeda(fat)} de ${formatarMoeda(limite)})</span>
        </div>
      </div>`);
  }

  const hojeBase = hojeISO();
  (ESTADO.clientes || []).forEach((c) => {
    if (!c.aniversario) return;
    const [, mm, dd] = c.aniversario.split("-");
    let prox = `${hojeBase.slice(0, 4)}-${mm}-${dd}`;
    if (prox < hojeBase) prox = `${Number(hojeBase.slice(0, 4)) + 1}-${mm}-${dd}`;
    const dias = diasEntre(hojeBase, prox);
    if (dias <= 7) itens.push(`
      <div class="item-alerta">
        <div>
          <b>🎂 Aniversário: ${escaparHtml(c.nome)}</b>
          <span class="item-alerta-detalhe">${dias === 0 ? "É hoje! Mande uma mensagem." : `Em ${dias} dia(s), dia ${dd}/${mm}`}</span>
        </div>
        <button class="botao secundario pequeno" data-abrir-cliente-tarefa="${c.id}">Abrir</button>
      </div>`);
  });

  if (ESTADO.cronometroAtivo) {
    const tarefa = tarefaPorId(ESTADO.cronometroAtivo.tarefaId);
    itens.push(`
      <div class="item-alerta">
        <div>
          <b>⏱️ Relógio rodando</b>
          <span class="item-alerta-detalhe">${escaparHtml(tarefa ? tarefa.descricao : "Tarefa")}</span>
        </div>
        ${tarefa && tarefa.clienteId ? `<button class="botao secundario pequeno" data-abrir-cliente-tarefa="${tarefa.clienteId}">Abrir</button>` : ""}
      </div>`);
  }

  alvo.innerHTML = itens.join("") || `<p style="color:var(--cor-texto-suave); font-size:13px; margin:12px 0 0;">Tudo em dia. ✅</p>`;

  alvo.querySelectorAll("[data-das]").forEach((b) => b.addEventListener("click", () => {
    atualizarEstado((e) => {
      e.configuracoes.dasPagos = e.configuracoes.dasPagos || [];
      if (!e.configuracoes.dasPagos.includes(b.dataset.das)) e.configuracoes.dasPagos.push(b.dataset.das);
    });
    renderizarLembretes();
  }));
  alvo.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => irParaPagina(b.dataset.ir)));
  alvo.querySelectorAll("[data-abrir-cliente-tarefa]").forEach((b) => b.addEventListener("click", () => abrirPainelCliente(b.dataset.abrirClienteTarefa)));
}
