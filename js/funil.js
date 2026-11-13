/**
 * funil.js
 * Kanban do funil de vendas, baseado no fluxo real de briefing do Henrique:
 * Prospecção → Contato → Briefing → Orçamento enviado → Fechado → Ativos → Inativos
 */

function renderizarPaginaFunil() {
  const container = document.getElementById("pagina-funil");

  container.innerHTML = `
    <div class="kanban" id="kanban-funil">
      ${ETAPAS_FUNIL.map((etapa) => `
        <div class="kanban-coluna" data-etapa="${etapa}">
          <h4>${etapa} <span class="kanban-contagem" data-contagem="${etapa}"></span></h4>
          <div class="kanban-lista" data-etapa-lista="${etapa}"></div>
        </div>
      `).join("")}
    </div>
  `;

  function desenharKanban() {
    ETAPAS_FUNIL.forEach((etapa) => {
      const lista = container.querySelector(`[data-etapa-lista="${etapa}"]`);
      const clientesDaEtapa = ESTADO.clientes.filter((c) => c.etapaFunil === etapa);
      const totalEtapa = clientesDaEtapa.reduce((s, c) => s + (c.historicoFinanceiro || []).reduce((x, h) => x + Number(h.valor || 0), 0), 0);
      container.querySelector(`[data-contagem="${etapa}"]`).textContent = clientesDaEtapa.length ? `· ${clientesDaEtapa.length}` : "";
      lista.innerHTML = clientesDaEtapa
        .map((c) => {
          const total = (c.historicoFinanceiro || []).reduce((s, h) => s + Number(h.valor || 0), 0);
          const iniciais = (c.nome || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
          const avatar = c.foto
            ? `<img src="${c.foto}" alt="">`
            : iniciais;
          return `
            <div class="kanban-card" draggable="true" data-cliente-id="${c.id}">
              <div class="avatar-iniciais">${avatar}</div>
              <div class="kanban-card-info">
                <b>${escaparHtml(c.nome)}</b>
                <span>${escaparHtml((c.demanda || "").slice(0, 26))}</span>
                <div class="valor-card">${formatarMoeda(total)}</div>
                <select class="mover-etapa" data-mover="${c.id}" aria-label="Mover para etapa">
                  ${ETAPAS_FUNIL.map((e) => `<option value="${e}" ${e === c.etapaFunil ? "selected" : ""}>${e === c.etapaFunil ? "↔ Mover…" : e}</option>`).join("")}
                </select>
              </div>
            </div>`;
        })
        .join("");

      lista.querySelectorAll("[data-mover]").forEach((sel) => sel.addEventListener("change", () => {
        atualizarEstado((estado) => { const c = estado.clientes.find((x) => x.id === sel.dataset.mover); if (c) c.etapaFunil = sel.value; });
        desenharKanban(); atualizarPainel();
      }));
      lista.querySelectorAll(".kanban-card").forEach((card) => {
        card.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", card.dataset.clienteId);
        });
      });
    });

    container.querySelectorAll(".kanban-coluna").forEach((coluna) => {
      coluna.addEventListener("dragover", (e) => {
        e.preventDefault();
        coluna.classList.add("sobre-arrasto");
      });
      coluna.addEventListener("dragleave", () => coluna.classList.remove("sobre-arrasto"));
      coluna.addEventListener("drop", (e) => {
        e.preventDefault();
        coluna.classList.remove("sobre-arrasto");
        const clienteId = e.dataTransfer.getData("text/plain");
        const novaEtapa = coluna.dataset.etapa;
        atualizarEstado((estado) => {
          const cliente = estado.clientes.find((c) => c.id === clienteId);
          if (cliente) cliente.etapaFunil = novaEtapa;
        });
        desenharKanban();
        atualizarPainel();
      });
    });
  }

  desenharKanban();
}
