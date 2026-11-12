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

    atualizarAvisosCalculadora();
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
      document.getElementById("resultado-visivel-hora").style.display = modo === "hora" ? "block" : "none";
      document.getElementById("resultado-visivel-projeto").style.display = modo === "projeto" ? "block" : "none";
      document.getElementById("resultado-visivel-peca").style.display = modo === "peca" ? "block" : "none";
    });
  });

  container.querySelectorAll("input").forEach((input) => input.addEventListener("input", recalcular));

  document.getElementById("btn-salvar-config-calc").addEventListener("click", () => {
    atualizarEstado((estado) => {
      estado.configuracoes.salarioDesejado = Number(document.getElementById("calc-salario").value) || 0;
      estado.configuracoes.custosFixosMensais = Number(document.getElementById("calc-custos").value) || 0;
      estado.configuracoes.horasPagasPorMes = Number(document.getElementById("calc-horas").value) || 0;
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
