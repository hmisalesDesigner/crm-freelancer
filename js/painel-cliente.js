/**
 * painel-cliente.js
 * Painel individual de cada cliente: demandas, horas trabalhadas, faturamento,
 * avaliações do Google (quando houver) e anotações — tudo filtrado para aquele cliente.
 * Aberto clicando no nome do cliente na tela "Clientes".
 */

function abrirPainelCliente(id) {
  const cliente = ESTADO.clientes.find((c) => c.id === id);
  if (!cliente) return;
  document.querySelectorAll(".pagina").forEach((p) => p.classList.remove("ativa"));
  document.getElementById("pagina-cliente-detalhe").classList.add("ativa");
  document.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("ativo"));
  document.getElementById("titulo-pagina").textContent = cliente.nome;
  renderizarPainelCliente(id);
}

function renderizarPainelCliente(id) {
  const container = document.getElementById("pagina-cliente-detalhe");
  const cliente = ESTADO.clientes.find((c) => c.id === id);
  if (!cliente) { irParaPagina("clientes"); return; }

  const demandas = demandasDoCliente(cliente);
  const abertas = demandas.filter((d) => d.status !== "concluida");
  const concluidas = demandas.filter((d) => d.status === "concluida").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const avaliacoes = avaliacoesDoCliente(cliente);
  const totaisAval = totaisAvaliacoesGoogle(avaliacoes);
  const ano = new Date().getFullYear();
  const totalFaturadoAno = faturamentoPorMesCliente(ano, cliente).reduce((a, b) => a + b, 0);
  const aReceber = (ESTADO.pagamentos || []).filter((p) => p.clienteId === cliente.id && !p.pago).reduce((s, p) => s + Number(p.valor || 0), 0);
  const horasMes = (horasDoCliente(cliente, mesAtualChave()) / 3600);
  const ehFixo = ESTADO.configuracoes.clienteFixoId === cliente.id;

  const linhaDemanda = (d) => `
    <li class="demanda-item">
      <span class="selo ${d.status === "andamento" ? "enviado" : "pendente"}">${STATUS_DEMANDA[d.status]}</span>
      <span class="demanda-titulo">${escaparHtml(d.titulo)}</span>${seloCategoria(d.categoria)}
      <span class="demanda-acoes">
        ${d.status === "fazer" ? `<button class="botao secundario pequeno" data-pcdem="andamento" data-id="${d.id}">Iniciar</button>` : ""}
        <button class="botao sucesso pequeno" data-pcdem="concluida" data-id="${d.id}">Concluir</button>
        <button class="botao perigo pequeno" data-pcdem="excluir" data-id="${d.id}" title="Excluir">✕</button>
      </span>
    </li>`;

  container.innerHTML = `
    <button class="botao secundario pequeno" id="pc-voltar" style="margin-bottom:14px;">← Voltar para Clientes</button>

    <div class="cards-resumo" style="grid-template-columns: repeat(4, 1fr); margin-bottom:16px;">
      <div class="card"><span class="card-label">Faturado em ${ano}</span><span class="card-valor">${formatarMoeda(totalFaturadoAno)}</span></div>
      <div class="card"><span class="card-label">A receber</span><span class="card-valor">${formatarMoeda(aReceber)}</span></div>
      <div class="card"><span class="card-label">Demandas abertas</span><span class="card-valor">${abertas.length}</span><span class="card-sub">${concluidas.length} concluídas no total</span></div>
      <div class="card"><span class="card-label">Horas este mês</span><span class="card-valor">${horasMes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</span>
        <label class="card-sub" style="margin-top:6px; display:block;"><input type="checkbox" id="pc-fixo" ${ehFixo ? "checked" : ""}> é o cliente fixo mensal</label>
      </div>
    </div>

    <div class="painel-grafico-funil" style="margin-bottom:16px;">
      <h3>💰 Faturamento</h3>
      <div id="pc-grafico-faturamento"></div>
    </div>

    <div class="painel-grafico-funil" style="margin-bottom:16px;">
      <h3>📌 Demandas</h3>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <input id="pc-dem-novo" placeholder="Nova demanda deste cliente" style="flex:1; min-width:0;">
        <button class="botao pequeno" id="pc-dem-add">+</button>
      </div>
      <h4 style="margin:10px 0 6px;">Em aberto (${abertas.length})</h4>
      <ul class="demanda-lista">${abertas.length ? abertas.map(linhaDemanda).join("") : `<li class="demanda-item" style="color:var(--cor-texto-suave)">Nada em aberto.</li>`}</ul>
      <h4 style="margin:10px 0 6px;">Concluídas recentemente</h4>
      <ul class="demanda-lista">${concluidas.slice(0, 8).map((d) => `<li class="demanda-item"><span class="selo aceito">Concluída</span><span class="demanda-titulo">${escaparHtml(d.titulo)}</span>${seloCategoria(d.categoria)}<span class="card-sub">${d.data ? formatarDataBR(d.data) : ""}</span></li>`).join("") || `<li class="demanda-item" style="color:var(--cor-texto-suave)">Nenhuma ainda.</li>`}</ul>
    </div>

    <div class="painel-grafico-funil" style="margin-bottom:16px;">
      <h3>⭐ Avaliações Google</h3>
      <div class="cards-resumo" style="grid-template-columns: repeat(3, 1fr); margin-bottom:10px;">
        <div class="card"><span class="card-label">Positivas</span><span class="card-valor" style="color:var(--cor-sucesso)">${totaisAval.positivas}</span></div>
        <div class="card"><span class="card-label">Negativas</span><span class="card-valor" style="color:var(--cor-perigo)">${totaisAval.negativas}</span></div>
        <div class="card"><span class="card-label">Registrar hoje</span>
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            <input type="date" id="pc-av-data" value="${hojeISO()}" style="flex:1; min-width:110px;">
            <input type="number" id="pc-av-positivas" placeholder="Positivas" min="0" style="width:85px;">
            <input type="number" id="pc-av-negativas" placeholder="Negativas" min="0" style="width:85px;">
            <button class="botao pequeno" id="pc-av-add">+</button>
          </div>
        </div>
      </div>
      ${totaisAval.total > 0 ? `<div id="pc-grafico-avaliacoes"></div>` : `<p class="card-sub">Nenhuma avaliação registrada para este cliente ainda.</p>`}
    </div>

    <div class="painel-grafico-funil">
      <h3>📝 Anotações</h3>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <input id="pc-nota-texto" placeholder="Ex: pediu mais 2 reels; prefere falar à tarde" style="flex:1; min-width:0;">
        <button class="botao secundario pequeno" id="pc-nota-add">+ Anotar</button>
      </div>
      <div id="pc-notas" class="lista-notas"></div>
    </div>
  `;

  if (totaisAval.total > 0) renderizarGraficoAvaliacoes("pc-grafico-avaliacoes", avaliacoes);
  renderizarGraficoFaturamentoCliente("pc-grafico-faturamento", cliente);

  function desenharNotas() {
    const alvo = document.getElementById("pc-notas");
    const notas = cliente.notas || [];
    alvo.innerHTML = [...notas].sort((a, b) => b.data.localeCompare(a.data)).map((n) => `
      <div class="nota-item">
        <span class="nota-data">${new Date(n.data).toLocaleDateString("pt-BR")}</span>
        <span class="nota-texto">${escaparHtml(n.texto)}</span>
        <button class="botao perigo pequeno" type="button" data-pc-del-nota="${n.id}" aria-label="Apagar anotação">✕</button>
      </div>`).join("") || `<span class="card-sub">Nenhuma anotação ainda.</span>`;
    alvo.querySelectorAll("[data-pc-del-nota]").forEach((b) => b.addEventListener("click", () => {
      atualizarEstado((e) => {
        const c = e.clientes.find((x) => x.id === cliente.id);
        c.notas = (c.notas || []).filter((n) => n.id !== b.dataset.pcDelNota);
      });
      renderizarPainelCliente(id);
    }));
  }
  desenharNotas();

  document.getElementById("pc-voltar").addEventListener("click", () => irParaPagina("clientes"));

  document.getElementById("pc-fixo").addEventListener("change", (ev) => {
    atualizarEstado((e) => { e.configuracoes.clienteFixoId = ev.target.checked ? cliente.id : null; });
    renderizarPainelCliente(id);
  });

  document.getElementById("pc-dem-add").addEventListener("click", () => {
    const t = document.getElementById("pc-dem-novo").value.trim();
    if (!t) return;
    atualizarEstado((e) => { e.demandas.push({ id: gerarId(), cliente: cliente.nome, clienteId: cliente.id, titulo: t, data: hojeISO(), status: "fazer" }); });
    renderizarPainelCliente(id);
  });
  document.getElementById("pc-dem-novo").addEventListener("keydown", (ev) => { if (ev.key === "Enter") document.getElementById("pc-dem-add").click(); });

  container.querySelectorAll("[data-pcdem]").forEach((b) => b.addEventListener("click", () => {
    const acao = b.dataset.pcdem, demId = b.dataset.id;
    atualizarEstado((e) => {
      if (acao === "excluir") { e.demandas = e.demandas.filter((x) => x.id !== demId); return; }
      const d = e.demandas.find((x) => x.id === demId);
      if (!d) return;
      d.status = acao;
      if (acao === "concluida") d.data = hojeISO();
    });
    renderizarPainelCliente(id);
  }));

  document.getElementById("pc-av-add").addEventListener("click", () => {
    const data = document.getElementById("pc-av-data").value || hojeISO();
    const pos = Math.max(parseInt(document.getElementById("pc-av-positivas").value, 10) || 0, 0);
    const neg = Math.max(parseInt(document.getElementById("pc-av-negativas").value, 10) || 0, 0);
    if (pos <= 0 && neg <= 0) { alert("Informe ao menos uma quantidade."); return; }
    atualizarEstado((e) => {
      if (pos > 0) e.avaliacoesGoogle.push({ id: gerarId(), data, tipo: "positiva", quantidade: pos, cliente: cliente.nome });
      if (neg > 0) e.avaliacoesGoogle.push({ id: gerarId(), data, tipo: "negativa", quantidade: neg, cliente: cliente.nome });
    });
    renderizarPainelCliente(id);
  });

  function adicionarNota() {
    const campo = document.getElementById("pc-nota-texto");
    const texto = campo.value.trim();
    if (!texto) return;
    atualizarEstado((e) => {
      const c = e.clientes.find((x) => x.id === cliente.id);
      c.notas = c.notas || [];
      c.notas.push({ id: gerarId(), data: new Date().toISOString(), texto });
    });
    renderizarPainelCliente(id);
  }
  document.getElementById("pc-nota-add").addEventListener("click", adicionarNota);
  document.getElementById("pc-nota-texto").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); adicionarNota(); } });
}
