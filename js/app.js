/**
 * app.js
 * Ponto de entrada: navegação entre páginas, tema, painel e configurações gerais.
 */

const RENDERIZADORES = {
  painel: atualizarPainel,
  calculadora: renderizarPaginaCalculadora,
  clientes: renderizarPaginaClientes,
  funil: renderizarPaginaFunil,
  orcamentos: renderizarPaginaOrcamentos,
  prospeccao: renderizarPaginaProspeccao,
  configuracoes: renderizarPaginaConfiguracoes,
};

const TITULOS_PAGINA = {
  painel: "Painel",
  calculadora: "Calculadora de Preço",
  clientes: "Clientes",
  funil: "Funil de Vendas",
  orcamentos: "Orçamentos",
  prospeccao: "Prospecção",
  configuracoes: "Configurações",
};

function irParaPagina(pagina) {
  document.querySelectorAll(".pagina").forEach((p) => p.classList.remove("ativa"));
  document.getElementById(`pagina-${pagina}`).classList.add("ativa");

  document.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("ativo"));
  document.querySelector(`.menu-item[data-pagina="${pagina}"]`).classList.add("ativo");

  document.getElementById("titulo-pagina").textContent = TITULOS_PAGINA[pagina];

  const render = RENDERIZADORES[pagina];
  if (render) render();
}

function atualizarPainel() {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let faturamentoMes = ESTADO.configuracoes.clienteFixoMensal || 0;
  ESTADO.clientes.forEach((c) => {
    (c.historicoFinanceiro || []).forEach((h) => {
      const data = new Date(h.data);
      if (data.getMonth() === mesAtual && data.getFullYear() === anoAtual) {
        faturamentoMes += Number(h.valor || 0);
      }
    });
  });

  const faturamentoAno = calcularFaturamentoAno();
  const limiteMei = ESTADO.configuracoes.limiteMeiAnual || 81000;
  const percentualMei = Math.min((faturamentoAno / limiteMei) * 100, 100);

  document.getElementById("painel-faturamento-mes").textContent = formatarMoeda(faturamentoMes);
  document.getElementById("painel-faturamento-ano").textContent = formatarMoeda(faturamentoAno);
  document.getElementById("painel-mei-texto").textContent = `${percentualMei.toFixed(1)}% do limite de ${formatarMoeda(limiteMei)}`;

  const barra = document.getElementById("painel-barra-mei");
  barra.style.width = percentualMei + "%";
  barra.className = "barra-progresso-interna" + (percentualMei > 90 ? " perigo" : percentualMei > 70 ? " alerta" : "");

  document.getElementById("painel-clientes-ativos").textContent = ESTADO.clientes.filter(
    (c) => !["Entregue"].includes(c.etapaFunil)
  ).length;

  document.getElementById("painel-orcamentos-abertos").textContent = ESTADO.orcamentos.filter((o) => !o.aceito).length;

  const resumoFunil = document.getElementById("painel-funil-resumo");
  if (resumoFunil) {
    const contagens = ETAPAS_FUNIL.map((etapa) => ESTADO.clientes.filter((c) => c.etapaFunil === etapa).length);
    const maior = Math.max(1, ...contagens);
    resumoFunil.innerHTML = ETAPAS_FUNIL.map((etapa, i) => {
      const qtd = contagens[i];
      const largura = (qtd / maior) * 100;
      return `
        <div class="funil-barra-linha">
          <span class="rotulo">${etapa}</span>
          <div class="funil-barra-trilha"><div class="funil-barra-preenchimento" style="width:${largura}%"></div></div>
          <span class="numero">${qtd}</span>
        </div>`;
    }).join("");
  }

  const orcamentosRecentes = document.getElementById("painel-orcamentos-recentes");
  if (orcamentosRecentes) {
    const recentes = [...ESTADO.orcamentos]
      .sort((a, b) => new Date(b.dataEnvio) - new Date(a.dataEnvio))
      .slice(0, 5);
    orcamentosRecentes.innerHTML = recentes
      .map((o) => {
        const cliente = ESTADO.clientes.find((c) => c.id === o.clienteId);
        return `
          <tr>
            <td>${cliente ? cliente.nome : "-"}</td>
            <td><span class="selo ${o.aceito ? "aceito" : "enviado"}">${o.aceito ? "Aprovado" : "Em negociação"}</span></td>
            <td>${(o.descricao || "-").slice(0, 30)}</td>
            <td>${formatarMoeda(o.valor)}</td>
          </tr>`;
      })
      .join("") || `<tr><td colspan="4" style="text-align:center; color:var(--cor-texto-suave);">Nenhum orçamento ainda.</td></tr>`;
  }
}

function renderizarPaginaConfiguracoes() {
  const container = document.getElementById("pagina-configuracoes");
  const cfg = ESTADO.configuracoes;

  container.innerHTML = `
    <h3>Negócio</h3>
    <div class="form-grid">
      <div class="campo">
        <label>Valor fixo mensal (cliente recorrente, R$)</label>
        <input type="number" id="cfg-cliente-fixo" value="${cfg.clienteFixoMensal}">
      </div>
      <div class="campo">
        <label>Limite anual MEI (R$)</label>
        <input type="number" id="cfg-limite-mei" value="${cfg.limiteMeiAnual}">
      </div>
    </div>

    <h3 style="margin-top:24px;">Lembrete de investimento (B3)</h3>
    <div class="form-grid">
      <div class="campo">
        <label>Ticker da ação (ex: TAEE11)</label>
        <input id="cfg-ticker-b3" value="${cfg.acaoB3.ticker}">
      </div>
      <div class="campo">
        <label>% do valor recebido a reservar</label>
        <input type="number" id="cfg-percentual-b3" value="${cfg.acaoB3.percentualReserva}">
      </div>
    </div>
    <button class="botao" id="btn-salvar-config-geral" style="margin-top:14px;">Salvar configurações</button>

    <h3 style="margin-top:32px;">Backup automático no Google Drive</h3>
    <p style="color:var(--cor-texto-suave); font-size:13px; max-width:600px;">
      Conecte sua conta do Google para que os dados (clientes, orçamentos, faturamento)
      sejam salvos automaticamente em um arquivo dentro da sua pasta do Drive, toda vez
      que algo mudar.
    </p>
    <div style="display:flex; align-items:center; gap:10px; margin-top:10px;">
      <button class="botao" id="btn-conectar-drive">🔗 Conectar ao Google Drive</button>
      <span class="card-sub" id="drive-status-config"></span>
    </div>

    <h3 style="margin-top:28px;">Backup manual (.json)</h3>
    <p style="color:var(--cor-texto-suave); font-size:13px; max-width:600px;">
      Alternativa ao backup automático: exporte ou importe um arquivo .json manualmente.
    </p>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <button class="botao secundario" id="btn-exportar-backup">⬇️ Exportar backup (.json)</button>
      <label class="botao secundario" style="cursor:pointer;">
        ⬆️ Importar backup (.json)
        <input type="file" id="input-importar-backup" accept=".json" style="display:none;">
      </label>
    </div>
  `;

  const btnConectarDrive = document.getElementById("btn-conectar-drive");
  if (btnConectarDrive) {
    btnConectarDrive.addEventListener("click", conectarDrive);
    if (typeof driveConectado === "function" && driveConectado()) {
      document.getElementById("drive-status-config").textContent = "🔗 Conectado ao Google Drive";
    }
  }

  document.getElementById("btn-salvar-config-geral").addEventListener("click", () => {
    atualizarEstado((estado) => {
      estado.configuracoes.clienteFixoMensal = Number(document.getElementById("cfg-cliente-fixo").value) || 0;
      estado.configuracoes.limiteMeiAnual = Number(document.getElementById("cfg-limite-mei").value) || 81000;
      estado.configuracoes.acaoB3.ticker = document.getElementById("cfg-ticker-b3").value.trim().toUpperCase();
      estado.configuracoes.acaoB3.percentualReserva = Number(document.getElementById("cfg-percentual-b3").value) || 0;
    });
    alert("Configurações salvas!");
    atualizarPainel();
  });

  document.getElementById("btn-exportar-backup").addEventListener("click", exportarBackupJSON);

  document.getElementById("input-importar-backup").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    try {
      ESTADO = await importarBackupJSON(arquivo);
      alert("Backup importado com sucesso!");
      location.reload();
    } catch (err) {
      alert("Erro ao importar backup: " + err.message);
    }
  });
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  document.getElementById("btn-tema").textContent = tema === "escuro" ? "🌙 Tema" : "☀️ Tema";
}

function inicializarApp() {
  aplicarTema(ESTADO.configuracoes.tema || "escuro");

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => irParaPagina(item.dataset.pagina));
  });

  document.getElementById("btn-tema").addEventListener("click", () => {
    const novoTema = ESTADO.configuracoes.tema === "escuro" ? "claro" : "escuro";
    atualizarEstado((estado) => { estado.configuracoes.tema = novoTema; });
    aplicarTema(novoTema);
  });

  const btnAtualizar = document.getElementById("btn-atualizar-site");
  if (btnAtualizar) btnAtualizar.addEventListener("click", recarregarSiteSemCache);

  atualizarPainel();
}

/**
 * Recarrega o site forçando o navegador a buscar os arquivos atualizados,
 * em vez de usar a versão guardada em cache (equivalente a Ctrl+Shift+R).
 */
async function recarregarSiteSemCache() {
  try {
    if (window.caches) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((nome) => caches.delete(nome)));
    }
  } catch (e) {
    console.warn("Não foi possível limpar o cache do Cache Storage.", e);
  }

  // Adiciona um parâmetro único para forçar o navegador a buscar o HTML
  // (e, por consequência, o CSS/JS referenciados) direto do servidor.
  const url = new URL(location.href);
  url.searchParams.set("_v", Date.now().toString(36));
  location.replace(url.toString());
}

document.addEventListener("DOMContentLoaded", inicializarApp);
