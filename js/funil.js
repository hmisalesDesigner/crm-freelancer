/**
 * funil.js
 * Kanban do funil de vendas, baseado no fluxo real de briefing do Henrique:
 * Prospecção → Contato → Briefing → Orçamento enviado → Fechado → Em andamento → Entregue
 */

function renderizarPaginaFunil() {
  const container = document.getElementById("pagina-funil");

  container.innerHTML = `
    <div class="kanban" id="kanban-funil">
      ${ETAPAS_FUNIL.map((etapa) => `
        <div class="kanban-coluna" data-etapa="${etapa}">
          <h4>${etapa}</h4>
          <div class="kanban-lista" data-etapa-lista="${etapa}"></div>
        </div>
      `).join("")}
    </div>
  `;

  function desenharKanban() {
    ETAPAS_FUNIL.forEach((etapa) => {
      const lista = container.querySelector(`[data-etapa-lista="${etapa}"]`);
      const clientesDaEtapa = ESTADO.clientes.filter((c) => c.etapaFunil === etapa);
      lista.innerHTML = clientesDaEtapa
        .map((c) => {
          const total = (c.historicoFinanceiro || []).reduce((s, h) => s + Number(h.valor || 0), 0);
          return `
            <div class="kanban-card" draggable="true" data-cliente-id="${c.id}">
              <b>${c.nome}</b>
              <span>${(c.demanda || "").slice(0, 30)}</span>
              <div class="valor-card">${formatarMoeda(total)}</div>
            </div>`;
        })
        .join("");

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
