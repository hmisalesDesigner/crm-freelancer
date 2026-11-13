/**
 * documentos.js
 * Recibo de pagamento (PIX) e contrato simples de prestação de serviços, em PDF
 * (janela de impressão → "Salvar como PDF"). O contrato é um MODELO: revise antes de usar.
 * Nada daqui menciona a reserva da B3.
 */

const UNIDADES_EXT = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS_EXT = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS_EXT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function extensoAte999(n) {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100, partes = [];
  if (c) partes.push(CENTENAS_EXT[c]);
  if (r) partes.push(r < 20 ? UNIDADES_EXT[r] : DEZENAS_EXT[Math.floor(r / 10)] + (r % 10 ? " e " + UNIDADES_EXT[r % 10] : ""));
  return partes.join(" e ");
}

function inteiroPorExtenso(n) {
  if (n === 0) return "zero";
  const milhares = Math.floor(n / 1000), resto = n % 1000, partes = [];
  if (milhares) partes.push(milhares === 1 ? "mil" : extensoAte999(milhares) + " mil");
  if (resto) partes.push(extensoAte999(resto));
  return partes.length === 2 && (resto < 100 || resto % 100 === 0) ? partes.join(" e ") : partes.join(" ");
}

function valorPorExtenso(valor) {
  const cent = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(cent / 100), centavos = cent % 100;
  const partes = [];
  if (reais > 0 || centavos === 0) partes.push(inteiroPorExtenso(reais) + (reais === 1 ? " real" : " reais"));
  if (centavos > 0) partes.push(inteiroPorExtenso(centavos) + (centavos === 1 ? " centavo" : " centavos"));
  return partes.join(" e ");
}

function abrirDocumentoParaImpressao(titulo, corpoHtml) {
  const w = window.open("", "_blank");
  if (!w) { alert("O navegador bloqueou a janela do documento. Permita pop-ups para este site e tente de novo."); return; }
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escaparHtml(titulo)}</title>
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 40px; line-height: 1.55; font-size: 14px; }
  h1 { font-size: 24px; margin: 0 0 4px; border-bottom: 3px solid #e8710a; padding-bottom: 12px; }
  h2 { font-size: 14px; margin: 22px 0 6px; text-transform: uppercase; letter-spacing: .05em; color: #555; }
  p { margin: 6px 0; text-align: justify; }
  .destaque { font-size: 20px; font-weight: 700; color: #e8710a; }
  .assinaturas { display: flex; gap: 40px; margin-top: 70px; }
  .assinaturas div { flex: 1; border-top: 1px solid #1a1a1a; padding-top: 6px; text-align: center; font-size: 13px; }
  .nota { margin-top: 30px; font-size: 11px; color: #777; }
  @media print { body { padding: 0; } }
</style></head><body>${corpoHtml}
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });<\/script></body></html>`);
  w.document.close();
}

function dataPorExtenso(iso) {
  const d = new Date(paraDataISO(iso) + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function identificacaoDoProfissional() {
  const cfg = ESTADO.configuracoes;
  return { nome: cfg.nomeProfissional || "Profissional", whatsapp: cfg.whatsapp || "" };
}

function gerarReciboPagamento(pagamento) {
  const cliente = ESTADO.clientes.find((c) => c.id === pagamento.clienteId);
  const eu = identificacaoDoProfissional();
  const dataPg = pagamento.dataPagamento || hojeISO();
  const nomeCliente = cliente ? (cliente.razaoSocial || cliente.nome) : "cliente";
  abrirDocumentoParaImpressao("Recibo - " + nomeCliente, `
    <h1>Recibo</h1>
    <p class="destaque">${formatarMoeda(pagamento.valor)}</p>
    <p>Recebi de <b>${escaparHtml(nomeCliente)}</b>${cliente && cliente.cnpj ? `, CNPJ ${escaparHtml(cliente.cnpj)}` : ""}, a quantia de
    <b>${formatarMoeda(pagamento.valor)}</b> (${valorPorExtenso(pagamento.valor)}), via PIX${pagamento.descricao ? `, referente a <b>${escaparHtml(pagamento.descricao)}</b>` : ""}.</p>
    <p>Pelo que firmo o presente recibo, dando plena quitação do valor acima.</p>
    <p style="margin-top:24px;">Maringá-PR, ${dataPorExtenso(dataPg)}.</p>
    <div class="assinaturas"><div>${escaparHtml(eu.nome)}${eu.whatsapp ? "<br>WhatsApp " + escaparHtml(eu.whatsapp) : ""}</div></div>`);
}

function gerarContratoOrcamento(orc) {
  const cliente = ESTADO.clientes.find((c) => c.id === orc.clienteId);
  const eu = identificacaoDoProfissional();
  const prazo = prompt("Prazo de entrega (ex: 7 dias úteis após o briefing e o sinal):", "7 dias úteis");
  if (prazo === null) return;
  const pags = ESTADO.pagamentos.filter((p) => p.orcamentoId === orc.id).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const nomeCliente = cliente ? (cliente.razaoSocial || cliente.nome) : "CONTRATANTE";
  const condicoes = pags.length > 1
    ? pags.map((p) => `${escaparHtml(p.descricao || "Pagamento")}: ${formatarMoeda(p.valor)}, até ${formatarDataBR(p.vencimento)}`).join("; ")
    : `pagamento único via PIX, até ${pags[0] ? formatarDataBR(pags[0].vencimento) : "a data combinada"}`;
  const qtd = Number(orc.quantidade) || 1;
  abrirDocumentoParaImpressao("Contrato - " + nomeCliente, `
    <h1>Contrato de Prestação de Serviços</h1>
    <h2>Partes</h2>
    <p><b>CONTRATADO:</b> ${escaparHtml(eu.nome)}, microempreendedor individual (MEI)${eu.whatsapp ? ", WhatsApp " + escaparHtml(eu.whatsapp) : ""}.</p>
    <p><b>CONTRATANTE:</b> ${escaparHtml(nomeCliente)}${cliente && cliente.cnpj ? `, CNPJ ${escaparHtml(cliente.cnpj)}` : ""}.</p>
    <h2>1. Objeto</h2>
    <p>Prestação dos seguintes serviços: <b>${escaparHtml(orc.descricao || "serviços de design/edição")}</b>${qtd > 1 ? ` (quantidade: ${qtd.toLocaleString("pt-BR")})` : ""}.</p>
    <h2>2. Valor e pagamento</h2>
    <p>Pelos serviços, o CONTRATANTE pagará <b>${formatarMoeda(orc.valor)}</b> (${valorPorExtenso(orc.valor)}), por <b>PIX</b>: ${condicoes}.</p>
    <h2>3. Prazo</h2>
    <p>A entrega será feita em ${escaparHtml(prazo || "prazo a combinar")}, contado a partir do recebimento do briefing e dos materiais e do pagamento do sinal, se houver. Atrasos no envio de materiais ou nas aprovações prorrogam o prazo na mesma medida.</p>
    <h2>4. Revisões</h2>
    <p>Estão incluídas até 2 (duas) rodadas de ajustes sobre o que foi briefado. Mudanças de escopo ou novas versões serão orçadas à parte.</p>
    <h2>5. Direitos e uso</h2>
    <p>Após a quitação integral, o CONTRATANTE poderá usar o material entregue para os fins acordados. O CONTRATADO poderá exibir o trabalho em portfólio, salvo pedido de sigilo por escrito.</p>
    <h2>6. Cancelamento</h2>
    <p>Em caso de cancelamento pelo CONTRATANTE, o sinal não é reembolsável e o trabalho já executado será cobrado proporcionalmente.</p>
    <h2>7. Foro</h2>
    <p>As partes elegem o foro da comarca de Maringá-PR para resolver eventuais divergências.</p>
    <p style="margin-top:24px;">Maringá-PR, ${dataPorExtenso(hojeISO())}.</p>
    <div class="assinaturas"><div>${escaparHtml(eu.nome)}<br>CONTRATADO</div><div>${escaparHtml(nomeCliente)}<br>CONTRATANTE</div></div>
    <p class="nota">Modelo simples de contrato. Revise as cláusulas e, em casos de valor alto, consulte um advogado.</p>`);
}
