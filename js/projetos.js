/**
 * projetos.js
 * Projetos (pastas) de cada cliente, dentro da aba do cliente. Cada projeto tem itens (ex.: módulos de um treinamento)
 * e cada item segue as mesmas etapas (ex.: roteiro → locuções → … → efeitos finais).
 * O Painel mostra só o PRÓXIMO PASSO do projeto em foco: tarefa pequena, fácil de começar e de concluir.
 * Concluir uma etapa registra uma atividade concluída do cliente (entra nos relatórios).
 */
const ETAPAS_VIDEO = ["Roteiro", "Geração das locuções", "Tratamento dos áudios", "Inserção na edição", "Gravação das telas", "Inserção das cenas", "Efeitos finais (transições, textos, animações)"];

const PP_ABERTOS = new Set(); // pastas de projeto abertas (sobrevive aos redesenhos)
function etapasDe(pj) { return (pj.etapas && pj.etapas.length) ? pj.etapas : ETAPAS_VIDEO; }
function rotuloItem(pj) { return pj.rotulo || "Módulo"; }
function itemCompleto(pj, m) { return etapasDe(pj).every((_, k) => (m.feitas || []).includes(k)); }
function proximaEtapa(pj, m) { return etapasDe(pj).findIndex((_, k) => !(m.feitas || []).includes(k)); }
function projetosDoCliente(cliente) { return (ESTADO.projetosVideo || []).filter((p) => p.clienteId === cliente.id || (!p.clienteId && nomesCorrespondemCliente(p.cliente, cliente.nome))); }
function projetoEmFoco() { const l = ESTADO.projetosVideo || []; return l.find((p) => p.foco && p.modulos.length) || l.find((p) => p.modulos.length) || null; }

function concluirEtapaModulo(pjId, modId, idx) {
  atualizarEstado((e) => {
    const pj = e.projetosVideo.find((p) => p.id === pjId); const m = pj && pj.modulos.find((x) => x.id === modId);
    if (!m || (m.feitas || []).includes(idx)) return;
    m.feitas = (m.feitas || []).concat(idx);
    e.demandas.push({ id: gerarId(), cliente: pj.cliente, clienteId: pj.clienteId, titulo: `${m.nome} — ${etapasDe(pj)[idx]}`, data: hojeISO(), planejadaPara: hojeISO(), status: "concluida", categoria: "Vídeo/Áudio", campanha: pj.nome });
    if (itemCompleto(pj, m)) { // item pronto: fecha a demanda dele (se existir) e passa para o próximo
      const dem = e.demandas.find((d) => d.id === m.id); if (dem && dem.status !== "concluida") concluirDemanda(dem);
      const prox = pj.modulos.find((x) => !itemCompleto(pj, x));
      if (prox) pj.ativoId = prox.id;
    }
  });
}

function htmlPassos(pj, m) {
  const idx = proximaEtapa(pj, m);
  return etapasDe(pj).map((nome, k) => {
    const feita = (m.feitas || []).includes(k);
    return `<button class="passo ${feita ? "feito" : k === idx ? "atual" : ""}" data-passo="${k}" data-pj="${pj.id}" data-mod="${m.id}" title="${feita ? "Desmarcar" : "Marcar como feita (sem registrar atividade)"}"><i>${feita ? "✔" : k + 1}</i><span>${escaparHtml(nome.replace(/ \(.*/, ""))}</span></button>`;
  }).join("");
}

function alternarPasso(pjId, modId, k) {
  atualizarEstado((e) => { const m = e.projetosVideo.find((p) => p.id === pjId).modulos.find((x) => x.id === modId); m.feitas = m.feitas.includes(k) ? m.feitas.filter((x) => x !== k) : m.feitas.concat(k); });
}

/* ---------- Painel: foco ---------- */
function renderizarFocoProjeto() {
  const alvo = document.getElementById("foco-projeto"); if (!alvo) return;
  const pj = projetoEmFoco();
  if (!pj) { alvo.innerHTML = ""; return; }
  const m = pj.modulos.find((x) => x.id === pj.ativoId) || pj.modulos[0];
  const etapas = etapasDe(pj), feitas = (m.feitas || []).length, idx = proximaEtapa(pj, m);
  alvo.innerHTML = `<div class="foco">
    <div class="foco-topo"><span class="foco-rotulo">🎯 Foco agora · ${escaparHtml(pj.nome)}</span>
      <select id="foco-modulo" title="Trocar ${rotuloItem(pj).toLowerCase()}">${pj.modulos.map((x) => `<option value="${x.id}"${x.id === m.id ? " selected" : ""}>${escaparHtml(x.nome.replace(/ — .*/, ""))}${itemCompleto(pj, x) ? " ✔" : ""}</option>`).join("")}</select></div>
    <h3>${escaparHtml(m.nome)}</h3>
    <div class="passos">${htmlPassos(pj, m)}</div>
    ${idx >= 0
      ? `<div class="foco-proximo"><div><small>Próximo passo (${feitas}/${etapas.length} feitos)</small><b>${escaparHtml(etapas[idx])}</b></div><button class="botao" id="foco-concluir">✔ Concluí esta etapa</button></div>`
      : `<div class="foco-proximo"><div><small>${rotuloItem(pj)} completo</small><b>🎉 Todas as etapas feitas</b></div></div>`}
  </div>`;
  document.getElementById("foco-modulo").addEventListener("change", (ev) => { atualizarEstado((e) => { e.projetosVideo.find((p) => p.id === pj.id).ativoId = ev.target.value; }); renderizarFocoProjeto(); });
  const bt = document.getElementById("foco-concluir");
  if (bt) bt.addEventListener("click", () => { concluirEtapaModulo(pj.id, m.id, idx); atualizarPainel(); });
  alvo.querySelectorAll("[data-passo]").forEach((b) => b.addEventListener("click", () => { alternarPasso(b.dataset.pj, b.dataset.mod, Number(b.dataset.passo)); renderizarFocoProjeto(); }));
}

/* ---------- Aba "Projetos" do cliente ---------- */
function htmlProjetosCliente(cliente) {
  const lista = projetosDoCliente(cliente);
  const cartao = (pj) => {
    const prontos = pj.modulos.filter((m) => itemCompleto(pj, m)).length, total = pj.modulos.length;
    const pct = total ? Math.round((prontos / total) * 100) : 0;
    const emFoco = projetoEmFoco() === pj;
    return `<details class="pasta-projeto" data-pp-id="${pj.id}" ${lista.length === 1 || PP_ABERTOS.has(pj.id) ? "open" : ""}>
      <summary><span class="pp-icone">📁</span><b>${escaparHtml(pj.nome)}</b><small>${prontos}/${total} ${rotuloItem(pj).toLowerCase()}${total === 1 ? "" : "s"} prontos · ${pct}%</small>${emFoco ? `<span class="chip-mini">🎯 em foco</span>` : ""}</summary>
      <div class="pp-corpo">
        <div class="barra-progresso"><div class="barra-progresso-interna" style="width:${pct}%"></div></div>
        ${pj.modulos.map((m) => {
          const idx = proximaEtapa(pj, m);
          return `<div class="pp-item"><div class="pp-item-topo"><b>${escaparHtml(m.nome)}</b>${idx >= 0 ? `<button class="botao pequeno" data-pp-concluir="${pj.id}|${m.id}|${idx}">✔ ${escaparHtml(etapasDe(pj)[idx].replace(/ \(.*/, ""))}</button>` : `<span class="selo aceito">Completo</span>`}
            <button class="botao perigo pequeno" data-pp-del-item="${pj.id}|${m.id}" title="Remover">✕</button></div>
            <div class="passos">${htmlPassos(pj, m)}</div></div>`;
        }).join("") || `<p class="card-sub">Nenhum ${rotuloItem(pj).toLowerCase()} ainda.</p>`}
        <div class="pp-add"><input data-pp-novo="${pj.id}" placeholder="Novo ${rotuloItem(pj).toLowerCase()} (ex.: ${rotuloItem(pj)} 16 — Tema)"><button class="botao secundario pequeno" data-pp-add="${pj.id}">+ Adicionar</button></div>
        <div class="pp-rodape">${emFoco ? "" : `<button class="botao secundario pequeno" data-pp-foco="${pj.id}">🎯 Pôr em foco no Painel</button>`}<button class="botao perigo pequeno" data-pp-del="${pj.id}">Excluir projeto</button></div>
      </div></details>`;
  };
  return `<div class="painel-grafico-funil" style="margin-bottom:16px;">
    <h3>📁 Projetos de ${escaparHtml(cliente.nome)}</h3>
    <p class="card-sub" style="margin:0 0 10px;">Cada projeto é uma pasta com itens (ex.: módulos) e etapas. Concluir uma etapa registra a atividade e aparece no relatório.</p>
    ${lista.map(cartao).join("") || `<p class="card-sub">Nenhum projeto ainda.</p>`}
    <details class="mais-opcoes" style="margin-top:12px;"><summary>+ Novo projeto</summary>
      <div style="display:grid;gap:8px;margin-top:8px;">
        <input id="pp-nome" placeholder="Nome do projeto (ex.: Treinamento Vespor)">
        <div style="display:flex;gap:8px;"><input id="pp-rotulo" value="Módulo" style="max-width:150px" title="Como chamar cada item"><span class="card-sub" style="align-self:center">como chamar cada item (Módulo, Vídeo, Entrega…)</span></div>
        <label class="card-sub" for="pp-etapas">Etapas de cada item (uma por linha):</label>
        <textarea id="pp-etapas" rows="7">${ETAPAS_VIDEO.join("\n")}</textarea>
        <div><button class="botao" id="pp-criar">Criar projeto</button></div>
      </div></details>
  </div>`;
}

function ligarProjetosCliente(cliente) {
  const raiz = document.getElementById("pc-projetos"); if (!raiz) return;
  raiz.querySelectorAll("details[data-pp-id]").forEach((d) => d.addEventListener("toggle", () => { if (d.open) PP_ABERTOS.add(d.dataset.ppId); else PP_ABERTOS.delete(d.dataset.ppId); }));
  const refrescar = () => { renderizarPainelCliente(cliente.id); if (typeof atualizarPainel === "function") atualizarPainel(); };
  raiz.querySelectorAll("[data-passo]").forEach((b) => b.addEventListener("click", () => { alternarPasso(b.dataset.pj, b.dataset.mod, Number(b.dataset.passo)); refrescar(); }));
  raiz.querySelectorAll("[data-pp-concluir]").forEach((b) => b.addEventListener("click", () => { const [p, m, i] = b.dataset.ppConcluir.split("|"); concluirEtapaModulo(p, m, Number(i)); refrescar(); }));
  raiz.querySelectorAll("[data-pp-del-item]").forEach((b) => b.addEventListener("click", () => {
    const [p, m] = b.dataset.ppDelItem.split("|"); if (!confirm("Remover este item do projeto? As atividades já registradas continuam.")) return;
    atualizarEstado((e) => { const pj = e.projetosVideo.find((x) => x.id === p); pj.modulos = pj.modulos.filter((x) => x.id !== m); if (pj.ativoId === m && pj.modulos[0]) pj.ativoId = pj.modulos[0].id; }); refrescar();
  }));
  raiz.querySelectorAll("[data-pp-foco]").forEach((b) => b.addEventListener("click", () => { atualizarEstado((e) => e.projetosVideo.forEach((p) => { p.foco = p.id === b.dataset.ppFoco; })); refrescar(); }));
  raiz.querySelectorAll("[data-pp-del]").forEach((b) => b.addEventListener("click", () => {
    if (!confirm("Excluir este projeto? As atividades já registradas continuam no histórico.")) return;
    atualizarEstado((e) => { e.projetosVideo = e.projetosVideo.filter((p) => p.id !== b.dataset.ppDel); }); refrescar();
  }));
  const adicionar = (id) => {
    const inp = raiz.querySelector(`[data-pp-novo="${id}"]`); const nome = inp.value.trim(); if (!nome) return;
    atualizarEstado((e) => { const pj = e.projetosVideo.find((x) => x.id === id); const novo = { id: gerarId(), nome, feitas: [] }; pj.modulos.push(novo); if (!pj.ativoId) pj.ativoId = novo.id; }); refrescar();
  };
  raiz.querySelectorAll("[data-pp-add]").forEach((b) => b.addEventListener("click", () => adicionar(b.dataset.ppAdd)));
  raiz.querySelectorAll("[data-pp-novo]").forEach((i) => i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") adicionar(i.dataset.ppNovo); }));
  const criar = document.getElementById("pp-criar");
  if (criar) criar.addEventListener("click", () => {
    const nome = document.getElementById("pp-nome").value.trim(); if (!nome) { alert("Dê um nome ao projeto."); return; }
    const etapas = document.getElementById("pp-etapas").value.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!etapas.length) { alert("Informe ao menos uma etapa."); return; }
    atualizarEstado((e) => {
      const primeiro = !e.projetosVideo.some((p) => p.foco);
      e.projetosVideo.push({ id: gerarId(), nome, cliente: cliente.nome, clienteId: cliente.id, rotulo: document.getElementById("pp-rotulo").value.trim() || "Item", etapas, modulos: [], foco: primeiro });
    });
    refrescar();
  });
}
