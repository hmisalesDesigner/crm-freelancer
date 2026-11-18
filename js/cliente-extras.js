/**
 * cliente-extras.js
 * Seções extras do painel de cada cliente, baseadas nas planilhas do Henrique (KitFreela):
 *  - Diagnóstico comercial (formulário de levantamento do cliente)
 *  - Acompanhamento de redes (Instagram/Facebook: Início, 30, 60 e 90 dias)
 *  - Controle de conteúdo (posts: arte pronta, publicado, alcance, envolvimento, horário, valor)
 * Tudo é salvo dentro do próprio cliente (cliente.diagnostico, .acompanhamento, .conteudo).
 */

const DIAG_CAMPOS = [
  ["empresa", "Empresa"], ["responsavel", "Responsável"], ["endereco", "Endereço"], ["telefone", "Telefone"],
  ["fbPessoal", "Facebook – perfil pessoal"], ["fbPagina", "Facebook – página"],
  ["igPessoal", "Instagram – pessoal"], ["igComercial", "Instagram – comercial"],
  ["whatsEmpresa", "WhatsApp da empresa"], ["quemAdministra", "Quem administra as redes sociais"],
  ["publicoHomem", "Público: homens (%)", "number"], ["publicoMulher", "Público: mulheres (%)", "number"],
  ["cartaoVisita", "Cartão de visita"], ["panfleto", "Panfleto"], ["logo", "Logo"],
  ["site", "Site"], ["siteAtualizado", "Site atualizado em"], ["ecommerce", "E-commerce"],
  ["radio", "Mídia externa – rádio"], ["radioValor", "Rádio – valor (R$)", "number"],
  ["siteMidia", "Mídia externa – site"], ["siteMidiaValor", "Site – valor (R$)", "number"],
  ["carroSom", "Mídia externa – carro de som"], ["carroSomValor", "Carro de som – valor (R$)", "number"],
  ["outrosMidia", "Mídia externa – outros"], ["outrosMidiaValor", "Outros – valor (R$)", "number"],
];
const DIAG_TEXTOS = [["visaoMidia", "Qual a visão do cliente sobre mídia social?"], ["objetivoMidia", "O que gostaria que a mídia social alcançasse para a empresa?"]];

const ACOMP_IG = [["seguidores", "Seguidores"], ["visualizacao", "Visualizações"], ["curtidas", "Curtidas no post"], ["postagens", "Nº de postagens"]];
const ACOMP_FB = [["curtidasPagina", "Curtidas na página"], ["taxaResposta", "Taxa de resposta"], ["pctResposta", "% de resposta"], ["visPagina", "Visualizações da página"], ["alcance", "Alcance"], ["envolvimento", "Envolvimento com a página"]];
const ACOMP_PERIODOS = ["Início", "30 dias", "60 dias", "90 dias"];

function salvarNoCliente(clienteId, fn) {
  atualizarEstado((e) => { const c = e.clientes.find((x) => x.id === clienteId); if (c) fn(c); });
}

function htmlExtrasCliente(cliente) {
  const d = cliente.diagnostico || {};
  const a = cliente.acompanhamento || {};
  const tabelaAcomp = (rede, lista, titulo) => `
    <h4 style="margin:10px 0 6px;">${titulo}</h4>
    <table class="tabela tabela-mini"><thead><tr><th></th>${ACOMP_PERIODOS.map((p) => `<th>${p}</th>`).join("")}<th>Variação</th></tr></thead><tbody>
      ${lista.map(([k, r]) => {
        const v = ((a[rede] || {})[k]) || [];
        return `<tr><td>${r}</td>${[0, 1, 2, 3].map((i) => `<td><input type="number" class="acomp-in" data-rede="${rede}" data-k="${k}" data-i="${i}" value="${v[i] ?? ""}" style="width:90px;"></td>`).join("")}<td class="acomp-var" data-var="${rede}-${k}"></td></tr>`;
      }).join("")}
    </tbody></table>`;
  return `
    <details class="painel-grafico-funil bloco-extra" id="pc-diag-bloco">
      <summary><h3 style="display:inline;">📋 Diagnóstico comercial</h3></summary>
      <div class="form-grid" style="margin-top:10px;">
        ${DIAG_CAMPOS.map(([k, r, t]) => `<div class="campo"><label>${r}</label><input class="diag-in" data-k="${k}" type="${t || "text"}" value="${escaparHtml(d[k] ?? "")}"></div>`).join("")}
      </div>
      ${DIAG_TEXTOS.map(([k, r]) => `<div class="campo" style="margin-top:10px;"><label>${r}</label><textarea class="diag-in" data-k="${k}" rows="3">${escaparHtml(d[k] ?? "")}</textarea></div>`).join("")}
      <button class="botao secundario pequeno" id="diag-imprimir" style="margin-top:10px;">🖨 Imprimir diagnóstico</button>
    </details>

    <details class="painel-grafico-funil bloco-extra">
      <summary><h3 style="display:inline;">📈 Acompanhamento de redes</h3></summary>
      <p class="card-sub">Preencha no início e depois em 30, 60 e 90 dias para mostrar a evolução ao cliente.</p>
      ${tabelaAcomp("ig", ACOMP_IG, "Instagram")}
      ${tabelaAcomp("fb", ACOMP_FB, "Facebook")}
    </details>

    <details class="painel-grafico-funil bloco-extra">
      <summary><h3 style="display:inline;">🗓 Controle de conteúdo</h3></summary>
      <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-top:10px;">
        <div class="campo"><label>Arte pronta</label><input type="date" id="ct-c-arte"></div>
        <div class="campo"><label>Publicado</label><input type="date" id="ct-c-pub"></div>
        <div class="campo" style="grid-column: span 2;"><label>Postagem</label><input id="ct-c-texto" placeholder="Ex: X-Salada por apenas R$ 10,00"></div>
        <div class="campo"><label>Alcance</label><input type="number" id="ct-c-alcance"></div>
        <div class="campo"><label>Envolvimento</label><input type="number" id="ct-c-env"></div>
        <div class="campo"><label>Horário</label><input id="ct-c-hor" placeholder="9:00 / 14:00"></div>
        <div class="campo"><label>Impulsionado (R$)</label><input type="number" id="ct-c-valor"></div>
        <div class="campo"><label>&nbsp;</label><button class="botao" id="ct-c-add">+ Adicionar</button></div>
      </div>
      <div id="ct-c-resumo" class="card-sub" style="margin:8px 0;"></div>
      <table class="tabela tabela-mini"><thead><tr><th>#</th><th>Arte pronta</th><th>Publicado</th><th>Postagem</th><th>Alcance</th><th>Envolv.</th><th>Horário</th><th>R$</th><th></th></tr></thead><tbody id="ct-c-corpo"></tbody></table>
    </details>`;
}

function ligarExtrasCliente(clienteId) {
  const cliente = () => ESTADO.clientes.find((x) => x.id === clienteId);

  /* diagnóstico */
  document.querySelectorAll(".diag-in").forEach((el) => el.addEventListener("change", () => {
    salvarNoCliente(clienteId, (c) => { c.diagnostico = c.diagnostico || {}; c.diagnostico[el.dataset.k] = el.value; });
  }));
  const btnImp = document.getElementById("diag-imprimir");
  if (btnImp) btnImp.addEventListener("click", () => {
    const c = cliente(); const d = c.diagnostico || {};
    const linhas = DIAG_CAMPOS.map(([k, r]) => `<p><b>${r}:</b> ${escaparHtml(d[k] || "—")}</p>`).join("")
      + DIAG_TEXTOS.map(([k, r]) => `<h2>${r}</h2><p>${escaparHtml(d[k] || "—")}</p>`).join("");
    abrirDocumentoParaImpressao("Diagnóstico - " + c.nome, `<h1>Diagnóstico comercial – ${escaparHtml(c.nome)}</h1>${linhas}`);
  });

  /* acompanhamento */
  const atualizarVariacoes = () => {
    const a = (cliente().acompanhamento) || {};
    document.querySelectorAll(".acomp-var").forEach((td) => {
      const [rede, k] = td.dataset.var.split("-");
      const v = ((a[rede] || {})[k]) || [];
      const ini = Number(v[0]); const ult = [3, 2, 1].map((i) => v[i]).find((x) => x !== undefined && x !== "" && x !== null);
      td.textContent = v[0] !== undefined && v[0] !== "" && ult !== undefined && ini > 0 ? ((Number(ult) - ini) / ini * 100).toFixed(1).replace(".", ",") + "%" : "";
    });
  };
  document.querySelectorAll(".acomp-in").forEach((el) => el.addEventListener("input", () => {
    salvarNoCliente(clienteId, (c) => {
      c.acompanhamento = c.acompanhamento || {};
      c.acompanhamento[el.dataset.rede] = c.acompanhamento[el.dataset.rede] || {};
      const arr = c.acompanhamento[el.dataset.rede][el.dataset.k] = c.acompanhamento[el.dataset.rede][el.dataset.k] || [];
      arr[Number(el.dataset.i)] = el.value === "" ? "" : Number(el.value);
    });
    atualizarVariacoes();
  }));
  atualizarVariacoes();

  /* conteúdo */
  const desenhar = () => {
    const lista = cliente().conteudo || [];
    const alc = lista.reduce((t, p) => t + (Number(p.alcance) || 0), 0), env = lista.reduce((t, p) => t + (Number(p.envolvimento) || 0), 0);
    document.getElementById("ct-c-resumo").textContent = lista.length
      ? `${lista.length} post(s) · alcance ${alc.toLocaleString("pt-BR")} · envolvimento ${env.toLocaleString("pt-BR")}${alc ? ` (${(env / alc * 100).toFixed(1).replace(".", ",")}%)` : ""} · impulsionado ${formatarMoeda(lista.reduce((t, p) => t + (Number(p.valor) || 0), 0))}`
      : "Nenhum post registrado ainda.";
    const corpo = document.getElementById("ct-c-corpo");
    corpo.innerHTML = lista.map((p, i) => `<tr><td>${i + 1}</td><td>${p.arte ? formatarDataBR(p.arte) : "-"}</td><td>${p.publicado ? formatarDataBR(p.publicado) : "-"}</td><td>${escaparHtml(p.texto || "")}</td><td>${p.alcance ?? ""}</td><td>${p.envolvimento ?? ""}</td><td>${escaparHtml(p.horario || "")}</td><td>${p.valor ? formatarMoeda(Number(p.valor)) : ""}</td><td><button class="botao perigo pequeno" data-cont-del="${p.id}">✕</button></td></tr>`).join("");
    corpo.querySelectorAll("[data-cont-del]").forEach((b) => b.addEventListener("click", () => {
      salvarNoCliente(clienteId, (c) => { c.conteudo = (c.conteudo || []).filter((x) => x.id !== b.dataset.contDel); });
      desenhar();
    }));
  };
  document.getElementById("ct-c-add").addEventListener("click", () => {
    const texto = document.getElementById("ct-c-texto").value.trim();
    if (!texto) return;
    const g = (id) => document.getElementById(id).value;
    salvarNoCliente(clienteId, (c) => {
      c.conteudo = c.conteudo || [];
      c.conteudo.push({ id: gerarId(), arte: g("ct-c-arte"), publicado: g("ct-c-pub"), texto, alcance: g("ct-c-alcance") === "" ? "" : Number(g("ct-c-alcance")), envolvimento: g("ct-c-env") === "" ? "" : Number(g("ct-c-env")), horario: g("ct-c-hor"), valor: g("ct-c-valor") === "" ? "" : Number(g("ct-c-valor")) });
    });
    ["ct-c-texto", "ct-c-alcance", "ct-c-env", "ct-c-hor", "ct-c-valor"].forEach((id) => (document.getElementById(id).value = ""));
    desenhar();
  });
  desenhar();
}
