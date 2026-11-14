/**
 * prospeccao.js
 * Sistema de leads (Instagram → CRM) para design gráfico e edição.
 *
 * Fluxo seguro, sem automação no Instagram:
 *  1. Descoberta: buscas prontas no Google (site:instagram.com) por nicho + cidade.
 *  2. Captura: o Henrique abre o perfil normalmente, copia o texto da página (Ctrl+A, Ctrl+C)
 *     e cola aqui; o sistema extrai seguidores, publicações, WhatsApp, e-mail e site.
 *  3. Score 0–100 e prioridade (quente / morno / frio), funil de leads, mensagem de WhatsApp
 *     pronta e follow-up integrado ao painel. Os dados vão para o Drive junto com o resto do CRM.
 */

const STATUS_LEAD = ["Novo", "Qualificado", "Contatado", "Respondeu", "Proposta enviada", "Fechado", "Perdido"];
const STATUS_LEAD_ENCERRADOS = ["Fechado", "Perdido"];
const NICHOS_LEAD = [
  { nome: "Restaurantes e delivery", busca: "restaurante OR delivery OR hamburgueria OR pizzaria" },
  { nome: "Estética e saúde", busca: "estética OR clínica OR odontologia OR dentista" },
  { nome: "Salões e barbearias", busca: "salão OR barbearia OR cabeleireiro" },
  { nome: "Academias e studios", busca: "academia OR studio OR pilates OR crossfit" },
  { nome: "Lojas de roupa", busca: "moda OR boutique OR \"loja de roupas\"" },
  { nome: "Pet shops", busca: "petshop OR \"pet shop\" OR veterinária" },
  { nome: "Imobiliárias e corretores", busca: "imobiliária OR corretor OR imóveis" },
  { nome: "Social media", busca: "\"social media\" OR \"gestor de conteúdo\" OR \"gestão de redes\" OR marketing", tipo: "Social Media" },
];

/* ---------- extração do texto colado ---------- */

function numeroAbreviado(num, sufixo) {
  const s = String(num).replace(/\s/g, "");
  if (sufixo) {
    const n = parseFloat(s.replace(",", "."));
    const mult = /^(mil|k)$/i.test(sufixo) ? 1e3 : 1e6;
    return Math.round(n * mult);
  }
  return parseInt(s.replace(/[.,]/g, ""), 10);
}

function extrairDadosDoPerfil(texto) {
  const t = String(texto || "");
  const r = {};
  const seg = t.match(/(\d[\d.,]*)\s*(mil|mi|k|m)?\s*(?:seguidores|followers)/i);
  if (seg) r.seguidores = numeroAbreviado(seg[1], seg[2]);
  const pub = t.match(/(\d[\d.,]*)\s*(mil|k)?\s*(?:publicações|publicacoes|posts)/i);
  if (pub) r.publicacoes = numeroAbreviado(pub[1], pub[2]);

  const url = t.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/i);
  const arroba = t.match(/(?:^|\s)@([A-Za-z0-9._]{2,30})/);
  const handle = (url && !/^(p|reel|explore|accounts)$/i.test(url[1]) ? url[1] : null) || (arroba ? arroba[1] : null);
  let usuario = handle;
  if (!usuario) { // o Instagram mostra o usuário sem "@": linha só com letras minúsculas, números, ponto ou sublinhado
    const linha = t.split(/\r?\n/).map((l) => l.trim()).find((l) => /^[a-z0-9._]{3,30}$/.test(l) && !/^\d+$/.test(l)
      && !/^(seguir|seguindo|mensagem|followers|following|posts)$/.test(l));
    if (linha) usuario = linha;
  }
  if (usuario) r.perfil = "@" + usuario.replace(/^@/, "");

  const wa = t.match(/wa\.me\/(\d{10,15})/i);
  if (wa) r.whatsapp = wa[1];
  else {
    const telefones = t.match(/(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/g) || [];
    const bom = telefones.map((x) => x.replace(/\D/g, "")).find((d) => d.length >= 10 && d.length <= 13);
    if (bom) r.whatsapp = bom;
  }
  const email = t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) r.email = email[0];
  const site = (t.match(/https?:\/\/[^\s)]+/g) || []).find((u) => !/instagram\.com|wa\.me|facebook\.com\/tr/i.test(u));
  if (site) r.site = site;

  const linhas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nome = linhas.find((l) => l.length <= 60 && /[A-Za-zÀ-ÿ]/.test(l)
    && !/(seguidores|followers|publica|posts|seguindo|following|http|@|^\d)/i.test(l));
  if (nome) r.nome = nome;
  return r;
}

/** (nº de posts - 1) / semanas entre o mais antigo e o mais recente, a partir de datas dd/mm/aaaa ou aaaa-mm-dd. */
function frequenciaPelasDatas(texto) {
  const datas = (String(texto || "").match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/g) || []).map((d) => {
    if (d.includes("-")) return new Date(d + "T12:00:00");
    const [dia, mes, ano] = d.split("/").map(Number);
    return new Date((ano < 100 ? 2000 + ano : ano), mes - 1, dia, 12);
  }).filter((d) => !isNaN(d)).sort((a, b) => a - b);
  if (datas.length < 2) return null;
  const semanas = Math.max((datas[datas.length - 1] - datas[0]) / (7 * 86400000), 1 / 7);
  return Math.round(((datas.length - 1) / semanas) * 10) / 10;
}

/* ---------- score ---------- */

function engajamentoLead(l) {
  const seg = Number(l.seguidores) || 0, curt = Number(l.curtidasMedias) || 0;
  return seg > 0 && curt > 0 ? (curt / seg) * 100 : 0;
}

function calcularScoreLead(l) {
  const min = Number(ESTADO.configuracoes.leadSeguidoresMin) || 500;
  const max = Number(ESTADO.configuracoes.leadSeguidoresMax) || 20000;
  const seg = Number(l.seguidores) || 0, freq = Number(l.postsPorSemana) || 0, eng = engajamentoLead(l);
  let pts = 0;
  pts += freq >= 3 ? 30 : freq >= 1.5 ? 20 : freq >= 0.5 ? 10 : 0;                         // frequência de postagem
  pts += seg >= min && seg <= max ? 20 : seg >= min / 2 && seg <= max * 2 ? 10 : 0;         // faixa de seguidores
  pts += eng >= 3 ? 15 : eng >= 1.5 ? 10 : eng >= 0.5 ? 5 : 0;                             // engajamento
  pts += l.visual === "fraco" ? 25 : l.visual === "medio" ? 15 : l.visual === "bom" ? 5 : 0; // oportunidade de design
  pts += l.whatsapp ? 10 : (l.email || l.site) ? 5 : 0;                                      // contato disponível
  return pts;
}

function prioridadeLead(score) { return score >= 65 ? "quente" : score >= 40 ? "morno" : "frio"; }

/* ---------- mensagem ---------- */

function mensagemParaLead(l) {
  const eu = ESTADO.configuracoes.nomeProfissional || "Henrique";
  const servico = l.tipo === "Social Media"
    ? "artes e edição de vídeo para apoiar quem cuida de redes sociais, em parceria"
    : "artes para redes sociais, Stories/Reels e edição de vídeo";
  const gancho = l.visual === "fraco" ? ", e acho que dá para deixar o feed ainda mais profissional e padronizado" : "";
  return `Olá${l.nome ? ", " + l.nome : ""}! Tudo bem? Aqui é ${eu}, designer e editor de vídeo aqui de Maringá. ` +
    `Vi o perfil de vocês${l.perfil ? " (" + l.perfil + ")" : ""} e gostei do conteúdo${gancho}. ` +
    `Trabalho com ${servico}. Posso te mostrar alguns trabalhos, sem compromisso?`;
}

function etapaDeClienteParaLead(status) {
  return { Contatado: "Contato", Respondeu: "Contato", "Proposta enviada": "Orçamento enviado", Fechado: "Fechado" }[status] || "Prospecção";
}

/* ---------- página ---------- */

function renderizarPaginaProspeccao() {
  const container = document.getElementById("pagina-prospeccao");
  const cfg = ESTADO.configuracoes;
  let editandoId = null;
  let filtroStatus = "todos";

  container.innerHTML = `
    <h3 style="margin-top:0;">1. Descobrir perfis</h3>
    <p class="card-sub" style="max-width:700px;">Cada botão abre uma busca pronta no Google só com perfis públicos do Instagram. Sem risco para a sua conta.</p>
    <div class="form-grid" style="max-width:700px;">
      <div class="campo"><label>Cidade</label><input id="pros-local" value="Maringá"></div>
      <div class="campo"><label>Outro termo (opcional)</label><input id="pros-termo" placeholder="Ex: floricultura"></div>
    </div>
    <div class="filtros" id="pros-nichos" style="margin-top:12px;"></div>

    <h3 style="margin-top:32px;">2. Capturar perfil</h3>
    <div class="campo" style="max-width:700px;">
      <label>Cole o texto do perfil (abra o perfil, Ctrl+A, Ctrl+C e cole aqui)</label>
      <textarea id="lead-texto" placeholder="Seguidores, publicações, bio, WhatsApp, e-mail e site são extraídos sozinhos"></textarea>
      <div><button class="botao secundario pequeno" id="btn-extrair-lead" style="margin-top:8px;">✨ Extrair dados</button></div>
    </div>
    <div class="form-grid" style="margin-top:14px; max-width:900px;">
      <div class="campo"><label>@ do perfil</label><input id="lead-perfil" placeholder="@empresa"></div>
      <div class="campo"><label>Nome do negócio</label><input id="lead-nome"></div>
      <div class="campo"><label>Tipo</label><select id="lead-tipo"><option>Empresa</option><option>Social Media</option></select></div>
      <div class="campo"><label>Nicho</label><input id="lead-nicho" list="lead-nichos-lista" placeholder="Ex: Restaurante"><datalist id="lead-nichos-lista">${NICHOS_LEAD.map((n) => `<option value="${n.nome}">`).join("")}</datalist></div>
      <div class="campo"><label>Cidade</label><input id="lead-cidade" value="Maringá"></div>
      <div class="campo"><label>Seguidores</label><input type="number" id="lead-seguidores" min="0"></div>
      <div class="campo"><label>Publicações</label><input type="number" id="lead-publicacoes" min="0"></div>
      <div class="campo"><label>Data do último post</label><input type="date" id="lead-ultimo-post"></div>
      <div class="campo"><label>Posts por semana</label><input type="number" id="lead-freq" min="0" step="0.1"></div>
      <div class="campo"><label>Curtidas médias por post</label><input type="number" id="lead-curtidas" min="0"></div>
      <div class="campo"><label>Qualidade visual do feed</label>
        <select id="lead-visual"><option value="">—</option><option value="fraco">Fraco (oportunidade)</option><option value="medio">Médio</option><option value="bom">Bom</option></select></div>
      <div class="campo"><label>WhatsApp</label><input id="lead-whatsapp" placeholder="44999999999"></div>
      <div class="campo"><label>E-mail</label><input id="lead-email"></div>
      <div class="campo"><label>Site</label><input id="lead-site"></div>
      <div class="campo"><label>Status</label><select id="lead-status">${STATUS_LEAD.map((s) => `<option>${s}</option>`).join("")}</select></div>
      <div class="campo"><label>Próximo follow-up</label><input type="date" id="lead-proximo"></div>
    </div>
    <details style="margin-top:10px; max-width:700px;">
      <summary class="card-sub" style="cursor:pointer;">Calcular posts por semana pelas datas dos últimos posts</summary>
      <div class="campo" style="margin-top:8px;"><textarea id="lead-datas" placeholder="Cole as datas (dd/mm/aaaa), uma por linha ou separadas por vírgula"></textarea>
        <div><button class="botao secundario pequeno" id="btn-calcular-freq" style="margin-top:8px;">Calcular</button></div></div>
    </details>
    <div class="campo" style="margin-top:12px; max-width:700px;"><label>Observações</label><textarea id="lead-obs"></textarea></div>
    <div class="previa-score" id="lead-score-previa"></div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button class="botao" id="btn-salvar-lead">Salvar lead</button>
      <button class="botao secundario" id="btn-limpar-lead">Limpar</button>
    </div>

    <h3 style="margin-top:36px;">3. Leads</h3>
    <div class="form-grid" style="max-width:700px; margin-bottom:10px;">
      <div class="campo"><label>Seguidores ideais: mínimo</label><input type="number" id="cfg-lead-min" value="${Number(cfg.leadSeguidoresMin) || 500}"></div>
      <div class="campo"><label>Seguidores ideais: máximo</label><input type="number" id="cfg-lead-max" value="${Number(cfg.leadSeguidoresMax) || 20000}"></div>
    </div>
    <div class="filtros" id="lead-filtros"></div>
    <div class="campo" style="max-width:360px; margin:10px 0;"><input id="lead-busca" placeholder="Buscar por nome, @ ou nicho"></div>
    <div style="overflow-x:auto;">
      <table class="tabela"><thead><tr>
        <th>Lead</th><th>Nicho</th><th>Seguidores</th><th>Posts/sem</th><th>Eng.</th><th>Score</th><th>Status</th><th>Follow-up</th><th></th>
      </tr></thead><tbody id="lead-corpo"></tbody></table>
    </div>
    <div class="orc-privado" id="lead-mensagem" style="display:none; margin-top:16px; max-width:700px; position:static;"></div>
  `;

  const $ = (id) => document.getElementById(id);
  const campos = {
    perfil: "lead-perfil", nome: "lead-nome", tipo: "lead-tipo", nicho: "lead-nicho", cidade: "lead-cidade",
    seguidores: "lead-seguidores", publicacoes: "lead-publicacoes", ultimoPost: "lead-ultimo-post", postsPorSemana: "lead-freq",
    curtidasMedias: "lead-curtidas", visual: "lead-visual", whatsapp: "lead-whatsapp", email: "lead-email", site: "lead-site",
    status: "lead-status", proximoContato: "lead-proximo", obs: "lead-obs",
  };

  /* --- descoberta --- */
  function desenharNichos() {
    const cidade = $("pros-local").value.trim() || "Maringá";
    const termo = $("pros-termo").value.trim();
    const link = (busca) => "https://www.google.com/search?q=" + encodeURIComponent(`site:instagram.com "${cidade}" (${busca})`);
    $("pros-nichos").innerHTML = NICHOS_LEAD.map((n) =>
      `<a class="chip" target="_blank" rel="noopener" href="${link(n.busca)}">${escaparHtml(n.nome)}</a>`).join("") +
      (termo ? `<a class="chip" target="_blank" rel="noopener" href="${link(termo)}">🔎 ${escaparHtml(termo)}</a>` : "");
  }
  ["pros-local", "pros-termo"].forEach((id) => $(id).addEventListener("input", desenharNichos));

  /* --- formulário --- */
  function lerFormulario() {
    const l = {};
    Object.entries(campos).forEach(([k, id]) => { l[k] = $(id).value.trim(); });
    ["seguidores", "publicacoes", "postsPorSemana", "curtidasMedias"].forEach((k) => { l[k] = l[k] === "" ? null : Number(l[k]); });
    l.whatsapp = telefoneParaWhatsapp(l.whatsapp) || "";
    if (l.perfil && !l.perfil.startsWith("@")) l.perfil = "@" + l.perfil;
    return l;
  }
  function preencherFormulario(l) {
    Object.entries(campos).forEach(([k, id]) => { $(id).value = l[k] === null || l[k] === undefined ? (k === "status" ? "Novo" : k === "tipo" ? "Empresa" : "") : l[k]; });
    if (!$("lead-cidade").value) $("lead-cidade").value = "Maringá";
    atualizarPrevia();
  }
  function atualizarPrevia() {
    const l = lerFormulario();
    const s = calcularScoreLead(l);
    const eng = engajamentoLead(l);
    $("lead-score-previa").innerHTML = `Score: <b>${s}/100</b> (${prioridadeLead(s)})${eng ? ` · engajamento ${eng.toFixed(1)}%` : ""}`;
  }
  Object.values(campos).forEach((id) => { $(id).addEventListener("input", atualizarPrevia); $(id).addEventListener("change", atualizarPrevia); });

  $("btn-extrair-lead").addEventListener("click", () => {
    const r = extrairDadosDoPerfil($("lead-texto").value);
    if (!Object.keys(r).length) { alert("Não encontrei dados no texto colado. Confira se copiou a página do perfil."); return; }
    const atual = lerFormulario();
    preencherFormulario({ ...atual, ...r, whatsapp: r.whatsapp || atual.whatsapp });
  });
  $("btn-calcular-freq").addEventListener("click", () => {
    const f = frequenciaPelasDatas($("lead-datas").value);
    if (f === null) { alert("Informe pelo menos 2 datas."); return; }
    $("lead-freq").value = f; atualizarPrevia();
  });
  function limpar() {
    editandoId = null;
    $("lead-texto").value = ""; $("lead-datas").value = "";
    preencherFormulario({});
    $("btn-salvar-lead").textContent = "Salvar lead";
  }
  $("btn-limpar-lead").addEventListener("click", limpar);

  $("btn-salvar-lead").addEventListener("click", () => {
    const l = lerFormulario();
    if (!l.perfil && !l.nome) { alert("Informe o @ do perfil ou o nome do negócio."); return; }
    const duplicado = !editandoId && l.perfil && ESTADO.leads.find((x) => (x.perfil || "").toLowerCase() === l.perfil.toLowerCase());
    if (duplicado && !confirm("Já existe um lead com esse @. Atualizar o existente?")) return;
    const alvoId = editandoId || (duplicado && duplicado.id);
    atualizarEstado((e) => {
      if (alvoId && duplicado) { // @ já existente: só entram os campos preenchidos (não apaga o que foi anotado antes)
        const vazios = (v) => v === "" || v === null || v === undefined;
        const novos = Object.fromEntries(Object.entries(l).filter(([k, v]) => !vazios(v) && !(k === "status" && v === "Novo")));
        Object.assign(e.leads.find((x) => x.id === alvoId), novos);
      } else if (alvoId) Object.assign(e.leads.find((x) => x.id === alvoId), l);
      else e.leads.push({ id: gerarId(), ...l, capturadoEm: hojeISO() });
    });
    limpar(); desenharLeads(); atualizarPainel();
  });

  /* --- lista --- */
  function desenharFiltros() {
    const cont = (s) => ESTADO.leads.filter((l) => l.status === s).length;
    $("lead-filtros").innerHTML = [["todos", `Todos (${ESTADO.leads.length})`], ["quente", "🔥 Quentes"], ...STATUS_LEAD.map((s) => [s, `${s} (${cont(s)})`])]
      .map(([v, t]) => `<button class="chip ${filtroStatus === v ? "ativo" : ""}" data-filtro-lead="${v}">${t}</button>`).join("");
    $("lead-filtros").querySelectorAll("[data-filtro-lead]").forEach((b) => b.addEventListener("click", () => { filtroStatus = b.dataset.filtroLead; desenharFiltros(); desenharLeads(); }));
  }

  function desenharLeads() {
    const busca = $("lead-busca").value.trim().toLowerCase();
    const lista = ESTADO.leads
      .map((l) => ({ l, score: calcularScoreLead(l) }))
      .filter(({ l, score }) => (filtroStatus === "todos" || (filtroStatus === "quente" ? prioridadeLead(score) === "quente" && !STATUS_LEAD_ENCERRADOS.includes(l.status) : l.status === filtroStatus))
        && (!busca || [l.nome, l.perfil, l.nicho].some((x) => (x || "").toLowerCase().includes(busca))))
      .sort((a, b) => b.score - a.score);
    const hoje = hojeISO();
    $("lead-corpo").innerHTML = lista.map(({ l, score }) => {
      const eng = engajamentoLead(l);
      return `<tr>
        <td><b>${escaparHtml(l.nome || l.perfil)}</b><br><span class="card-sub">${escaparHtml(l.perfil || "")} · ${escaparHtml(l.tipo || "")}</span></td>
        <td>${escaparHtml(l.nicho || "-")}</td>
        <td>${l.seguidores != null ? Number(l.seguidores).toLocaleString("pt-BR") : "-"}</td>
        <td>${l.postsPorSemana != null ? l.postsPorSemana : "-"}</td>
        <td>${eng ? eng.toFixed(1) + "%" : "-"}</td>
        <td><span class="selo ${prioridadeLead(score)}">${score} · ${prioridadeLead(score)}</span></td>
        <td><select data-status-lead="${l.id}">${STATUS_LEAD.map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
        <td>${l.proximoContato ? `<span ${l.proximoContato <= hoje && !STATUS_LEAD_ENCERRADOS.includes(l.status) ? 'style="color:var(--cor-perigo);font-weight:600;"' : ""}>${formatarDataBR(l.proximoContato)}</span>` : "-"}</td>
        <td style="white-space:nowrap;">
          <button class="botao sucesso pequeno" data-msg-lead="${l.id}">💬 Mensagem</button>
          <button class="botao secundario pequeno" data-editar-lead="${l.id}">Editar</button>
          ${l.clienteId ? `<span class="card-sub">✔ cliente</span>` : `<button class="botao secundario pequeno" data-cliente-lead="${l.id}">→ Cliente</button>`}
          <button class="botao perigo pequeno" data-excluir-lead="${l.id}" aria-label="Excluir">✕</button>
        </td></tr>`;
    }).join("") || `<tr><td colspan="9" style="text-align:center; color:var(--cor-texto-suave);">Nenhum lead nesta visão.</td></tr>`;

    const corpo = $("lead-corpo");
    corpo.querySelectorAll("[data-status-lead]").forEach((s) => s.addEventListener("change", () => {
      atualizarEstado((e) => { e.leads.find((x) => x.id === s.dataset.statusLead).status = s.value; });
      desenharFiltros(); desenharLeads(); atualizarPainel();
    }));
    corpo.querySelectorAll("[data-editar-lead]").forEach((b) => b.addEventListener("click", () => {
      const l = ESTADO.leads.find((x) => x.id === b.dataset.editarLead);
      editandoId = l.id; preencherFormulario(l); $("btn-salvar-lead").textContent = "Atualizar lead";
      $("lead-perfil").scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    corpo.querySelectorAll("[data-excluir-lead]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Excluir este lead?")) return;
      atualizarEstado((e) => { e.leads = e.leads.filter((x) => x.id !== b.dataset.excluirLead); });
      desenharFiltros(); desenharLeads(); atualizarPainel();
    }));
    corpo.querySelectorAll("[data-cliente-lead]").forEach((b) => b.addEventListener("click", () => converterEmCliente(b.dataset.clienteLead)));
    corpo.querySelectorAll("[data-msg-lead]").forEach((b) => b.addEventListener("click", () => abrirMensagem(b.dataset.msgLead)));
  }

  function converterEmCliente(id) {
    const l = ESTADO.leads.find((x) => x.id === id);
    if (!l || l.clienteId) return;
    const clienteId = gerarId();
    atualizarEstado((e) => {
      const lead = e.leads.find((x) => x.id === id);
      lead.clienteId = clienteId;
      e.clientes.push({
        id: clienteId, nome: l.nome || l.perfil, contato: l.whatsapp || l.email || "", cnpj: "", razaoSocial: "", capitalSocial: 0,
        etapaFunil: etapaDeClienteParaLead(l.status),
        demanda: `Lead do Instagram ${l.perfil || ""}${l.nicho ? " (" + l.nicho + ")" : ""}`.trim(),
        proximoContato: l.proximoContato || "", foto: "", historicoFinanceiro: [],
        notas: l.obs ? [{ id: gerarId(), data: new Date().toISOString(), texto: l.obs }] : [], criadoEm: new Date().toISOString(),
      });
    });
    desenharLeads(); atualizarPainel();
    alert("Lead convertido em cliente. Ele já está no Funil de Vendas.");
  }

  function abrirMensagem(id) {
    const l = ESTADO.leads.find((x) => x.id === id);
    const painel = $("lead-mensagem");
    painel.style.display = "flex";
    painel.innerHTML = `
      <h4>💬 Mensagem para ${escaparHtml(l.nome || l.perfil)}</h4>
      <textarea id="lead-msg-texto" style="min-height:130px;">${escaparHtml(mensagemParaLead(l))}</textarea>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <a class="botao sucesso" id="lead-msg-wa" target="_blank" rel="noopener">Abrir no WhatsApp</a>
        ${l.perfil ? `<a class="botao secundario" target="_blank" rel="noopener" href="https://www.instagram.com/${encodeURIComponent(l.perfil.replace("@", ""))}/">Abrir Instagram</a>` : ""}
        <button class="botao secundario" id="lead-msg-copiar">Copiar</button>
        <button class="botao secundario" id="lead-msg-fechar">Fechar</button>
      </div>
      <p class="card-sub">${l.whatsapp ? "Ao abrir o WhatsApp, o lead passa para “Contatado” e o follow-up é agendado." : "Sem WhatsApp cadastrado: copie a mensagem e envie pelo direct do Instagram."}</p>`;
    const wa = $("lead-msg-wa");
    const atualizarLink = () => { wa.href = l.whatsapp ? linkWhatsapp(l.whatsapp, $("lead-msg-texto").value) : "#"; };
    atualizarLink();
    $("lead-msg-texto").addEventListener("input", atualizarLink);
    wa.addEventListener("click", (ev) => {
      if (!l.whatsapp) { ev.preventDefault(); alert("Este lead não tem WhatsApp. Use “Copiar” e envie pelo Instagram."); return; }
      atualizarEstado((e) => {
        const lead = e.leads.find((x) => x.id === id);
        if (["Novo", "Qualificado"].includes(lead.status)) lead.status = "Contatado";
        lead.proximoContato = somarDiasISO(hojeISO(), Number(e.configuracoes.diasFollowUp) || 3);
        lead.ultimoContato = hojeISO();
      });
      desenharFiltros(); desenharLeads(); atualizarPainel();
    });
    $("lead-msg-copiar").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("lead-msg-texto").value); $("lead-msg-copiar").textContent = "Copiado ✔"; } catch { $("lead-msg-texto").select(); }
    });
    $("lead-msg-fechar").addEventListener("click", () => { painel.style.display = "none"; });
    painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  ["cfg-lead-min", "cfg-lead-max"].forEach((id) => $(id).addEventListener("change", () => {
    atualizarEstado((e) => {
      e.configuracoes.leadSeguidoresMin = Number($("cfg-lead-min").value) || 500;
      e.configuracoes.leadSeguidoresMax = Number($("cfg-lead-max").value) || 20000;
    });
    desenharLeads(); atualizarPrevia();
  }));
  $("lead-busca").addEventListener("input", desenharLeads);

  desenharNichos(); preencherFormulario({}); desenharFiltros(); desenharLeads();
}
