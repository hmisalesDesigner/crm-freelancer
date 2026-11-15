/**
 * despesas.js
 * Soma e análise das despesas do trabalho freelancer.
 *  - "Mensal": assinaturas, internet, energia, DAS do MEI etc. (valor por mês).
 *  - "Equipamento": compra única, diluída pela vida útil (valor ÷ meses), como reserva de reposição.
 * O total mensal mostra quanto custa trabalhar e pode virar o "custo fixo" da calculadora de preço.
 */

const CATEGORIAS_DESPESA = ["Equipamento", "Software e assinaturas", "Internet e energia", "Impostos (DAS do MEI)", "Marketing", "Outros"];

function custoMensalDespesa(d) {
  const v = Number(d.valor) || 0;
  if (d.emReserva) return 0; // peça guardada, sem uso: conta no investido, mas não no custo mensal
  if (d.tipo === "equipamento") return v / Math.max(Number(d.vidaUtilMeses) || 60, 1);
  return v;
}

function totaisDespesas() {
  const porCategoria = {};
  let mensal = 0, investido = 0;
  ESTADO.despesas.forEach((d) => {
    const m = custoMensalDespesa(d);
    mensal += m;
    if (d.tipo === "equipamento") investido += Number(d.valor) || 0;
    porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + m;
  });
  return { mensal, investido, porCategoria };
}

function idadeEmMeses(dataISO) {
  if (!dataISO) return null;
  const [a, m] = dataISO.split("-").map(Number);
  const hoje = new Date();
  return (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
}

function renderizarPaginaDespesas() {
  const container = document.getElementById("pagina-despesas");
  const cfg = ESTADO.configuracoes;
  let editandoId = null;
  const $ = (id) => document.getElementById(id);

  container.innerHTML = `
    <div class="cards-resumo" id="desp-cards"></div>
    <div id="desp-analise" class="previa-score" style="max-width:900px; margin-top:16px; line-height:1.6;"></div>

    <h3 style="margin-top:28px;">Adicionar despesa</h3>
    <div class="form-grid" style="max-width:900px;">
      <div class="campo"><label>Descrição</label><input id="desp-descricao" placeholder="Ex: Assinatura Adobe, internet, processador"></div>
      <div class="campo"><label>Categoria</label><select id="desp-categoria">${CATEGORIAS_DESPESA.map((c) => `<option>${c}</option>`).join("")}</select></div>
      <div class="campo"><label>Tipo</label><select id="desp-tipo"><option value="mensal">Mensal (todo mês)</option><option value="equipamento">Equipamento (compra única)</option></select></div>
      <div class="campo"><label id="desp-rotulo-valor">Valor por mês (R$)</label><input type="number" id="desp-valor" min="0" step="0.01"></div>
      <div class="campo" id="desp-box-data" style="display:none;"><label>Data da compra</label><input type="date" id="desp-data"></div>
      <div class="campo" id="desp-box-vida" style="display:none;"><label>Vida útil (meses)</label><input type="number" id="desp-vida" value="60" min="1"></div>
      <div class="campo" id="desp-box-reserva" style="display:none;"><label>Em uso?</label><label style="font-weight:normal;"><input type="checkbox" id="desp-reserva"> Reserva (guardado, não uso hoje)</label></div>
    </div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button class="botao" id="btn-salvar-despesa">Adicionar</button>
      <button class="botao secundario" id="btn-cancelar-despesa" style="display:none;">Cancelar edição</button>
    </div>

    <h3 style="margin-top:32px;">Despesas cadastradas</h3>
    <div style="overflow-x:auto;">
      <table class="tabela"><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Vida útil</th><th>Custo mensal</th><th></th></tr></thead>
      <tbody id="desp-corpo"></tbody></table>
    </div>
    <div style="margin-top:20px; max-width:900px;">
      <button class="botao" id="btn-usar-despesas">Usar o total como custo fixo da calculadora</button>
      <p class="card-sub" style="margin-top:8px;">Hoje a calculadora usa <b id="desp-custo-atual"></b> de custos fixos por mês.</p>
    </div>`;

  function alternarTipo() {
    const eq = $("desp-tipo").value === "equipamento";
    $("desp-box-data").style.display = eq ? "" : "none";
    $("desp-box-vida").style.display = eq ? "" : "none";
    $("desp-box-reserva").style.display = eq ? "" : "none";
    $("desp-rotulo-valor").textContent = eq ? "Valor pago (R$)" : "Valor por mês (R$)";
    if (eq) $("desp-categoria").value = "Equipamento";
  }
  $("desp-tipo").addEventListener("change", alternarTipo);

  function resumo() {
    const t = totaisDespesas();
    const horas = Number(cfg.horasPagasPorMes) || 0;
    const salario = Number(cfg.salarioDesejado) || 0;
    const minimoMes = salario + t.mensal;
    const fatMes = (typeof faturamentoPorMes === "function" ? faturamentoPorMes(new Date().getFullYear())[new Date().getMonth()] : 0) || 0;
    $("desp-cards").innerHTML = `
      <div class="card"><span class="card-label">Despesas por mês</span><span class="card-valor">${formatarMoeda(t.mensal)}</span><span class="card-sub">soma de tudo, com equipamentos diluídos</span></div>
      <div class="card"><span class="card-label">Custo por hora trabalhada</span><span class="card-valor">${formatarMoeda(horas ? t.mensal / horas : 0)}</span><span class="card-sub">sobre ${horas} h pagas/mês</span></div>
      <div class="card"><span class="card-label">Investido em equipamentos</span><span class="card-valor">${formatarMoeda(t.investido)}</span><span class="card-sub">valor das compras</span></div>
      <div class="card"><span class="card-label">Faturamento mínimo/mês</span><span class="card-valor">${formatarMoeda(minimoMes)}</span><span class="card-sub">salário desejado + despesas</span></div>`;
    const cats = Object.entries(t.porCategoria).sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `${escaparHtml(c)}: <b>${formatarMoeda(v)}</b> (${t.mensal ? Math.round((v / t.mensal) * 100) : 0}%)`).join(" · ");
    const falta = minimoMes - fatMes;
    $("desp-analise").innerHTML = `
      <b>Análise</b><br>
      ${cats || "Nenhuma despesa cadastrada."}<br>
      Para fechar o mês você precisa faturar <b>${formatarMoeda(minimoMes)}</b>. Neste mês já entrou <b>${formatarMoeda(fatMes)}</b> —
      ${falta > 0 ? `faltam <b>${formatarMoeda(falta)}</b>.` : `meta de cobertura batida ✅ (sobra ${formatarMoeda(-falta)}).`}<br>
      Cada hora de trabalho precisa render pelo menos <b>${formatarMoeda(horas ? minimoMes / horas : 0)}</b> para cobrir salário e despesas.`;
    $("desp-custo-atual").textContent = formatarMoeda(cfg.custosFixosMensais) + " (despesas cadastradas somam " + formatarMoeda(t.mensal) + ")";
  }

  function tabela() {
    $("desp-corpo").innerHTML = ESTADO.despesas.map((d) => {
      const idade = d.tipo === "equipamento" ? idadeEmMeses(d.dataCompra) : null;
      const velho = !d.emReserva && idade !== null && d.vidaUtilMeses && idade > d.vidaUtilMeses;
      return `<tr>
        <td>${escaparHtml(d.descricao)}${d.emReserva ? ' <span class="selo">Reserva · fora do custo mensal</span>' : ""}${d.dataCompra ? `<br><span class="card-sub">comprado em ${formatarDataBR(d.dataCompra)}${idade !== null ? ` (${Math.floor(idade / 12)} anos${velho ? " · passou da vida útil: pense em trocar" : ""})` : ""}</span>` : ""}</td>
        <td>${escaparHtml(d.categoria)}</td>
        <td>${formatarMoeda(d.valor)}${d.tipo === "mensal" ? "/mês" : ""}</td>
        <td>${d.tipo === "equipamento" ? d.vidaUtilMeses + " meses" : "-"}</td>
        <td><b>${formatarMoeda(custoMensalDespesa(d))}</b></td>
        <td style="white-space:nowrap;"><button class="botao secundario pequeno" data-editar-desp="${d.id}">Editar</button>
          <button class="botao perigo pequeno" data-excluir-desp="${d.id}" aria-label="Excluir">✕</button></td></tr>`;
    }).join("") || `<tr><td colspan="6" style="text-align:center; color:var(--cor-texto-suave);">Nenhuma despesa cadastrada.</td></tr>`;
    $("desp-corpo").querySelectorAll("[data-excluir-desp]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Excluir esta despesa?")) return;
      atualizarEstado((e) => { e.despesas = e.despesas.filter((x) => x.id !== b.dataset.excluirDesp); });
      tabela(); resumo();
    }));
    $("desp-corpo").querySelectorAll("[data-editar-desp]").forEach((b) => b.addEventListener("click", () => {
      const d = ESTADO.despesas.find((x) => x.id === b.dataset.editarDesp);
      editandoId = d.id;
      $("desp-descricao").value = d.descricao; $("desp-categoria").value = d.categoria; $("desp-tipo").value = d.tipo;
      $("desp-valor").value = d.valor; $("desp-data").value = d.dataCompra || ""; $("desp-vida").value = d.vidaUtilMeses || 60; $("desp-reserva").checked = !!d.emReserva;
      alternarTipo(); $("desp-categoria").value = d.categoria;
      $("btn-salvar-despesa").textContent = "Salvar alterações"; $("btn-cancelar-despesa").style.display = "";
      $("desp-descricao").scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  function limpar() {
    editandoId = null;
    ["desp-descricao", "desp-valor", "desp-data"].forEach((id) => { $(id).value = ""; });
    $("desp-tipo").value = "mensal"; $("desp-categoria").value = CATEGORIAS_DESPESA[1]; $("desp-vida").value = 60; $("desp-reserva").checked = false;
    alternarTipo();
    $("btn-salvar-despesa").textContent = "Adicionar"; $("btn-cancelar-despesa").style.display = "none";
  }
  $("btn-cancelar-despesa").addEventListener("click", limpar);

  $("btn-salvar-despesa").addEventListener("click", () => {
    const descricao = $("desp-descricao").value.trim();
    const valor = Number($("desp-valor").value) || 0;
    if (!descricao || valor <= 0) { alert("Informe a descrição e um valor maior que zero."); return; }
    const tipo = $("desp-tipo").value;
    const item = { descricao, categoria: $("desp-categoria").value, tipo, valor,
      dataCompra: tipo === "equipamento" ? $("desp-data").value : "", vidaUtilMeses: tipo === "equipamento" ? Math.max(parseInt($("desp-vida").value, 10) || 60, 1) : 0,
      emReserva: tipo === "equipamento" && $("desp-reserva").checked };
    atualizarEstado((e) => {
      if (editandoId) Object.assign(e.despesas.find((x) => x.id === editandoId), item);
      else e.despesas.push({ id: gerarId(), ...item });
    });
    limpar(); tabela(); resumo();
  });

  $("btn-usar-despesas").addEventListener("click", () => {
    const total = Math.round(totaisDespesas().mensal * 100) / 100;
    if (!confirm(`Definir ${formatarMoeda(total)} como custos fixos mensais da calculadora?`)) return;
    atualizarEstado((e) => { e.configuracoes.custosFixosMensais = total; });
    resumo();
  });

  alternarTipo(); tabela(); resumo();
}
