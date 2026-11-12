/**
 * prospeccao.js
 * Apoio à prospecção: lista de leads para rastrear buscas por perfis no Instagram
 * (focado em Maringá-PR), gráficas e outros freelancers de mídias sociais para parceria.
 *
 * Não existe API pública do Instagram para buscar perfis automaticamente sem
 * aprovação do Meta, então esta tela funciona como organizador de leads,
 * com links de busca prontos para o Instagram e Google.
 */

const TIPOS_PROSPECCAO = ["Cliente direto", "Gráfica", "Freelancer parceiro"];

function gerarLinksBusca(termo, local) {
  const query = encodeURIComponent(`${termo} ${local}`);
  return {
    instagram: `https://www.instagram.com/explore/search/keyword/?q=${query}`,
    google: `https://www.google.com/search?q=${query}`,
  };
}

function renderizarPaginaProspeccao() {
  const container = document.getElementById("pagina-prospeccao");

  container.innerHTML = `
    <div class="form-grid">
      <div class="campo">
        <label>Termo de busca</label>
        <input id="pros-termo" placeholder="Ex: loja de roupas, gráfica, social media">
      </div>
      <div class="campo">
        <label>Cidade/região</label>
        <input id="pros-local" value="Maringá PR">
      </div>
    </div>
    <button class="botao" id="btn-buscar-prospeccao" style="margin-top:12px;">Gerar links de busca</button>

    <div id="pros-links" class="aviso" style="display:none; margin-top:14px; max-width:700px;"></div>

    <h3 style="margin-top:28px;">Leads salvos</h3>
    <button class="botao secundario" id="btn-novo-lead" style="margin-bottom:12px;">+ Adicionar lead manualmente</button>

    <div class="lista-prospeccao" id="lista-leads"></div>
  `;

  document.getElementById("btn-buscar-prospeccao").addEventListener("click", () => {
    const termo = document.getElementById("pros-termo").value.trim();
    const local = document.getElementById("pros-local").value.trim();
    if (!termo) { alert("Digite um termo de busca."); return; }
    const links = gerarLinksBusca(termo, local);
    const div = document.getElementById("pros-links");
    div.style.display = "block";
    div.innerHTML = `
      🔎 Busca sugerida para "<b>${termo}</b>" em "<b>${local}</b>":<br><br>
      <a href="${links.instagram}" target="_blank" rel="noopener">📷 Buscar no Instagram</a><br>
      <a href="${links.google}" target="_blank" rel="noopener">🔍 Buscar no Google</a>
    `;
  });

  function desenharLeads() {
    const lista = document.getElementById("lista-leads");
    lista.innerHTML = ESTADO.prospeccoes
      .map(
        (p) => `
        <div class="item-prospeccao">
          <div>
            <b>${p.nome}</b> <span style="color:var(--cor-texto-suave); font-size:12px;">(${p.tipo})</span><br>
            <span style="font-size:12px; color:var(--cor-texto-suave);">${p.local || ""} ${p.contato ? "· " + p.contato : ""} ${p.observacao ? "· " + p.observacao : ""}</span>
          </div>
          <button class="botao perigo pequeno" data-excluir-lead="${p.id}">Excluir</button>
        </div>`
      )
      .join("") || `<p style="color:var(--cor-texto-suave);">Nenhum lead salvo ainda.</p>`;

    lista.querySelectorAll("[data-excluir-lead]").forEach((btn) =>
      btn.addEventListener("click", () => {
        atualizarEstado((estado) => {
          estado.prospeccoes = estado.prospeccoes.filter((p) => p.id !== btn.dataset.excluirLead);
        });
        desenharLeads();
      })
    );
  }

  document.getElementById("btn-novo-lead").addEventListener("click", () => {
    const nome = prompt("Nome do perfil/empresa:");
    if (!nome) return;
    const tipo = prompt(`Tipo (${TIPOS_PROSPECCAO.join(" / ")}):`, TIPOS_PROSPECCAO[0]) || TIPOS_PROSPECCAO[0];
    const contato = prompt("Contato (opcional):") || "";
    const observacao = prompt("Observação (opcional):") || "";
    atualizarEstado((estado) => {
      estado.prospeccoes.push({
        id: gerarId(),
        nome,
        tipo,
        local: document.getElementById("pros-local").value,
        contato,
        observacao,
        status: "novo",
      });
    });
    desenharLeads();
  });

  desenharLeads();
}
