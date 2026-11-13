/**
 * clientes.js
 * CRM de clientes: cadastro, histórico financeiro e consulta de CNPJ via BrasilAPI.
 * BrasilAPI: https://brasilapi.com.br/api/cnpj/v1/{cnpj}  (gratuita, sem chave, dados da Receita Federal)
 */

const ETAPAS_FUNIL = [
  "Prospecção",
  "Contato",
  "Briefing",
  "Orçamento enviado",
  "Fechado",
  "Ativos",
  "Inativos",
];

async function consultarCNPJ(cnpj) {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) throw new Error("CNPJ inválido. Use 14 números.");
  const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
  if (!resp.ok) throw new Error("CNPJ não encontrado na BrasilAPI.");
  const dados = await resp.json();
  return {
    razaoSocial: dados.razao_social || "",
    capitalSocial: dados.capital_social || 0,
    situacao: dados.descricao_situacao_cadastral || "",
    municipio: dados.municipio || "",
    uf: dados.uf || "",
  };
}

function renderizarPaginaClientes() {
  const container = document.getElementById("pagina-clientes");

  container.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
      <button class="botao" id="btn-novo-cliente">+ Novo Cliente</button>
      <button class="botao secundario" id="btn-copiar-link-briefing" title="Link público para o cliente responder o briefing">🔗 Copiar link do briefing</button>
    </div>
    <table class="tabela">
      <thead>
        <tr>
          <th>Nome</th><th>Contato</th><th>Demanda</th><th>Etapa</th><th>Próx. contato</th><th>Total faturado</th><th></th>
        </tr>
      </thead>
      <tbody id="tabela-clientes-corpo"></tbody>
    </table>

    <div id="modal-cliente" style="display:none; margin-top:20px;">
      <h3 id="modal-cliente-titulo">Novo Cliente</h3>
      <div class="layout-duas-colunas">
        <div>
          <div class="avatar-upload">
            <div class="preview" id="cli-foto-preview">?</div>
            <label class="botao secundario pequeno" style="cursor:pointer;">
              📷 Anexar foto (print do contato)
              <input type="file" id="cli-foto-input" accept="image/*" style="display:none;">
            </label>
          </div>
          <div class="form-grid">
            <div class="campo"><label>Nome</label><input id="cli-nome"></div>
            <div class="campo"><label>Contato (WhatsApp/e-mail)</label><input id="cli-contato"></div>
            <div class="campo">
              <label>CNPJ (opcional)</label>
              <div style="display:flex; gap:6px;">
                <input id="cli-cnpj" placeholder="00000000000000">
                <button class="botao secundario pequeno" id="btn-consultar-cnpj">Buscar CNPJ</button>
              </div>
            </div>
            <div class="campo"><label>Razão Social</label><input id="cli-razao" readonly></div>
            <div class="campo"><label>Capital Social</label><input id="cli-capital" readonly></div>
            <div class="campo"><label>Próximo contato (follow-up)</label><input type="date" id="cli-proximo"></div>
            <div class="campo">
              <label>Etapa no funil</label>
              <select id="cli-etapa">${ETAPAS_FUNIL.map((e) => `<option value="${e}">${e}</option>`).join("")}</select>
            </div>
          </div>
          <div class="campo" style="margin-top:12px; max-width:700px;">
            <label>Demanda</label>
            <textarea id="cli-demanda"></textarea>
          </div>
          <div id="cli-cnpj-status" class="aviso" style="display:none; max-width:700px;"></div>
        </div>

        <div class="painel-lateral-resumo">
          <h4>Dados da Empresa</h4>
          <div class="linha-resumo"><span class="rotulo">Empresa</span><span class="valor" id="resumo-cli-nome">—</span></div>
          <div class="linha-resumo"><span class="rotulo">Capital</span><span class="valor" id="resumo-cli-capital">—</span></div>
          <div class="linha-resumo"><span class="rotulo">Demanda</span><span class="valor" id="resumo-cli-demanda">—</span></div>
          <button class="botao" id="btn-salvar-cliente" style="width:100%; margin-top:10px;">Cadastrar</button>
          <button class="botao secundario" id="btn-cancelar-cliente" style="width:100%; margin-top:8px;">Cancelar</button>
        </div>
      </div>
    </div>
  `;

  let clienteEditandoId = null;
  let fotoAtualBase64 = "";

  function atualizarResumoLateral() {
    document.getElementById("resumo-cli-nome").textContent = document.getElementById("cli-nome").value || "—";
    document.getElementById("resumo-cli-capital").textContent = document.getElementById("cli-capital").value || "—";
    document.getElementById("resumo-cli-demanda").textContent = document.getElementById("cli-demanda").value || "—";
  }

  function atualizarPreviewFoto() {
    const preview = document.getElementById("cli-foto-preview");
    if (fotoAtualBase64) {
      preview.innerHTML = `<img src="${fotoAtualBase64}" alt="">`;
    } else {
      const nome = document.getElementById("cli-nome").value.trim();
      preview.textContent = nome ? nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "?";
    }
  }

  function desenharTabela() {
    const corpo = document.getElementById("tabela-clientes-corpo");
    corpo.innerHTML = ESTADO.clientes
      .map((c) => {
        const total = (c.historicoFinanceiro || []).reduce((s, h) => s + Number(h.valor || 0), 0);
        const iniciais = (c.nome || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
        const avatarHtml = c.foto
          ? `<img src="${c.foto}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;">`
          : `<span style="display:inline-flex;width:28px;height:28px;border-radius:50%;background:var(--cor-primaria-clara);color:var(--cor-primaria);align-items:center;justify-content:center;font-size:11px;font-weight:700;vertical-align:middle;margin-right:8px;">${iniciais}</span>`;
        return `
          <tr>
            <td>${avatarHtml}${escaparHtml(c.nome)}</td>
            <td>${escaparHtml(c.contato || "-")}</td>
            <td>${escaparHtml((c.demanda || "").slice(0, 40))}</td>
            <td>${escaparHtml(c.etapaFunil)}</td>
            <td>${c.proximoContato ? formatarDataBR(c.proximoContato) : "-"}</td>
            <td>${formatarMoeda(total)}</td>
            <td>
              <button class="botao secundario pequeno" data-editar="${c.id}">Editar</button>
              <button class="botao perigo pequeno" data-excluir="${c.id}">Excluir</button>
            </td>
          </tr>`;
      })
      .join("") || `<tr><td colspan="7" style="text-align:center; color:var(--cor-texto-suave);">Nenhum cliente cadastrado ainda.</td></tr>`;

    corpo.querySelectorAll("[data-editar]").forEach((btn) =>
      btn.addEventListener("click", () => abrirModal(btn.dataset.editar))
    );
    corpo.querySelectorAll("[data-excluir]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!confirm("Excluir este cliente?")) return;
        atualizarEstado((estado) => {
          estado.clientes = estado.clientes.filter((c) => c.id !== btn.dataset.excluir);
        });
        desenharTabela();
        atualizarPainel();
      })
    );
  }

  function abrirModal(id) {
    clienteEditandoId = id || null;
    const modal = document.getElementById("modal-cliente");
    modal.style.display = "block";
    document.getElementById("modal-cliente-titulo").textContent = id ? "Editar Cliente" : "Novo Cliente";

    const cliente = id ? ESTADO.clientes.find((c) => c.id === id) : null;
    document.getElementById("cli-nome").value = cliente?.nome || "";
    document.getElementById("cli-contato").value = cliente?.contato || "";
    document.getElementById("cli-cnpj").value = cliente?.cnpj || "";
    document.getElementById("cli-razao").value = cliente?.razaoSocial || "";
    document.getElementById("cli-capital").value = cliente?.capitalSocial ? formatarMoeda(cliente.capitalSocial) : "";
    document.getElementById("cli-etapa").value = cliente?.etapaFunil || "Prospecção";
    document.getElementById("cli-demanda").value = cliente?.demanda || "";
    document.getElementById("cli-proximo").value = cliente?.proximoContato || "";
    document.getElementById("cli-cnpj-status").style.display = "none";
    fotoAtualBase64 = cliente?.foto || "";
    atualizarPreviewFoto();
    atualizarResumoLateral();
  }

  document.getElementById("btn-novo-cliente").addEventListener("click", () => abrirModal(null));
  document.getElementById("btn-copiar-link-briefing").addEventListener("click", copiarLinkBriefing);
  document.getElementById("btn-cancelar-cliente").addEventListener("click", () => {
    document.getElementById("modal-cliente").style.display = "none";
  });

  container.querySelectorAll("#cli-nome, #cli-capital, #cli-demanda").forEach((el) =>
    el.addEventListener("input", () => { atualizarResumoLateral(); atualizarPreviewFoto(); })
  );

  document.getElementById("cli-foto-input").addEventListener("change", (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (ev) => {
      fotoAtualBase64 = ev.target.result;
      atualizarPreviewFoto();
    };
    leitor.readAsDataURL(arquivo);
  });

  document.getElementById("btn-consultar-cnpj").addEventListener("click", async () => {
    const statusEl = document.getElementById("cli-cnpj-status");
    statusEl.style.display = "block";
    statusEl.className = "aviso";
    statusEl.textContent = "Consultando BrasilAPI...";
    try {
      const dados = await consultarCNPJ(document.getElementById("cli-cnpj").value);
      document.getElementById("cli-razao").value = dados.razaoSocial;
      document.getElementById("cli-capital").value = formatarMoeda(dados.capitalSocial);
      statusEl.textContent = `✅ ${dados.razaoSocial} — ${dados.situacao} — ${dados.municipio}/${dados.uf}`;
      atualizarResumoLateral();
    } catch (e) {
      statusEl.textContent = "⚠️ " + e.message;
    }
  });

  document.getElementById("btn-salvar-cliente").addEventListener("click", () => {
    const nome = document.getElementById("cli-nome").value.trim();
    if (!nome) { alert("Informe o nome do cliente."); return; }

    const capitalTexto = document.getElementById("cli-capital").value;
    const capitalNumero = Number(capitalTexto.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

    atualizarEstado((estado) => {
      if (clienteEditandoId) {
        const c = estado.clientes.find((x) => x.id === clienteEditandoId);
        Object.assign(c, {
          nome,
          contato: document.getElementById("cli-contato").value,
          cnpj: document.getElementById("cli-cnpj").value,
          razaoSocial: document.getElementById("cli-razao").value,
          capitalSocial: capitalNumero,
          etapaFunil: document.getElementById("cli-etapa").value,
          demanda: document.getElementById("cli-demanda").value,
          proximoContato: document.getElementById("cli-proximo").value,
          foto: fotoAtualBase64,
        });
      } else {
        estado.clientes.push({
          id: gerarId(),
          nome,
          contato: document.getElementById("cli-contato").value,
          cnpj: document.getElementById("cli-cnpj").value,
          razaoSocial: document.getElementById("cli-razao").value,
          capitalSocial: capitalNumero,
          etapaFunil: document.getElementById("cli-etapa").value,
          demanda: document.getElementById("cli-demanda").value,
          proximoContato: document.getElementById("cli-proximo").value,
          foto: fotoAtualBase64,
          historicoFinanceiro: [],
          criadoEm: new Date().toISOString(),
        });
      }
    });

    document.getElementById("modal-cliente").style.display = "none";
    desenharTabela();
    atualizarPainel();
  });

  desenharTabela();
}
