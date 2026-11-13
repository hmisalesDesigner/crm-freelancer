/**
 * tempo.js
 * Relógio de tarefas: liga ao começar uma tarefa, desliga ao parar e pergunta em que
 * ponto ela está (começo, metade ou finalizada). Soma o tempo por tarefa, alimenta o modo
 * "Por Mês" da calculadora e calcula o valor/hora real de cada projeto.
 */

const ROTULOS_PROGRESSO = { comeco: "No começo", metade: "Na metade", finalizada: "Finalizada" };

function tarefaPorId(id) {
  return ESTADO.tarefas.find((t) => t.id === id);
}

function segundosAtivoAgora() {
  const a = ESTADO.cronometroAtivo;
  return a ? Math.max(0, Math.floor((Date.now() - new Date(a.inicio).getTime()) / 1000)) : 0;
}

/** Segundos de uma tarefa (opcionalmente só de um mês AAAA-MM), incluindo o relógio em andamento. */
function segundosTarefa(tarefaId, mes) {
  let total = ESTADO.sessoesTempo
    .filter((s) => s.tarefaId === tarefaId && (!mes || chaveMes(s.inicio) === mes))
    .reduce((soma, s) => soma + Number(s.segundos || 0), 0);
  const a = ESTADO.cronometroAtivo;
  if (a && a.tarefaId === tarefaId && (!mes || chaveMes(a.inicio) === mes)) total += segundosAtivoAgora();
  return total;
}

function rotuloVinculo(t) {
  if (t.fixo) return "Cliente fixo";
  if (t.orcamentoId) {
    const o = ESTADO.orcamentos.find((x) => x.id === t.orcamentoId);
    return o ? "Orçamento: " + (o.descricao || formatarMoeda(o.valor)) : "Orçamento";
  }
  if (t.clienteId) {
    const c = ESTADO.clientes.find((x) => x.id === t.clienteId);
    if (c) return c.nome;
  }
  return "Avulsa";
}

function valorMinimoHora() {
  const c = ESTADO.configuracoes;
  return calcularValorHora(c.salarioDesejado, c.custosFixosMensais, c.horasPagasPorMes);
}

/* ---------- Relógio ---------- */

function iniciarCronometro(tarefaId) {
  if (ESTADO.cronometroAtivo) {
    alert("Já existe um relógio rodando. Pare-o antes de iniciar outro.");
    return;
  }
  atualizarEstado((e) => { e.cronometroAtivo = { tarefaId, inicio: new Date().toISOString() }; });
  atualizarTickCronometro();
  renderizarPaginaTempo();
}

async function pararCronometro() {
  const a = ESTADO.cronometroAtivo;
  if (!a) return;
  const tarefa = tarefaPorId(a.tarefaId);
  const fim = new Date().toISOString(); // o tempo conta até o clique em "parar"
  const segundos = Math.max(1, Math.floor((new Date(fim) - new Date(a.inicio)) / 1000));

  const progresso = await perguntarProgresso(tarefa, segundos);
  if (!progresso) return; // cancelou: o relógio continua rodando

  atualizarEstado((e) => {
    e.sessoesTempo.push({ id: gerarId(), tarefaId: a.tarefaId, inicio: a.inicio, fim, segundos });
    const t = e.tarefas.find((x) => x.id === a.tarefaId);
    if (t) { t.progresso = progresso; t.finalizadaEm = progresso === "finalizada" ? fim : null; }
    e.cronometroAtivo = null;
  });
  atualizarTickCronometro();
  renderizarPaginaTempo();
  atualizarPainel();
}

/** Mostra a janela "em que ponto está a tarefa?". Retorna "comeco" | "metade" | "finalizada" | null (cancelou). */
function perguntarProgresso(tarefa, segundos) {
  return new Promise((resolve) => {
    const fundo = document.createElement("div");
    fundo.className = "modal-sobreposicao";
    fundo.innerHTML = `
      <div class="modal-caixa" role="dialog" aria-modal="true">
        <h3>Parar o relógio</h3>
        <p class="modal-sub"><b>${escaparHtml(tarefa ? tarefa.descricao : "Tarefa")}</b><br>Tempo desta sessão: <b>${formatarDuracao(segundos)}</b></p>
        <p class="modal-sub">Em que ponto a tarefa está?</p>
        <div class="modal-opcoes">
          <button class="botao secundario" data-op="comeco">🌱 Só no começo</button>
          <button class="botao secundario" data-op="metade">🌓 Na metade</button>
          <button class="botao sucesso" data-op="finalizada">✅ Finalizada</button>
        </div>
        <button class="botao secundario pequeno" data-op="" style="margin-top:12px;">Cancelar (continuar contando)</button>
      </div>`;
    document.body.appendChild(fundo);

    function fechar(valor) {
      document.removeEventListener("keydown", aoTecla);
      fundo.remove();
      resolve(valor || null);
    }
    function aoTecla(ev) { if (ev.key === "Escape") fechar(null); }
    document.addEventListener("keydown", aoTecla);
    fundo.querySelectorAll("[data-op]").forEach((b) => b.addEventListener("click", () => fechar(b.dataset.op)));
  });
}

function atualizarTickCronometro() {
  const a = ESTADO.cronometroAtivo;
  const global = document.getElementById("cronometro-global");
  const relogio = document.getElementById("tempo-relogio");
  if (a) {
    const t = tarefaPorId(a.tarefaId);
    const dur = formatarDuracao(segundosAtivoAgora());
    if (global) {
      global.style.display = "inline-flex";
      global.innerHTML = `<span class="ponto-gravando"></span><span>${dur}</span><span class="cronometro-global-nome">${escaparHtml(t ? t.descricao : "Tarefa")}</span>`;
    }
    if (relogio) relogio.textContent = dur;
    document.title = `⏱ ${dur} · CRM Freelancer`;
  } else {
    if (global) global.style.display = "none";
    document.title = "CRM Freelancer";
  }
}

function iniciarTickCronometro() {
  const global = document.getElementById("cronometro-global");
  if (global) global.addEventListener("click", () => irParaPagina("tempo"));
  atualizarTickCronometro();
  setInterval(atualizarTickCronometro, 1000);
}

/* ---------- Página ---------- */

function renderizarPaginaTempo() {
  const container = document.getElementById("pagina-tempo");
  const ativo = ESTADO.cronometroAtivo;
  const tarefaAtiva = ativo ? tarefaPorId(ativo.tarefaId) : null;
  let filtro = container.dataset.filtro || "abertas";

  const tarefasAbertas = ESTADO.tarefas.filter((t) => t.progresso !== "finalizada");
  const orcamentosVinculaveis = ESTADO.orcamentos.filter((o) => !o.recusado);

  const blocoRelogio = ativo
    ? `
      <div class="relogio-painel rodando">
        <span class="card-label">Tarefa em andamento</span>
        <div class="relogio-tarefa">${escaparHtml(tarefaAtiva ? tarefaAtiva.descricao : "Tarefa")}
          <span class="selo ${tarefaAtiva ? tarefaAtiva.progresso : "comeco"}">${ROTULOS_PROGRESSO[tarefaAtiva ? tarefaAtiva.progresso : "comeco"]}</span>
        </div>
        <div class="relogio-grande" id="tempo-relogio">${formatarDuracao(segundosAtivoAgora())}</div>
        <button class="botao perigo relogio-botao" id="btn-parar-relogio">■ Parar e registrar</button>
      </div>`
    : `
      <div class="relogio-painel">
        <span class="card-label">Relógio parado</span>
        <div class="relogio-grande" style="opacity:.35">00:00:00</div>
        <div class="form-grid" style="max-width:640px; margin: 0 auto;">
          <div class="campo" style="grid-column: 1 / -1;">
            <label>Tarefa</label>
            <select id="tp-tarefa">
              <option value="__nova__">➕ Nova tarefa…</option>
              ${tarefasAbertas.map((t) => `<option value="${t.id}">${escaparHtml(t.descricao)} — ${ROTULOS_PROGRESSO[t.progresso]} (${formatarDuracaoCurta(segundosTarefa(t.id))})</option>`).join("")}
            </select>
          </div>
          <div id="tp-nova" style="display:contents;">
            <div class="campo"><label>O que você vai fazer?</label><input id="tp-descricao" placeholder="Ex: Edição de reels da semana"></div>
            <div class="campo">
              <label>Vincular a</label>
              <select id="tp-vinculo">
                <option value="avulsa">Avulsa (sem vínculo)</option>
                <option value="fixo">Cliente fixo (mensal)</option>
                ${orcamentosVinculaveis.map((o) => {
                  const c = ESTADO.clientes.find((x) => x.id === o.clienteId);
                  return `<option value="orc:${o.id}">Orçamento: ${escaparHtml(o.descricao || formatarMoeda(o.valor))}${c ? " — " + escaparHtml(c.nome) : ""}</option>`;
                }).join("")}
              </select>
            </div>
            <div class="campo" id="tp-cliente-campo">
              <label>Cliente (opcional)</label>
              <select id="tp-cliente">
                <option value="">—</option>
                ${ESTADO.clientes.map((c) => `<option value="${c.id}">${escaparHtml(c.nome)}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
        <button class="botao relogio-botao" id="btn-iniciar-relogio">▶ Iniciar</button>
      </div>`;

  container.innerHTML = `
    ${blocoRelogio}

    <div class="bloco-destaque" style="margin-top:24px;">
      <h3>Tarefas</h3>
      <div class="filtros" id="tp-filtros" style="margin-bottom:10px;">
        <button class="chip" data-filtro="abertas">Em aberto</button>
        <button class="chip" data-filtro="finalizadas">Finalizadas</button>
        <button class="chip" data-filtro="todas">Todas</button>
      </div>
      <table class="tabela">
        <thead><tr><th>Tarefa</th><th>Vínculo</th><th>Status</th><th>Tempo total</th><th>Sessões</th><th></th></tr></thead>
        <tbody id="tp-corpo"></tbody>
      </table>
    </div>

    <div class="bloco-destaque">
      <h3>💰 Valor/hora real</h3>
      <p class="card-sub" style="margin:0 0 10px;">Quanto você realmente ganhou por hora, comparado ao seu mínimo de <b id="tp-minimo"></b>.</p>
      <table class="tabela">
        <thead><tr><th>Projeto</th><th>Valor</th><th>Horas</th><th>R$/hora real</th><th>Situação</th></tr></thead>
        <tbody id="tp-rentab"></tbody>
      </table>
    </div>
  `;

  /* --- tabela de tarefas --- */
  container.querySelectorAll("#tp-filtros .chip").forEach((chip) => {
    chip.classList.toggle("ativo", chip.dataset.filtro === filtro);
    chip.addEventListener("click", () => { container.dataset.filtro = chip.dataset.filtro; renderizarPaginaTempo(); });
  });

  const lista = ESTADO.tarefas
    .filter((t) => filtro === "todas" || (filtro === "abertas" ? t.progresso !== "finalizada" : t.progresso === "finalizada"))
    .sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)));

  document.getElementById("tp-corpo").innerHTML = lista.map((t) => {
    const rodando = ativo && ativo.tarefaId === t.id;
    const sessoes = ESTADO.sessoesTempo.filter((s) => s.tarefaId === t.id).length;
    return `
      <tr>
        <td><b>${escaparHtml(t.descricao)}</b>${rodando ? ' <span class="selo atrasado">● gravando</span>' : ""}</td>
        <td>${escaparHtml(rotuloVinculo(t))}</td>
        <td>
          <select data-progresso="${t.id}" class="select-mini">
            ${Object.entries(ROTULOS_PROGRESSO).map(([k, v]) => `<option value="${k}" ${t.progresso === k ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </td>
        <td>${formatarDuracao(segundosTarefa(t.id))}</td>
        <td>${sessoes}</td>
        <td style="white-space:nowrap;">
          ${t.progresso !== "finalizada" && !ativo ? `<button class="botao pequeno" data-retomar="${t.id}">▶ Retomar</button>` : ""}
          ${rodando ? "" : `<button class="botao perigo pequeno" data-excluir="${t.id}">Excluir</button>`}
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="6" style="text-align:center; color:var(--cor-texto-suave);">Nenhuma tarefa nesta visão.</td></tr>`;

  container.querySelectorAll("[data-retomar]").forEach((b) => b.addEventListener("click", () => iniciarCronometro(b.dataset.retomar)));
  container.querySelectorAll("[data-progresso]").forEach((sel) => sel.addEventListener("change", () => {
    atualizarEstado((e) => {
      const t = e.tarefas.find((x) => x.id === sel.dataset.progresso);
      t.progresso = sel.value;
      t.finalizadaEm = sel.value === "finalizada" ? new Date().toISOString() : null;
    });
    renderizarPaginaTempo(); atualizarPainel();
  }));
  container.querySelectorAll("[data-excluir]").forEach((b) => b.addEventListener("click", () => {
    if (!confirm("Excluir esta tarefa e todo o tempo registrado nela?")) return;
    atualizarEstado((e) => {
      e.tarefas = e.tarefas.filter((x) => x.id !== b.dataset.excluir);
      e.sessoesTempo = e.sessoesTempo.filter((s) => s.tarefaId !== b.dataset.excluir);
    });
    renderizarPaginaTempo(); atualizarPainel();
  }));

  /* --- controles do relógio --- */
  if (ativo) {
    document.getElementById("btn-parar-relogio").addEventListener("click", pararCronometro);
  } else {
    const selTarefa = document.getElementById("tp-tarefa");
    const selVinculo = document.getElementById("tp-vinculo");
    const alternar = () => {
      const nova = selTarefa.value === "__nova__";
      document.getElementById("tp-nova").style.display = nova ? "contents" : "none";
      document.getElementById("tp-cliente-campo").style.display = nova && selVinculo.value === "avulsa" ? "" : "none";
    };
    selTarefa.addEventListener("change", alternar);
    selVinculo.addEventListener("change", alternar);
    alternar();

    document.getElementById("btn-iniciar-relogio").addEventListener("click", () => {
      if (selTarefa.value !== "__nova__") { iniciarCronometro(selTarefa.value); return; }
      const descricao = document.getElementById("tp-descricao").value.trim();
      if (!descricao) { alert("Descreva a tarefa."); return; }
      const vinculo = selVinculo.value;
      const nova = { id: gerarId(), descricao, clienteId: null, orcamentoId: null, fixo: false, progresso: "comeco", criadaEm: new Date().toISOString(), finalizadaEm: null };
      if (vinculo === "fixo") nova.fixo = true;
      else if (vinculo.startsWith("orc:")) {
        nova.orcamentoId = vinculo.slice(4);
        const o = ESTADO.orcamentos.find((x) => x.id === nova.orcamentoId);
        if (o) nova.clienteId = o.clienteId;
      } else nova.clienteId = document.getElementById("tp-cliente").value || null;
      atualizarEstado((e) => { e.tarefas.push(nova); });
      iniciarCronometro(nova.id);
    });
  }

  /* --- valor/hora real --- */
  const minimo = valorMinimoHora();
  document.getElementById("tp-minimo").textContent = formatarMoeda(minimo) + "/h";
  const linhas = [];
  const mes = mesAtualChave();

  const valorFixo = Number(ESTADO.configuracoes.clienteFixoMensal || 0);
  if (valorFixo > 0) {
    const horasCrono = ESTADO.tarefas.filter((t) => t.fixo).reduce((s, t) => s + segundosTarefa(t.id, mes), 0) / 3600;
    const horasManuais = ESTADO.demandasMensais.filter((d) => chaveMes(d.data) === mes).reduce((s, d) => s + Number(d.horas || 0), 0);
    linhas.push({ nome: "Cliente fixo — mês atual", valor: valorFixo, horas: horasCrono + horasManuais });
  }
  ESTADO.orcamentos.forEach((o) => {
    const segs = ESTADO.tarefas.filter((t) => t.orcamentoId === o.id).reduce((s, t) => s + segundosTarefa(t.id), 0);
    if (segs <= 0) return;
    const c = ESTADO.clientes.find((x) => x.id === o.clienteId);
    linhas.push({ nome: `${o.descricao || "Orçamento"}${c ? " — " + c.nome : ""}`, valor: Number(o.valor || 0), horas: segs / 3600, aceito: o.aceito });
  });

  document.getElementById("tp-rentab").innerHTML = linhas.map((l) => {
    if (l.horas < 0.1) {
      const rotulo = l.horas <= 0 ? "Sem horas registradas" : "Poucas horas para calcular (mín. 6 min)";
      return `<tr><td>${escaparHtml(l.nome)}</td><td>${formatarMoeda(l.valor)}</td><td>${formatarDuracaoCurta(Math.round(l.horas * 3600))}</td><td>-</td><td><span class="card-sub">${rotulo}</span></td></tr>`;
    }
    const taxa = l.valor / l.horas;
    const dif = minimo > 0 ? ((taxa - minimo) / minimo) * 100 : 0;
    const acima = taxa >= minimo;
    return `
      <tr>
        <td>${escaparHtml(l.nome)}</td>
        <td>${formatarMoeda(l.valor)}</td>
        <td>${l.horas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}h</td>
        <td><b>${formatarMoeda(taxa)}</b></td>
        <td><span class="selo ${acima ? "pago" : "atrasado"}">${acima ? "✔ Acima" : "⚠ Abaixo"} do mínimo (${dif >= 0 ? "+" : ""}${dif.toFixed(0)}%)</span></td>
      </tr>`;
  }).join("") || `<tr><td colspan="5" style="text-align:center; color:var(--cor-texto-suave);">Registre tempo em tarefas para ver o valor/hora real.</td></tr>`;
}
