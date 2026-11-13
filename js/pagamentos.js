/**
 * pagamentos.js
 * Controle do dinheiro a receber: parcelas, vencimentos e status
 * (pendente / atrasado / pago), mais a mensalidade do cliente fixo.
 */

function adicionarMesesISO(dataISO, meses) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(alvo.getDate()).padStart(2, "0")}`;
}

function statusPagamento(p) {
  if (p.pago) return "pago";
  return p.vencimento < hojeISO() ? "atrasado" : "pendente";
}

function rotuloStatusPagamento(status) {
  return { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado" }[status];
}

function nomeClientePagamento(p) {
  if (p.clienteId) {
    const c = ESTADO.clientes.find((x) => x.id === p.clienteId);
    if (c) return c.nome;
  }
  return p.fixoMes ? "Cliente fixo" : "-";
}

function totaisPagamentos() {
  const mes = mesAtualChave();
  let aReceber = 0, valorAtrasado = 0, atrasados = 0, recebidoMes = 0;
  ESTADO.pagamentos.forEach((p) => {
    const valor = Number(p.valor || 0);
    if (p.pago) {
      if (p.dataPagamento && chaveMes(p.dataPagamento) === mes) recebidoMes += valor;
    } else {
      aReceber += valor;
      if (p.vencimento < hojeISO()) { atrasados++; valorAtrasado += valor; }
    }
  });
  return { aReceber, valorAtrasado, atrasados, recebidoMes };
}

/** Garante que exista a cobrança do mês atual do cliente fixo (só cria uma vez por mês). */
function garantirMensalidadeFixa() {
  const valor = Number(ESTADO.configuracoes.clienteFixoMensal || 0);
  if (valor <= 0) return;
  const mes = mesAtualChave();
  if (ESTADO.pagamentos.some((p) => p.fixoMes === mes)) return;
  const [a, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(a, m, 0).getDate();
  const dia = Math.min(Math.max(Number(ESTADO.configuracoes.diaPagamentoFixo) || 5, 1), ultimoDia);
  atualizarEstado((estado) => {
    estado.pagamentos.push({
      id: "fixo-" + mes,
      clienteId: null,
      descricao: "Mensalidade — cliente fixo",
      valor,
      vencimento: `${mes}-${String(dia).padStart(2, "0")}`,
      pago: false,
      dataPagamento: null,
      fixoMes: mes,
    });
  });
}

/** Chamada quando um orçamento é aceito: cria a cobrança correspondente (vence em 7 dias, editável depois). */
function criarPagamentoDeOrcamento(estado, orc) {
  if (estado.pagamentos.some((p) => p.orcamentoId === orc.id)) return;
  estado.pagamentos.push({
    id: gerarId(),
    clienteId: orc.clienteId,
    orcamentoId: orc.id,
    descricao: orc.descricao || "Orçamento aceito",
    valor: Number(orc.valor || 0),
    vencimento: somarDiasISO(hojeISO(), 7),
    pago: false,
    dataPagamento: null,
  });
}

function renderizarPaginaPagamentos() {
  garantirMensalidadeFixa();
  const container = document.getElementById("pagina-pagamentos");
  let filtro = "todos";

  container.innerHTML = `
    <div class="cards-resumo" style="grid-template-columns: repeat(3, 1fr); max-width: 900px;">
      <div class="card"><span class="card-label">A receber</span><span class="card-valor" id="pg-a-receber">R$ 0,00</span></div>
      <div class="card"><span class="card-label">Em atraso</span><span class="card-valor" id="pg-atrasado" style="color:var(--cor-perigo)">R$ 0,00</span><span class="card-sub" id="pg-atrasado-qtd"></span></div>
      <div class="card"><span class="card-label">Recebido neste mês</span><span class="card-valor" id="pg-recebido" style="color:var(--cor-sucesso)">R$ 0,00</span></div>
    </div>

    <div class="bloco-destaque" style="max-width:900px;">
      <h3>Novo pagamento / parcelamento</h3>
      <div class="form-grid" style="max-width:none; grid-template-columns: repeat(3, 1fr);">
        <div class="campo">
          <label>Cliente</label>
          <select id="pg-cliente">
            <option value="">(sem cliente)</option>
            ${ESTADO.clientes.map((c) => `<option value="${c.id}">${escaparHtml(c.nome)}</option>`).join("")}
          </select>
        </div>
        <div class="campo"><label>Descrição</label><input id="pg-descricao" placeholder="Ex: Identidade visual"></div>
        <div class="campo"><label>Valor total (R$)</label><input type="number" id="pg-valor" step="0.01"></div>
        <div class="campo"><label>Nº de parcelas</label><input type="number" id="pg-parcelas" value="1" min="1" max="36"></div>
        <div class="campo"><label>1º vencimento</label><input type="date" id="pg-vencimento" value="${somarDiasISO(hojeISO(), 7)}"></div>
        <div class="campo"><label>&nbsp;</label><button class="botao" id="btn-add-pagamento">+ Lançar</button></div>
      </div>
    </div>

    <div class="filtros" id="pg-filtros" style="margin: 18px 0 10px;">
      <button class="chip ativo" data-filtro="todos">Todos</button>
      <button class="chip" data-filtro="pendente">Pendentes</button>
      <button class="chip" data-filtro="atrasado">Atrasados</button>
      <button class="chip" data-filtro="pago">Pagos</button>
    </div>

    <table class="tabela" style="max-width:900px;">
      <thead><tr><th>Vencimento</th><th>Cliente / descrição</th><th>Valor</th><th>Status</th><th></th></tr></thead>
      <tbody id="pg-corpo"></tbody>
    </table>
  `;

  function desenhar() {
    const t = totaisPagamentos();
    document.getElementById("pg-a-receber").textContent = formatarMoeda(t.aReceber);
    document.getElementById("pg-atrasado").textContent = formatarMoeda(t.valorAtrasado);
    document.getElementById("pg-atrasado-qtd").textContent = t.atrasados ? `${t.atrasados} pagamento(s) atrasado(s)` : "Nada atrasado";
    document.getElementById("pg-recebido").textContent = formatarMoeda(t.recebidoMes);

    const lista = [...ESTADO.pagamentos]
      .filter((p) => filtro === "todos" || statusPagamento(p) === filtro)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    const corpo = document.getElementById("pg-corpo");
    corpo.innerHTML = lista.map((p) => {
      const st = statusPagamento(p);
      return `
        <tr>
          <td>${formatarDataBR(p.vencimento)}</td>
          <td><b>${escaparHtml(nomeClientePagamento(p))}</b><br><span style="color:var(--cor-texto-suave); font-size:12px;">${escaparHtml(p.descricao || "")}</span></td>
          <td>${formatarMoeda(p.valor)}</td>
          <td><span class="selo ${st}">${rotuloStatusPagamento(st)}</span></td>
          <td style="white-space:nowrap;">
            ${p.pago
              ? `<button class="botao secundario pequeno" data-desfazer="${p.id}">Desfazer</button>`
              : `<button class="botao sucesso pequeno" data-pagar="${p.id}">Marcar pago</button>`}
            ${p.fixoMes ? "" : `<button class="botao perigo pequeno" data-excluir="${p.id}">Excluir</button>`}
          </td>
        </tr>`;
    }).join("") || `<tr><td colspan="5" style="text-align:center; color:var(--cor-texto-suave);">Nenhum pagamento nesta visão.</td></tr>`;

    corpo.querySelectorAll("[data-pagar]").forEach((b) => b.addEventListener("click", () => {
      atualizarEstado((e) => { const p = e.pagamentos.find((x) => x.id === b.dataset.pagar); p.pago = true; p.dataPagamento = hojeISO(); });
      desenhar(); atualizarPainel();
    }));
    corpo.querySelectorAll("[data-desfazer]").forEach((b) => b.addEventListener("click", () => {
      atualizarEstado((e) => { const p = e.pagamentos.find((x) => x.id === b.dataset.desfazer); p.pago = false; p.dataPagamento = null; });
      desenhar(); atualizarPainel();
    }));
    corpo.querySelectorAll("[data-excluir]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Excluir este pagamento?")) return;
      atualizarEstado((e) => { e.pagamentos = e.pagamentos.filter((x) => x.id !== b.dataset.excluir); });
      desenhar(); atualizarPainel();
    }));
  }

  container.querySelectorAll("#pg-filtros .chip").forEach((chip) => chip.addEventListener("click", () => {
    container.querySelectorAll("#pg-filtros .chip").forEach((c) => c.classList.remove("ativo"));
    chip.classList.add("ativo");
    filtro = chip.dataset.filtro;
    desenhar();
  }));

  document.getElementById("btn-add-pagamento").addEventListener("click", () => {
    const total = Number(document.getElementById("pg-valor").value) || 0;
    const parcelas = Math.min(Math.max(parseInt(document.getElementById("pg-parcelas").value, 10) || 1, 1), 36);
    const primeiro = document.getElementById("pg-vencimento").value;
    if (total <= 0) { alert("Informe o valor."); return; }
    if (!primeiro) { alert("Informe o 1º vencimento."); return; }
    const clienteId = document.getElementById("pg-cliente").value || null;
    const descricao = document.getElementById("pg-descricao").value.trim();

    const centavos = Math.round(total * 100);
    const base = Math.floor(centavos / parcelas);
    atualizarEstado((e) => {
      for (let i = 0; i < parcelas; i++) {
        const valorCent = i === parcelas - 1 ? centavos - base * (parcelas - 1) : base;
        e.pagamentos.push({
          id: gerarId(),
          clienteId,
          descricao: parcelas > 1 ? `${descricao || "Parcela"} (${i + 1}/${parcelas})` : descricao,
          valor: valorCent / 100,
          vencimento: adicionarMesesISO(primeiro, i),
          pago: false,
          dataPagamento: null,
        });
      }
    });
    document.getElementById("pg-valor").value = "";
    document.getElementById("pg-descricao").value = "";
    desenhar(); atualizarPainel();
  });

  desenhar();
}
