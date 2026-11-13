/**
 * calculadora.js
 * Módulo de cálculo de preço: hora, projeto e peça.
 * Fórmula base (quantocobrar.com.br):
 *   (salário desejado + custos fixos mensais) / horas pagas por mês = valor mínimo da hora
 */

function calcularValorHora(salarioDesejado, custosFixosMensais, horasPagasPorMes) {
  if (!horasPagasPorMes || horasPagasPorMes <= 0) return 0;
  return (Number(salarioDesejado) + Number(custosFixosMensais)) / Number(horasPagasPorMes);
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderizarPaginaCalculadora() {
  const cfg = ESTADO.configuracoes;
  const container = document.getElementById("pagina-calculadora");

  container.innerHTML = `
    <div class="abas" id="abas-modo-calculo">
      <div class="aba ativa" data-modo="hora">Por Hora</div>
      <div class="aba" data-modo="projeto">Por Projeto</div>
      <div class="aba" data-modo="peca">Por Peça</div>
      <div class="aba" data-modo="mes">Por Mês</div>
    </div>

    <div class="layout-duas-colunas">
      <div>
        <div id="bloco-modo-hora">
          <div class="form-grid">
            <div class="campo">
              <label>👤 Salário desejado por mês (R$)</label>
              <input type="number" id="calc-salario" value="${cfg.salarioDesejado}">
            </div>
            <div class="campo">
              <label>💳 Custos fixos mensais (R$)</label>
              <input type="number" id="calc-custos" value="${cfg.custosFixosMensais}">
            </div>
            <div class="campo">
              <label>🕐 Horas pagas por mês</label>
              <input type="number" id="calc-horas" value="${cfg.horasPagasPorMes}">
            </div>
          </div>
        </div>

        <div id="bloco-modo-projeto" style="display:none">
          <div class="form-grid">
            <div class="campo">
              <label>🕐 Horas estimadas do projeto</label>
              <input type="number" id="calc-horas-projeto" value="10">
            </div>
            <div class="campo">
              <label>📈 Margem de segurança (%)</label>
              <input type="number" id="calc-margem-projeto" value="20">
            </div>
          </div>
        </div>

        <div id="bloco-modo-peca" style="display:none">
          <div class="form-grid">
            <div class="campo">
              <label>💰 Valor por peça (R$)</label>
              <input type="number" id="calc-valor-peca" value="40">
            </div>
            <div class="campo">
              <label># Quantidade de peças</label>
              <input type="number" id="calc-qtd-peca" value="5">
            </div>
          </div>
        </div>

        <div id="bloco-modo-mes" style="display:none">
          <div class="form-grid">
            <div class="campo">
              <label>💳 Valor fixo mensal (R$)</label>
              <input type="number" id="calc-valor-fixo-mes" value="${cfg.clienteFixoMensal}">
            </div>
          </div>

          <div style="margin-top:16px; max-width:700px;">
            <h4 style="margin-bottom:8px;">Demandas do mês</h4>
            <div class="form-grid" style="grid-template-columns: 2fr 1fr auto;">
              <div class="campo"><label>Descrição da demanda</label><input id="mes-nova-descricao" placeholder="Ex: Edição de 3 reels"></div>
              <div class="campo"><label>Horas gastas</label><input type="number" id="mes-nova-horas" step="0.25" value="1"></div>
              <div class="campo"><label>&nbsp;</label><button class="botao secundario" id="btn-add-demanda-mes">+ Adicionar</button></div>
            </div>

            <table class="tabela" style="margin-top:14px;">
              <thead><tr><th>Demanda</th><th>Horas</th><th>% do mês</th><th>Valor equivalente</th><th></th></tr></thead>
              <tbody id="tabela-demandas-mes-corpo"></tbody>
            </table>
          </div>
        </div>

        <button class="botao" id="btn-salvar-config-calc" style="margin-top:18px; width:100%; max-width:700px;">Salvar como padrão</button>

        <div class="aviso mei" id="aviso-mei-calc"></div>
        <div class="aviso b3" id="aviso-b3-calc"></div>
      </div>

      <div class="painel-lateral-resumo">
        <h4>Taxa Sugerida</h4>
        <div id="resultado-visivel-hora">
          <span class="card-label">Valor mínimo da hora</span>
          <div class="valor" id="resultado-hora" style="font-size:26px; font-weight:800; color:var(--cor-primaria);">R$ 0,00</div>
        </div>
        <div id="resultado-visivel-projeto" style="display:none">
          <span class="card-label">Valor sugerido do projeto</span>
          <div class="valor" id="resultado-projeto" style="font-size:26px; font-weight:800; color:var(--cor-primaria);">R$ 0,00</div>
        </div>
        <div id="resultado-visivel-peca" style="display:none">
          <span class="card-label">Valor total</span>
          <div class="valor" id="resultado-peca" style="font-size:26px; font-weight:800; color:var(--cor-primaria);">R$ 0,00</div>
        </div>
        <div id="resultado-visivel-mes" style="display:none">
          <span class="card-label">Valor equivalente por hora</span>
          <div class="valor" id="resultado-mes-valor-hora" style="font-size:26px; font-weight:800; color:var(--cor-primaria);">R$ 0,00</div>
          <div class="linha-resumo" style="margin-top:10px;">
            <span class="rotulo">Horas lançadas no mês</span>
            <span class="valor" id="resultado-mes-horas-total" style="font-size:14px;">0h</span>
          </div>
        </div>
        <span class="card-sub">Baseado nas informações fornecidas</span>
      </div>
    </div>
  `;

  function recalcular() {
    const salario = Number(document.getElementById("calc-salario").value) || 0;
    const custos = Number(document.getElementById("calc-custos").value) || 0;
    const horas = Number(document.getElementById("calc-horas").value) || 0;
    const valorHora = calcularValorHora(salario, custos, horas);
    document.getElementById("resultado-hora").textContent = formatarMoeda(valorHora);

    const horasProjeto = Number(document.getElementById("calc-horas-projeto").value) || 0;
    const margem = Number(document.getElementById("calc-margem-projeto").value) || 0;
    const valorProjeto = valorHora * horasProjeto * (1 + margem / 100);
    document.getElementById("resultado-projeto").textContent = formatarMoeda(valorProjeto);

    const valorPeca = Number(document.getElementById("calc-valor-peca").value) || 0;
    const qtdPeca = Number(document.getElementById("calc-qtd-peca").value) || 0;
    document.getElementById("resultado-peca").textContent = formatarMoeda(valorPeca * qtdPeca);

    recalcularModoMes();
    atualizarAvisosCalculadora();
  }

  function obterDemandasDoMesAtual() {
    const hoje = new Date();
    return ESTADO.demandasMensais.filter((d) => {
      const data = new Date(d.data);
      return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
    });
  }

  function recalcularModoMes() {
    const valorFixo = Number(document.getElementById("calc-valor-fixo-mes")?.value) || 0;
    const demandas = obterDemandasDoMesAtual();
    const totalHoras = demandas.reduce((s, d) => s + Number(d.horas || 0), 0);
    const valorHoraEquivalente = totalHoras > 0 ? valorFixo / totalHoras : 0;

    const elValorHora = document.getElementById("resultado-mes-valor-hora");
    const elHorasTotal = document.getElementById("resultado-mes-horas-total");
    if (elValorHora) elValorHora.textContent = formatarMoeda(valorHoraEquivalente);
    if (elHorasTotal) elHorasTotal.textContent = totalHoras.toLocaleString("pt-BR") + "h";

    const corpo = document.getElementById("tabela-demandas-mes-corpo");
    if (!corpo) return;
    corpo.innerHTML = demandas
      .map((d) => {
        const percentual = totalHoras > 0 ? (d.horas / totalHoras) * 100 : 0;
        const valorEquivalente = d.horas * valorHoraEquivalente;
        return `
          <tr>
            <td>${d.descricao}</td>
            <td>${Number(d.horas).toLocaleString("pt-BR")}h</td>
            <td>${percentual.toFixed(1)}%</td>
            <td>${formatarMoeda(valorEquivalente)}</td>
            <td><button class="botao perigo pequeno" data-excluir-demanda="${d.id}">Excluir</button></td>
          </tr>`;
      })
      .join("") || `<tr><td colspan="5" style="text-align:center; color:var(--cor-texto-suave);">Nenhuma demanda lançada neste mês ainda.</td></tr>`;

    corpo.querySelectorAll("[data-excluir-demanda]").forEach((btn) =>
      btn.addEventListener("click", () => {
        atualizarEstado((estado) => {
          estado.demandasMensais = estado.demandasMensais.filter((d) => d.id !== btn.dataset.excluirDemanda);
        });
        recalcularModoMes();
      })
    );
  }

  function atualizarAvisosCalculadora() {
    const faturamentoAno = calcularFaturamentoAno();
    const limite = ESTADO.configuracoes.limiteMeiAnual;
    const percentual = limite ? (faturamentoAno / limite) * 100 : 0;
    const elMei = document.getElementById("aviso-mei-calc");
    elMei.textContent = `📌 Faturamento acumulado no ano: ${formatarMoeda(faturamentoAno)} (${percentual.toFixed(1)}% do limite MEI de ${formatarMoeda(limite)})`;

    const reserva = ESTADO.configuracoes.acaoB3.percentualReserva || 0;
    const ticker = ESTADO.configuracoes.acaoB3.ticker || "sua ação na B3";
    const elB3 = document.getElementById("aviso-b3-calc");
    elB3.textContent = `💰 Lembrete: ao receber, separe ${reserva}% desse valor para comprar ${ticker} e reforçar sua carteira de dividendos.`;
  }

  container.querySelectorAll("#abas-modo-calculo .aba").forEach((aba) => {
    aba.addEventListener("click", () => {
      container.querySelectorAll("#abas-modo-calculo .aba").forEach((a) => a.classList.remove("ativa"));
      aba.classList.add("ativa");
      const modo = aba.dataset.modo;
      document.getElementById("bloco-modo-hora").style.display = modo === "hora" ? "block" : "none";
      document.getElementById("bloco-modo-projeto").style.display = modo === "projeto" ? "block" : "none";
      document.getElementById("bloco-modo-peca").style.display = modo === "peca" ? "block" : "none";
      document.getElementById("bloco-modo-mes").style.display = modo === "mes" ? "block" : "none";
      document.getElementById("resultado-visivel-hora").style.display = modo === "hora" ? "block" : "none";
      document.getElementById("resultado-visivel-projeto").style.display = modo === "projeto" ? "block" : "none";
      document.getElementById("resultado-visivel-peca").style.display = modo === "peca" ? "block" : "none";
      document.getElementById("resultado-visivel-mes").style.display = modo === "mes" ? "block" : "none";
      if (modo === "mes") recalcularModoMes();
    });
  });

  container.querySelectorAll("input").forEach((input) => input.addEventListener("input", recalcular));

  document.getElementById("btn-add-demanda-mes").addEventListener("click", () => {
    const descricao = document.getElementById("mes-nova-descricao").value.trim();
    const horasNova = Number(document.getElementById("mes-nova-horas").value) || 0;
    if (!descricao) { alert("Descreva a demanda."); return; }
    if (horasNova <= 0) { alert("Informe quantas horas foram gastas."); return; }
    atualizarEstado((estado) => {
      estado.demandasMensais.push({
        id: gerarId(),
        descricao,
        horas: horasNova,
        data: new Date().toISOString(),
      });
    });
    document.getElementById("mes-nova-descricao").value = "";
    document.getElementById("mes-nova-horas").value = "1";
    recalcularModoMes();
  });

  document.getElementById("btn-salvar-config-calc").addEventListener("click", () => {
    atualizarEstado((estado) => {
      estado.configuracoes.salarioDesejado = Number(document.getElementById("calc-salario").value) || 0;
      estado.configuracoes.custosFixosMensais = Number(document.getElementById("calc-custos").value) || 0;
      estado.configuracoes.horasPagasPorMes = Number(document.getElementById("calc-horas").value) || 0;
      estado.configuracoes.clienteFixoMensal = Number(document.getElementById("calc-valor-fixo-mes").value) || 0;
    });
    alert("Configuração padrão salva!");
  });

  recalcular();
}

function calcularFaturamentoAno() {
  const anoAtual = new Date().getFullYear();
  return ESTADO.clientes.reduce((soma, cliente) => {
    const historico = cliente.historicoFinanceiro || [];
    const totalDoCliente = historico
      .filter((h) => new Date(h.data).getFullYear() === anoAtual)
      .reduce((s, h) => s + Number(h.valor || 0), 0);
    return soma + totalDoCliente;
  }, 0) + (ESTADO.configuracoes.clienteFixoMensal || 0) * (new Date().getMonth() + 1);
}
