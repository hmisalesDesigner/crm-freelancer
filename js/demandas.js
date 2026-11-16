/**
 * demandas.js
 * Demandas do cliente Vespor (inclui Varejocar) no painel inicial:
 * A fazer -> Em andamento -> Concluída. O histórico da planilha entra como "Concluída".
 */
const STATUS_DEMANDA = { fazer: "A fazer", andamento: "Em andamento", concluida: "Concluída" };

function renderizarDemandasPainel() {
  const alvo = document.getElementById("painel-demandas");
  if (!alvo) return;
  const lista = ESTADO.demandas || [];
  const abertas = lista.filter((d) => d.status !== "concluida");
  const fazer = lista.filter((d) => d.status === "fazer").length;
  const andamento = lista.filter((d) => d.status === "andamento").length;
  const concluidas = lista.filter((d) => d.status === "concluida");
  const limite = somarDiasISO(hojeISO(), -7);
  const semana = concluidas.filter((d) => d.data && d.data >= limite).length;
  const mes = mesAtualChave();
  const noMes = concluidas.filter((d) => d.data && chaveMes(d.data) === mes).length;
  const recentes = [...concluidas].sort((a, b) => (b.data || "").localeCompare(a.data || "") || 0).slice(0, 8);

  const contagem = new Map();
  concluidas.forEach((d) => { if (d.titulo) contagem.set(d.titulo, (contagem.get(d.titulo) || 0) + 1); });
  const sugestoes = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 150);

  const linha = (d) => `
    <li class="demanda-item">
      <span class="selo ${d.status === "andamento" ? "enviado" : "pendente"}">${STATUS_DEMANDA[d.status]}</span>
      <span class="demanda-titulo">${escaparHtml(d.titulo)}</span>
      <span class="demanda-acoes">
        ${d.status === "fazer" ? `<button class="botao secundario pequeno" data-dem="andamento" data-id="${d.id}">Iniciar</button>` : ""}
        <button class="botao sucesso pequeno" data-dem="concluida" data-id="${d.id}">Concluir</button>
        <button class="botao perigo pequeno" data-dem="excluir" data-id="${d.id}" title="Excluir">✕</button>
      </span>
    </li>`;

  alvo.innerHTML = `
    <div class="cards-resumo" style="grid-template-columns: repeat(4, 1fr);">
      <div class="card"><span class="card-label">A fazer</span><span class="card-valor">${fazer}</span></div>
      <div class="card"><span class="card-label">Em andamento</span><span class="card-valor" style="color:var(--cor-primaria)">${andamento}</span></div>
      <div class="card"><span class="card-label">Concluídas (7 dias)</span><span class="card-valor" style="color:var(--cor-sucesso)">${semana}</span><span class="card-sub">${noMes} neste mês · ${concluidas.length} no total</span></div>
      <div class="card"><span class="card-label">Novas demandas</span>
        <div style="display:flex; gap:6px; margin-top:6px;"><input id="dem-novo" placeholder="Ex: Arte promoção" style="flex:1; min-width:0;"><button class="botao pequeno" id="dem-add">+</button></div>
        <label class="card-sub" style="margin-top:6px;"><input type="checkbox" id="dem-ja-andamento"> já começar em andamento</label>
      </div>
    </div>

    <div class="bloco-destaque" style="margin:16px 0;">
      <h3>📋 Repetir uma atividade já feita</h3>
      <p class="card-sub" style="margin:0 0 8px;">Escolha entre as que você já fez, para adicionar de novo como "A fazer".</p>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <input list="dem-sugestoes" id="dem-repetir" placeholder="Digite para buscar na lista do que já fez..." style="flex:1; min-width:220px;">
        <datalist id="dem-sugestoes">${sugestoes.map(([t]) => `<option value="${escaparHtml(t)}">`).join("")}</datalist>
        <button class="botao secundario pequeno" id="dem-repetir-add">+ Adicionar como A fazer</button>
      </div>
    </div>
    <h4 style="margin:12px 0 6px;">Em aberto (${abertas.length})</h4>
    <ul class="demanda-lista">${abertas.length ? abertas.map(linha).join("") : `<li class="demanda-item" style="color:var(--cor-texto-suave)">Nada em aberto. Adicione uma nova demanda acima.</li>`}</ul>
    <h4 style="margin:12px 0 6px;">Concluídas recentemente</h4>
    <ul class="demanda-lista">${recentes.map((d) => `<li class="demanda-item"><span class="selo aceito">Concluída</span><span class="demanda-titulo">${escaparHtml(d.titulo)}</span><span class="card-sub">${d.data ? formatarDataBR(d.data) : ""}</span></li>`).join("") || `<li class="demanda-item" style="color:var(--cor-texto-suave)">Nenhuma ainda.</li>`}</ul>`;

  const adicionar = (texto, status) => {
    const t = (texto ?? document.getElementById("dem-novo").value).trim();
    if (!t) return;
    const andando = status || (document.getElementById("dem-ja-andamento").checked ? "andamento" : "fazer");
    atualizarEstado((e) => { e.demandas.push({ id: gerarId(), cliente: "Vespor", titulo: t, data: hojeISO(), status: andando }); });
    renderizarDemandasPainel();
  };
  document.getElementById("dem-add").addEventListener("click", () => adicionar());
  document.getElementById("dem-novo").addEventListener("keydown", (ev) => { if (ev.key === "Enter") adicionar(); });
  document.getElementById("dem-repetir-add").addEventListener("click", () => {
    const t = document.getElementById("dem-repetir").value.trim();
    if (!t) return;
    adicionar(t, "fazer");
  });
  document.getElementById("dem-repetir").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); document.getElementById("dem-repetir-add").click(); } });
  alvo.querySelectorAll("[data-dem]").forEach((b) => b.addEventListener("click", () => {
    const acao = b.dataset.dem, id = b.dataset.id;
    atualizarEstado((e) => {
      if (acao === "excluir") { e.demandas = e.demandas.filter((x) => x.id !== id); return; }
      const d = e.demandas.find((x) => x.id === id);
      if (!d) return;
      d.status = acao;
      if (acao === "concluida") d.data = hojeISO();
    });
    renderizarDemandasPainel();
  }));
}
