/**
 * orcamentos.js
 * Gera orçamentos (por hora, projeto ou peça) com modelos reutilizáveis, texto pronto para
 * WhatsApp e documento em PDF. O painel privado da B3 (lado direito) é só para você, com chave para somar a reserva ao valor;
 * nunca aparece no texto ou no PDF enviados ao cliente. Ao aceitar um orçamento, o valor
 * entra no faturamento do cliente e uma cobrança é criada em Pagamentos.
 */

const ROTULOS_MODO = { hora: "Por hora", projeto: "Por projeto", peca: "Por peça" };
const UNIDADES_MODO = { hora: "hora(s)", projeto: "projeto", peca: "peça(s)" };

function gerarPdfOrcamento(o) {
  const cfg = ESTADO.configuracoes;
  const cliente = o.clienteId ? ESTADO.clientes.find((c) => c.id === o.clienteId) : null;
  const dataEmissao = o.data ? paraDataISO(o.data) : hojeISO();
  const validade = somarDiasISO(dataEmissao, Number(cfg.validadeOrcamentoDias) || 7);
  const qtd = Number(o.quantidade) || 1;
  const valorUnit = Number(o.valorUnitario) || Number(o.total) / qtd;

  const w = window.open("", "_blank");
  if (!w) { alert("O navegador bloqueou a janela do PDF. Permita pop-ups para este site e tente de novo."); return; }

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento${cliente ? " - " + escaparHtml(cliente.nome) : ""}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; max-width: 800px; margin: 0 auto; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #e8710a; padding-bottom: 16px; }
  h1 { margin: 0; font-size: 26px; }
  .sub { color: #666; font-size: 13px; margin-top: 4px; }
  .bloco { margin-top: 26px; }
  .bloco h2 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #888; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 12px; color: #666; border-bottom: 1px solid #ddd; padding: 8px 6px; }
  td { padding: 12px 6px; border-bottom: 1px solid #eee; font-size: 14px; }
  td.num, th.num { text-align: right; }
  .total { margin-top: 18px; text-align: right; font-size: 22px; font-weight: 700; }
  .total span { color: #e8710a; }
  .rodape { margin-top: 40px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 12px; }
  @media print { body { padding: 0; } }
</style></head><body>
  <div class="topo">
    <div>
      <h1>Orçamento</h1>
      <div class="sub">${escaparHtml(cfg.nomeProfissional || "")}${cfg.whatsapp ? " · WhatsApp " + escaparHtml(cfg.whatsapp) : ""}</div>
    </div>
    <div class="sub" style="text-align:right;">Emitido em ${formatarDataBR(dataEmissao)}<br>Válido até ${formatarDataBR(validade)}</div>
  </div>

  <div class="bloco">
    <h2>Cliente</h2>
    <div><b>${escaparHtml(cliente ? cliente.nome : "—")}</b></div>
    ${cliente && cliente.razaoSocial ? `<div class="sub">${escaparHtml(cliente.razaoSocial)}${cliente.cnpj ? " · CNPJ " + escaparHtml(cliente.cnpj) : ""}</div>` : ""}
  </div>

  <div class="bloco">
    <h2>Serviços</h2>
    <table>
      <thead><tr><th>Descrição</th><th class="num">Quantidade</th><th class="num">Valor unitário</th><th class="num">Total</th></tr></thead>
      <tbody>
        <tr>
          <td>${escaparHtml(o.descricao || "Serviço")}<br><span class="sub">${ROTULOS_MODO[o.modo] || ""}</span></td>
          <td class="num">${qtd.toLocaleString("pt-BR")} ${UNIDADES_MODO[o.modo] || ""}</td>
          <td class="num">${formatarMoeda(valorUnit)}</td>
          <td class="num">${formatarMoeda(o.total)}</td>
        </tr>
      </tbody>
    </table>
    <div class="total">Total: <span>${formatarMoeda(o.total)}</span></div>
  </div>

  <div class="rodape">Este orçamento é válido por ${Number(cfg.validadeOrcamentoDias) || 7} dias. Qualquer dúvida, estou à disposição.</div>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });<\/script>
</body></html>`);
  w.document.close();
}

function renderizarPaginaOrcamentos() {
  const container = document.getElementById("pagina-orcamentos");
  const cfg = ESTADO.configuracoes;
  const valorHoraSugerido = cfg.horasPagasPorMes ? Math.round(valorMinimoHora()) : 0;

  container.innerHTML = `
    <div class="orc-layout">
    <div class="orc-principal">
    <div class="form-grid" style="max-width:900px; grid-template-columns: repeat(3, 1fr);">
      <div class="campo" style="grid-column: 1 / -1;">
        <label>Modelo (preenche os campos para você)</label>
        <div style="display:flex; gap:8px;">
          <select id="orc-modelo" style="flex:1;">
            <option value="">— sem modelo —</option>
            ${ESTADO.modelosOrcamento.map((m) => `<option value="${m.id}">${escaparHtml(m.nome)}</option>`).join("")}
          </select>
          <button class="botao secundario pequeno" id="btn-excluir-modelo">Excluir modelo</button>
        </div>
      </div>
      <div class="campo">
        <label>Cliente</label>
        <select id="orc-cliente">
          <option value="">Selecione...</option>
          ${ESTADO.clientes.map((c) => `<option value="${c.id}">${escaparHtml(c.nome)}</option>`).join("")}
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
      <div class="campo"><label>Quantidade (horas/peças) ou 1 para projeto fechado</label><input type="number" id="orc-quantidade" value="1" min="0" step="any"></div>
      <div class="campo"><label>Valor unitário (R$)</label><input type="number" id="orc-valor-unitario" value="${valorHoraSugerido}" min="0" step="any"></div>
    </div>
    <div class="campo coluna-unica" style="margin-top:12px; max-width:900px;">
      <label>Descrição do serviço</label>
      <textarea id="orc-descricao" placeholder="Ex: Edição de 5 reels para Instagram"></textarea>
    </div>

    <div class="resultado-destaque">
      <span class="card-label">Valor total do orçamento</span>
      <div class="valor" id="orc-valor-total">R$ 0,00</div>
    </div>

    <div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="botao" id="btn-gerar-texto-orcamento">Gerar texto para WhatsApp</button>
      <button class="botao" id="btn-gerar-pdf-orcamento">📄 Gerar PDF</button>
      <button class="botao secundario" id="btn-registrar-orcamento">Registrar orçamento</button>
      <button class="botao secundario" id="btn-salvar-modelo">💾 Salvar como modelo</button>
    </div>

    <div id="orc-texto-gerado" style="display:none; margin-top:18px; max-width:700px;">
      <div class="campo"><label>Texto do orçamento (copie e envie ao cliente)</label><textarea id="orc-texto-area" style="min-height:200px;"></textarea></div>
      <button class="botao secundario" id="btn-copiar-orcamento" style="margin-top:8px;">Copiar texto</button>
    </div>
    </div>

    <aside class="orc-privado">
      <h4>🔒 Só para você</h4>
      <p class="card-sub">Nada daqui vai para o texto, o PDF ou o cliente.</p>
      <label class="chave-linha">
        <span class="chave"><input type="checkbox" id="orc-b3-ligado"><span class="chave-trilho"></span></span>
        <span>Somar reserva da B3 ao valor</span>
      </label>
      <div class="linha-resumo"><span class="rotulo">Valor base</span><span class="valor" id="orc-b3-base">R$ 0,00</span></div>
      <div class="linha-resumo"><span class="rotulo">Reserva (<span id="orc-b3-pct">0</span>%)</span><span class="valor" id="orc-b3-extra">R$ 0,00</span></div>
      <div class="linha-resumo"><span class="rotulo">Valor cobrado do cliente</span><span class="valor" id="orc-b3-final">R$ 0,00</span></div>
      <div class="aviso b3" id="orc-lembrete-b3"></div>
      <p class="card-sub">Ligada, a reserva é diluída no valor unitário e o cliente vê apenas o preço final.</p>
    </aside>
    </div>

    <h3 style="margin-top:32px;">Histórico de orçamentos</h3>
    <table class="tabela">
      <thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Data</th><th></th></tr></thead>
      <tbody id="tabela-orcamentos-corpo"></tbody>
    </table>
  `;

  const $ = (id) => document.getElementById(id);

  const pctB3 = Number(cfg.acaoB3.percentualReserva) || 0;
  const tickerB3 = cfg.acaoB3.ticker || "sua ação na B3";

  function calcularBase() {
    return (Number($("orc-quantidade").value) || 0) * (Number($("orc-valor-unitario").value) || 0);
  }
  function calcularExtra() {
    return $("orc-b3-ligado").checked ? calcularBase() * pctB3 / 100 : 0;
  }
  function calcularTotal() { return calcularBase() + calcularExtra(); }

  function atualizarTotal() {
    const base = calcularBase(), extra = calcularExtra(), total = base + extra;
    $("orc-valor-total").textContent = formatarMoeda(total);
    $("orc-b3-base").textContent = formatarMoeda(base);
    $("orc-b3-pct").textContent = pctB3;
    $("orc-b3-extra").textContent = extra > 0 ? "+ " + formatarMoeda(extra) : formatarMoeda(base * pctB3 / 100) + " (desligado)";
    $("orc-b3-final").textContent = formatarMoeda(total);
    $("orc-lembrete-b3").textContent = `💰 Ao receber ${formatarMoeda(total)}, separe ${formatarMoeda(base * pctB3 / 100)} (${pctB3}%) para comprar ${tickerB3}.`;
  }
  container.querySelectorAll("#orc-quantidade, #orc-valor-unitario, #orc-b3-ligado").forEach((el) => el.addEventListener("input", atualizarTotal));
  $("orc-b3-ligado").addEventListener("change", atualizarTotal);

  function dadosDoFormulario() {
    const qtd = Number($("orc-quantidade").value) || 0;
    const total = calcularTotal();
    return {
      clienteId: $("orc-cliente").value || null,
      descricao: $("orc-descricao").value.trim(),
      modo: $("orc-modo").value,
      quantidade: qtd,
      // com a reserva ligada, o valor unitário já sai diluído (o cliente não vê a reserva)
      valorUnitario: qtd > 0 ? total / qtd : Number($("orc-valor-unitario").value) || 0,
      total,
      data: new Date().toISOString(),
    };
  }

  /* --- modelos --- */
  $("orc-modelo").addEventListener("change", () => {
    const m = ESTADO.modelosOrcamento.find((x) => x.id === $("orc-modelo").value);
    if (!m) return;
    $("orc-descricao").value = m.descricao || "";
    $("orc-modo").value = m.modo;
    $("orc-quantidade").value = m.quantidade;
    $("orc-valor-unitario").value = m.valorUnitario;
    atualizarTotal();
  });
  $("btn-salvar-modelo").addEventListener("click", () => {
    const d = dadosDoFormulario();
    if (!d.descricao) { alert("Escreva a descrição do serviço para salvar como modelo."); return; }
    const nome = prompt("Nome do modelo:", d.descricao.slice(0, 40));
    if (!nome) return;
    atualizarEstado((e) => {
      e.modelosOrcamento.push({ id: gerarId(), nome: nome.trim(), descricao: d.descricao, modo: d.modo, quantidade: d.quantidade, valorUnitario: d.valorUnitario });
    });
    renderizarPaginaOrcamentos();
  });
  $("btn-excluir-modelo").addEventListener("click", () => {
    const id = $("orc-modelo").value;
    if (!id) { alert("Selecione um modelo para excluir."); return; }
    if (!confirm("Excluir este modelo?")) return;
    atualizarEstado((e) => { e.modelosOrcamento = e.modelosOrcamento.filter((m) => m.id !== id); });
    renderizarPaginaOrcamentos();
  });

  /* --- texto e PDF --- */
  $("btn-gerar-texto-orcamento").addEventListener("click", () => {
    const d = dadosDoFormulario();
    const cliente = ESTADO.clientes.find((c) => c.id === d.clienteId);
    const validade = Number(cfg.validadeOrcamentoDias) || 7;
    let texto = `Olá${cliente ? ", " + cliente.nome : ""}! Segue o orçamento:\n\n`;
    texto += `Serviço: ${d.descricao || "serviço"}\n`;
    if (d.modo !== "projeto" && d.quantidade) texto += `Quantidade: ${d.quantidade} ${UNIDADES_MODO[d.modo]} × ${formatarMoeda(d.valorUnitario)}\n`;
    texto += `Valor total: ${formatarMoeda(d.total)}\n`;
    texto += `Validade: ${validade} dias\n\nQualquer dúvida, estou à disposição!`;
    $("orc-texto-gerado").style.display = "block";
    $("orc-texto-area").value = texto;
  });

  $("btn-copiar-orcamento").addEventListener("click", async () => {
    const texto = $("orc-texto-area").value;
    try { await navigator.clipboard.writeText(texto); }
    catch { $("orc-texto-area").select(); document.execCommand("copy"); }
    alert("Texto copiado!");
  });

  $("btn-gerar-pdf-orcamento").addEventListener("click", () => {
    const d = dadosDoFormulario();
    if (!d.clienteId) { alert("Selecione um cliente."); return; }
    gerarPdfOrcamento(d);
  });

  /* --- histórico --- */
  function desenharTabelaOrcamentos() {
    const corpo = $("tabela-orcamentos-corpo");
    const lista = [...ESTADO.orcamentos].sort((a, b) => new Date(b.dataEnvio) - new Date(a.dataEnvio));
    corpo.innerHTML = lista.map((o) => {
      const cliente = ESTADO.clientes.find((c) => c.id === o.clienteId);
      const status = o.aceito ? '<span class="selo aceito">Aceito</span>' : o.recusado ? '<span class="selo recusado">Recusado</span>' : '<span class="selo enviado">Enviado</span>';
      return `
        <tr>
          <td>${cliente ? escaparHtml(cliente.nome) : "-"}</td>
          <td>${escaparHtml((o.descricao || "").slice(0, 40))}</td>
          <td>${formatarMoeda(o.valor)}</td>
          <td>${status}</td>
          <td>${new Date(o.dataEnvio).toLocaleDateString("pt-BR")}</td>
          <td style="white-space:nowrap;">
            ${!o.aceito && !o.recusado ? `<button class="botao sucesso pequeno" data-aceitar="${o.id}">Aceito</button> <button class="botao secundario pequeno" data-recusar="${o.id}">Recusado</button>` : ""}
            ${o.recusado ? `<button class="botao secundario pequeno" data-reabrir="${o.id}">Reabrir</button>` : ""}
            ${o.aceito ? `<button class="botao secundario pequeno" data-contrato="${o.id}">📝 Contrato</button>` : ""}
            <button class="botao secundario pequeno" data-pdf="${o.id}">PDF</button>
          </td>
        </tr>`;
    }).join("") || `<tr><td colspan="6" style="text-align:center; color:var(--cor-texto-suave);">Nenhum orçamento registrado.</td></tr>`;

    corpo.querySelectorAll("[data-aceitar]").forEach((btn) => btn.addEventListener("click", () => {
      atualizarEstado((estado) => {
        const orc = estado.orcamentos.find((o) => o.id === btn.dataset.aceitar);
        orc.aceito = true;
        orc.recusado = false;
        const cliente = estado.clientes.find((c) => c.id === orc.clienteId);
        if (cliente) {
          cliente.historicoFinanceiro = cliente.historicoFinanceiro || [];
          cliente.historicoFinanceiro.push({ data: new Date().toISOString(), valor: orc.valor, orcamentoId: orc.id });
          cliente.etapaFunil = "Ativos";
        }
        criarPagamentoDeOrcamento(estado, orc);
      });
      desenharTabelaOrcamentos();
      atualizarPainel();
    }));
    corpo.querySelectorAll("[data-recusar]").forEach((btn) => btn.addEventListener("click", () => {
      atualizarEstado((estado) => { estado.orcamentos.find((o) => o.id === btn.dataset.recusar).recusado = true; });
      desenharTabelaOrcamentos(); atualizarPainel();
    }));
    corpo.querySelectorAll("[data-reabrir]").forEach((btn) => btn.addEventListener("click", () => {
      atualizarEstado((estado) => {
        const o = estado.orcamentos.find((x) => x.id === btn.dataset.reabrir);
        o.recusado = false; o.ultimoFollowUp = hojeISO();
      });
      desenharTabelaOrcamentos(); atualizarPainel();
    }));
    corpo.querySelectorAll("[data-contrato]").forEach((btn) => btn.addEventListener("click", () => gerarContratoOrcamento(ESTADO.orcamentos.find((x) => x.id === btn.dataset.contrato))));
    corpo.querySelectorAll("[data-pdf]").forEach((btn) => btn.addEventListener("click", () => {
      const o = ESTADO.orcamentos.find((x) => x.id === btn.dataset.pdf);
      gerarPdfOrcamento({ clienteId: o.clienteId, descricao: o.descricao, modo: o.modo, quantidade: o.quantidade, valorUnitario: o.valorUnitario, total: o.valor, data: o.dataEnvio });
    }));
  }

  $("btn-registrar-orcamento").addEventListener("click", () => {
    const d = dadosDoFormulario();
    if (!d.clienteId) { alert("Selecione um cliente."); return; }
    if (d.total <= 0) { alert("Informe quantidade e valor maiores que zero."); return; }
    atualizarEstado((estado) => {
      estado.orcamentos.push({
        id: gerarId(),
        clienteId: d.clienteId,
        descricao: d.descricao,
        modo: d.modo,
        quantidade: d.quantidade,
        valorUnitario: d.valorUnitario,
        valor: d.total,
        dataEnvio: d.data,
        aceito: false,
        recusado: false,
      });
      const cliente = estado.clientes.find((c) => c.id === d.clienteId);
      if (cliente && cliente.etapaFunil === "Prospecção") cliente.etapaFunil = "Orçamento enviado";
    });
    desenharTabelaOrcamentos();
    atualizarPainel();
    alert("Orçamento registrado!");
  });

  atualizarTotal();
  desenharTabelaOrcamentos();
}
