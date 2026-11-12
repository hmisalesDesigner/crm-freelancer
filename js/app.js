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
    resumoFunil.innerHTML = ETAPAS_FUNIL.map((etapa) => {
      const qtd = ESTADO.clientes.filter((c) => c.etapaFunil === etapa).length;
      return `<div class="etapa"><b>${qtd}</b><span>${etapa}</span></div>`;
    }).join("");
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

    <h3 style="margin-top:32px;">Backup dos dados</h3>
    <p style="color:var(--cor-texto-suave); font-size:13px; max-width:600px;">
      Os dados ficam salvos neste navegador. Para manter uma cópia de segurança no
      Google Drive, exporte o backup e salve o arquivo .json dentro da pasta sincronizada
      do Drive no seu computador.
    </p>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <button class="botao secundario" id="btn-exportar-backup">⬇️ Exportar backup (.json)</button>
      <label class="botao secundario" style="cursor:pointer;">
        ⬆️ Importar backup (.json)
        <input type="file" id="input-importar-backup" accept=".json" style="display:none;">
      </label>
    </div>
  `;

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

  atualizarPainel();
}

document.addEventListener("DOMContentLoaded", inicializarApp);
