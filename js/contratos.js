/**
 * contratos.js
 * Contrato completo (modelos do Henrique: Prestação de Serviços e Social Media), gerado em PDF
 * a partir do painel do cliente. CPF e RG do contratante ficam em branco para preencher à mão
 * (o CRM não guarda esses documentos). Foro: Maringá-PR.
 */

function gerarContratoModelo(clienteId, o) {
  const cliente = ESTADO.clientes.find((c) => c.id === clienteId);
  if (!cliente) return;
  const eu = identificacaoDoProfissional();
  const nomeCliente = cliente.razaoSocial || cliente.nome;
  const linha = (v, vazio) => (v ? escaparHtml(v) : vazio);
  const valor = Number(o.valor) || 0;
  const multa = Number(o.multa) || 2, juros = Number(o.juros) || 1;
  const trocas = {
    contratado: `<b>CONTRATADO:</b> ${escaparHtml(eu.nome)}, CNPJ / CPF: ____________________, localizada na Rua ____________________, nº ______, na cidade de Maringá – PR, telefone (__) _____-____ – Celular ${linha(eu.whatsapp, "(__) _____-____")}.`,
    contratante: `<b>CONTRATANTE:</b> ${escaparHtml(nomeCliente)}${cliente.cnpj ? `, CNPJ ${escaparHtml(cliente.cnpj)}` : ""}, CPF nº _______________, RG nº _______________, residente e domiciliado na Rua ____________________, n.º ______, na cidade de ______________, estado do/de ______.`,
    periodo: `O início da prestação do serviço será contado a partir do dia <b>${o.inicio ? formatarDataBR(o.inicio) : "__/__/____"}</b> e findará no dia <b>${o.fim ? formatarDataBR(o.fim) : "__/__/____"}</b>.`,
    posts: `O contratado deverá cumprir os prazos de postagens que serão de <b>${Number(o.postsSemana) || "__"}</b> postagens por semana em horário comercial de Segunda-feira à Sexta-feira totalizando <b>${Number(o.postsSemana) ? Number(o.postsSemana) * 4 : "___"}</b> postagens mensais que poderão ser previamente agendadas.`,
    valor: `Pelos serviços prestados, a CONTRATANTE pagará ao CONTRATADO o valor total de <b>${valor ? formatarMoeda(valor) : "R$ ______"}</b>${valor ? ` (${valorPorExtenso(valor)} líquidos)` : ""}${o.periodicidade === "mensal" ? ", por mês," : ""} através de boleto emitido pelo CONTRATADO.`,
    atraso: `O não pagamento, do serviço prestado, até a data do vencimento sujeitará a CONTRATANTE, imediata e independentemente de notificação ou interpelação judicial ou extrajudicial, ao pagamento de multa de ${multa}% (${multa === 2 ? "dois" : multa} por cento) sobre o valor em atraso, acrescida de juros de mora de ${juros}% (${juros === 1 ? "um" : juros} por cento) ao mês.`,
    servicos: `<b>${escaparHtml(o.servicos || "DETALHAR QUAIS OS SERVIÇOS QUE SERÃO PRESTADOS.")}</b>`,
  };
  const corpo = CONTRATO_MODELOS[o.tipo].map(([k, t]) => {
    const m = t.match(/^\{\{(\w+)\}\}$/);
    if (m) return `<p>${trocas[m[1]]}</p>`;
    if (k === "h") return `<h2>${escaparHtml(t)}</h2>`;
    if (k === "i") return `<h3>${escaparHtml(t)}</h3>`;
    return `<p>${escaparHtml(t)}</p>`;
  }).join("");
  abrirDocumentoParaImpressao("Contrato - " + nomeCliente, `
    <h1>${escaparHtml(CONTRATO_TITULOS[o.tipo])}</h1>
    ${corpo}
    <p style="margin-top:24px;">Maringá-PR, ${dataPorExtenso(hojeISO())}.</p>
    <div class="assinaturas"><div>${escaparHtml(eu.nome)}<br>CONTRATADO</div><div>${escaparHtml(nomeCliente)}<br>CONTRATANTE</div></div>
    <div class="assinaturas" style="margin-top:36px;"><div>TESTEMUNHA:<br>CPF ou RG</div><div>TESTEMUNHA:<br>CPF ou RG</div></div>
    <p class="nota">Modelo próprio (KitFreela). Revise as cláusulas antes de assinar; CPF/RG e endereços ficam em branco para preencher à mão.</p>`);
}

function htmlContratoCliente() {
  return `
    <div class="painel-grafico-funil" style="margin-bottom:16px;">
      <h3>📄 Contrato</h3>
      <div class="linha-plano">
        <select id="ct-tipo"><option value="servicos">Prestação de Serviços</option><option value="social">Social Media</option></select>
        <label class="card-sub" style="margin:0;">Início <input type="date" id="ct-inicio"></label>
        <label class="card-sub" style="margin:0;">Fim <input type="date" id="ct-fim"></label>
        <input id="ct-valor" type="number" min="0" step="0.01" placeholder="Valor (R$)" style="max-width:130px;flex:0 0 auto;">
        <select id="ct-periodicidade"><option value="mensal">por mês</option><option value="total">valor total</option></select>
        <input id="ct-posts" type="number" min="1" placeholder="Posts/semana" style="max-width:120px;flex:0 0 auto;display:none;">
      </div>
      <textarea id="ct-servicos" rows="3" placeholder="Serviços que serão prestados (ex.: criação de artes e vídeos para as redes sociais, 8 peças por mês)" style="width:100%;margin-top:8px;"></textarea>
      <div style="margin-top:8px;"><button class="botao pequeno" id="ct-gerar">📄 Gerar contrato (PDF)</button> <span class="card-sub">Foro: Maringá-PR · CPF/RG em branco para preencher à mão</span></div>
    </div>`;
}

function ligarContratoCliente(clienteId) {
  const tipo = document.getElementById("ct-tipo");
  if (!tipo) return;
  const ajustar = () => {
    document.getElementById("ct-posts").style.display = tipo.value === "social" ? "" : "none";
    document.getElementById("ct-servicos").style.display = tipo.value === "social" ? "none" : "";
  };
  tipo.addEventListener("change", ajustar); ajustar();
  document.getElementById("ct-gerar").addEventListener("click", () => gerarContratoModelo(clienteId, {
    tipo: tipo.value,
    inicio: document.getElementById("ct-inicio").value, fim: document.getElementById("ct-fim").value,
    valor: document.getElementById("ct-valor").value, periodicidade: document.getElementById("ct-periodicidade").value,
    postsSemana: document.getElementById("ct-posts").value, servicos: document.getElementById("ct-servicos").value,
  }));
}
