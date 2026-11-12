/**
 * orcamentos.js
 * Gera orçamentos formatados (modos hora/projeto/peça), com lembrete de B3 e
 * texto pronto para copiar/enviar no WhatsApp. Também registra o valor no
 * histórico financeiro do cliente quando o orçamento é marcado como aceito.
 */

function renderizarPaginaOrcamentos() {
  const container = document.getElementById("pagina-orcamentos");

  container.innerHTML = `
    <div class="form-grid">
      <div class="campo">
        <label>Cliente</label>
        <select id="orc-cliente">
          <option value="">Selecione...</option>
          ${ESTADO.clientes.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("")}
        </select>
      </div>
      <div class="campo">
        <label>Modo de cobrança</label>
        <select id="orc-modo">
          <option value="hora">Por hora</option>
          <option value="projeto">Por projeto</option>
          <option value="peca">Por peça</option>
        </select>
      </div>
      <div class="campo"><label>Quantidade (horas/peças) ou 1 para projeto fechado</label><input type="number" id="orc-quantidade" value="1"></div>
      <div class="campo"><label>Valor unitário (R$)</label><input type="number" id="orc-valor-unitario" value="${ESTADO.configuracoes.horasPagasPorMes ? Math.round(calcularValorHora(ESTADO.configuracoes.salarioDesejado, ESTADO.configuracoes.custosFixosMensais, ESTADO.configuracoes.horasPagasPorMes)) : 0}"></div>
    </div>
    <div class="campo coluna-unica" style="margin-top:12px; max-width:700px;">
      <label>Descrição do serviço</label>
      <textarea id="orc-descricao" placeholder="Ex: Edição de 5 reels para Instagram"></textarea>
    </div>

    <div class="resultado-destaque">
      <span class="card-label">Valor total do orçamento</span>
      <div class="valor" id="orc-valor-total">R$ 0,00</div>
    </div>

    <div style="margin-top:16px; display:flex; gap:8px;">
      <button class="botao" id="btn-gerar-texto-orcamento">Gerar texto para WhatsApp</button>
      <button class="botao secundario" id="btn-registrar-orcamento">Registrar orçamento</button>
    </div>

    <div id="orc-texto-gerado" style="display:none; margin-top:18px; max-width:700px;">
      <div class="campo"><label>Texto do orçamento (copie e envie)</label><textarea id="orc-texto-area" style="min-height:220px;"></textarea></div>
      <button class="botao secundario" id="btn-copiar-orcamento">Copiar texto</button>
    </div>

    <h3 style="margin-top:32px;">Histórico de orçamentos</h3>
    <table class="tabela">
      <thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Data</th><th></th></tr></thead>
      <tbody id="tabela-orcamentos-corpo"></tbody>
    </table>
  `;

  function calcularTotal() {
    const qtd = Number(document.getElementById("orc-quantidade").value) || 0;
    const valorUnit = Number(document.getElementById("orc-valor-unitario").value) || 0;
    return qtd * valorUnit;
  }

  function atualizarTotal() {
    document.getElementById("orc-valor-total").textContent = formatarMoeda(calcularTotal());
  }

  container.querySelectorAll("#orc-quantidade, #orc-valor-unitario").forEach((el) =>
    el.addEventListener("input", atualizarTotal)
  );

  function montarTextoOrcamento() {
    const clienteId = document.getElementById("orc-cliente").value;
    const cliente = ESTADO.clientes.find((c) => c.id === clienteId);
    const descricao = document.getElementById("orc-descricao").value || "serviço";
    const total = calcularTotal();
    const reserva = ESTADO.configuracoes.acaoB3.percentualReserva || 0;
    const ticker = ESTADO.configuracoes.acaoB3.ticker;

    let texto = `Olá${cliente ? ", " + cliente.nome : ""}! Segue o orçamento:\n\n`;
    texto += `Serviço: ${descricao}\n`;
    texto += `Valor total: ${formatarMoeda(total)}\n\n`;
    texto += `Qualquer dúvida, estou à disposição!`;

    // Lembrete pessoal (B3) — não entra no texto enviado ao cliente
    const lembretePessoal = ticker
      ? `\n\n[Lembrete pessoal — não enviar ao cliente] Separar ${reserva}% (${formatarMoeda(total * reserva / 100)}) para comprar ${ticker}.`
      : "";

    return { textoCliente: texto, lembretePessoal };
  }

  document.getElementById("btn-gerar-texto-orcamento").addEventListener("click", () => {
    const { textoCliente, lembretePessoal } = montarTextoOrcamento();
    document.getElementById("orc-texto-gerado").style.display = "block";
    document.getElementById("orc-texto-area").value = textoCliente + lembretePessoal;
  });

  document.getElementById("btn-copiar-orcamento").addEventListener("click", () => {
    const textarea = document.getElementById("orc-texto-area");
    textarea.select();
    document.execCommand("copy");
    alert("Texto copiado!");
  });

  function desenharTabelaOrcamentos() {
    const corpo = document.getElementById("tabela-orcamentos-corpo");
    corpo.innerHTML = ESTADO.orcamentos
      .map((o) => {
        const cliente = ESTADO.clientes.find((c) => c.id === o.clienteId);
        return `
          <tr>
            <td>${cliente ? cliente.nome : "-"}</td>
            <td>${(o.descricao || "").slice(0, 40)}</td>
            <td>${formatarMoeda(o.valor)}</td>
            <td>${o.aceito ? "✅ Aceito" : "⏳ Enviado"}</td>
            <td>${new Date(o.dataEnvio).toLocaleDateString("pt-BR")}</td>
            <td>${!o.aceito ? `<button class="botao secundario pequeno" data-aceitar="${o.id}">Marcar aceito</button>` : ""}</td>
          </tr>`;
      })
      .join("") || `<tr><td colspan="6" style="text-align:center; color:var(--cor-texto-suave);">Nenhum orçamento registrado.</td></tr>`;

    corpo.querySelectorAll("[data-aceitar]").forEach((btn) =>
      btn.addEventListener("click", () => {
        atualizarEstado((estado) => {
          const orc = estado.orcamentos.find((o) => o.id === btn.dataset.aceitar);
          orc.aceito = true;
          const cliente = estado.clientes.find((c) => c.id === orc.clienteId);
          if (cliente) {
            cliente.historicoFinanceiro = cliente.historicoFinanceiro || [];
            cliente.historicoFinanceiro.push({ data: new Date().toISOString(), valor: orc.valor });
            cliente.etapaFunil = "Em andamento";
          }
        });
        desenharTabelaOrcamentos();
        atualizarPainel();
      })
    );
  }

  document.getElementById("btn-registrar-orcamento").addEventListener("click", () => {
    const clienteId = document.getElementById("orc-cliente").value;
    if (!clienteId) { alert("Selecione um cliente."); return; }
    atualizarEstado((estado) => {
      estado.orcamentos.push({
        id: gerarId(),
        clienteId,
        descricao: document.getElementById("orc-descricao").value,
        modo: document.getElementById("orc-modo").value,
        valor: calcularTotal(),
        dataEnvio: new Date().toISOString(),
        aceito: false,
      });
      const cliente = estado.clientes.find((c) => c.id === clienteId);
      if (cliente && cliente.etapaFunil === "Prospecção") cliente.etapaFunil = "Orçamento enviado";
    });
    desenharTabelaOrcamentos();
    atualizarPainel();
    alert("Orçamento registrado!");
  });

  atualizarTotal();
  desenharTabelaOrcamentos();
}
