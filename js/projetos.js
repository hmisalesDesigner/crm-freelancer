/**
 * projetos.js
 * Projeto de vídeos em módulos (ex.: Treinamento Vespor). Cada módulo segue as mesmas etapas de produção.
 * O Painel mostra só o PRÓXIMO PASSO do módulo ativo: tarefa pequena, fácil de começar e de concluir.
 * Concluir uma etapa registra uma atividade concluída do cliente (entra nos relatórios).
 */
const ETAPAS_VIDEO = ["Roteiro", "Geração das locuções", "Tratamento dos áudios", "Inserção na edição", "Gravação das telas", "Inserção das cenas", "Efeitos finais (transições, textos, animações)"];

function projetoAtivo() { return (ESTADO.projetosVideo || [])[0] || null; }
function moduloDoProjeto(pj, id) { return (pj.modulos || []).find((m) => m.id === id) || null; }
function proximaEtapa(m) { const i = ETAPAS_VIDEO.findIndex((_, k) => !(m.feitas || []).includes(k)); return i; } // -1 = módulo completo

function concluirEtapaModulo(pjId, modId, idx) {
  atualizarEstado((e) => {
    const pj = e.projetosVideo.find((p) => p.id === pjId); const m = pj && moduloDoProjeto(pj, modId);
    if (!m || (m.feitas || []).includes(idx)) return;
    m.feitas = (m.feitas || []).concat(idx);
    e.demandas.push({ id: gerarId(), cliente: pj.cliente, clienteId: pj.clienteId, titulo: `${m.nome} — ${ETAPAS_VIDEO[idx]}`, data: hojeISO(), planejadaPara: hojeISO(), status: "concluida", categoria: "Vídeo/Áudio", campanha: pj.nome });
    if (ETAPAS_VIDEO.every((_, k) => m.feitas.includes(k))) { // módulo pronto: fecha a demanda do módulo e passa para o próximo
      const dem = e.demandas.find((d) => d.id === m.id); if (dem && dem.status !== "concluida") concluirDemanda(dem);
      const prox = pj.modulos.find((x) => !ETAPAS_VIDEO.every((_, k) => (x.feitas || []).includes(k)));
      if (prox) pj.ativoId = prox.id;
    }
  });
}

function renderizarFocoProjeto() {
  const alvo = document.getElementById("foco-projeto"); if (!alvo) return;
  const pj = projetoAtivo();
  if (!pj) { alvo.innerHTML = ""; return; }
  const m = moduloDoProjeto(pj, pj.ativoId) || pj.modulos[0];
  if (!m) { alvo.innerHTML = ""; return; }
  const feitas = (m.feitas || []).length, total = ETAPAS_VIDEO.length, idx = proximaEtapa(m);
  const passos = ETAPAS_VIDEO.map((nome, k) => {
    const feita = (m.feitas || []).includes(k);
    return `<button class="passo ${feita ? "feito" : k === idx ? "atual" : ""}" data-passo="${k}" title="${feita ? "Desmarcar" : "Marcar como feita (sem registrar atividade)"}"><i>${feita ? "✔" : k + 1}</i><span>${escaparHtml(nome.replace(/ \(.*/, ""))}</span></button>`;
  }).join("");
  alvo.innerHTML = `<div class="foco">
    <div class="foco-topo"><span class="foco-rotulo">🎯 Foco agora · ${escaparHtml(pj.nome)}</span>
      <select id="foco-modulo" title="Trocar módulo">${pj.modulos.map((x) => `<option value="${x.id}"${x.id === m.id ? " selected" : ""}>${escaparHtml(x.nome.replace(/ — .*/, ""))}${ETAPAS_VIDEO.every((_, k) => (x.feitas || []).includes(k)) ? " ✔" : ""}</option>`).join("")}</select></div>
    <h3>${escaparHtml(m.nome)}</h3>
    <div class="passos">${passos}</div>
    ${idx >= 0
      ? `<div class="foco-proximo"><div><small>Próximo passo (${feitas}/${total} feitos)</small><b>${escaparHtml(ETAPAS_VIDEO[idx])}</b></div><button class="botao" id="foco-concluir">✔ Concluí esta etapa</button></div>`
      : `<div class="foco-proximo"><div><small>Módulo completo</small><b>🎉 Todas as etapas feitas</b></div></div>`}
  </div>`;
  document.getElementById("foco-modulo").addEventListener("change", (ev) => { atualizarEstado((e) => { e.projetosVideo[0].ativoId = ev.target.value; }); renderizarFocoProjeto(); });
  const bt = document.getElementById("foco-concluir");
  if (bt) bt.addEventListener("click", () => { concluirEtapaModulo(pj.id, m.id, idx); atualizarPainel(); });
  alvo.querySelectorAll("[data-passo]").forEach((b) => b.addEventListener("click", () => {
    const k = Number(b.dataset.passo);
    atualizarEstado((e) => { const mm = moduloDoProjeto(e.projetosVideo[0], m.id); mm.feitas = mm.feitas.includes(k) ? mm.feitas.filter((x) => x !== k) : mm.feitas.concat(k); });
    renderizarFocoProjeto();
  }));
}
