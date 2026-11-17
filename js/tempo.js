/**
 * tempo.js
 * Relógio de tarefas: liga ao começar uma tarefa, desliga ao parar e pergunta em que
 * ponto ela está (começo, metade ou finalizada). Soma o tempo por tarefa e calcula o
 * valor/hora real. Não tem página própria — o interruptor fica dentro do painel de
 * cada cliente (ver painel-cliente.js); aqui só a mecânica do relógio.
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

/** Atualiza a tela que estiver aberta depois de ligar/desligar o relógio (painel do cliente, se for o caso). */
function atualizarTelaAposCronometro() {
  if (typeof atualizarPainelClienteSeAberto === "function") atualizarPainelClienteSeAberto();
}

function iniciarCronometro(tarefaId) {
  if (ESTADO.cronometroAtivo) {
    alert("Já existe um relógio rodando. Pare-o antes de iniciar outro.");
    return;
  }
  atualizarEstado((e) => { e.cronometroAtivo = { tarefaId, inicio: new Date().toISOString() }; });
  atualizarIndicadorCronometro();
  atualizarTelaAposCronometro();
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
  atualizarIndicadorCronometro();
  atualizarTelaAposCronometro();
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

/** Mostra só que está gravando (sem números correndo) — no título da aba e no indicador global. */
function atualizarIndicadorCronometro() {
  const a = ESTADO.cronometroAtivo;
  const global = document.getElementById("cronometro-global");
  if (a) {
    const t = tarefaPorId(a.tarefaId);
    if (global) {
      global.style.display = "inline-flex";
      global.innerHTML = `<span class="ponto-gravando"></span><span class="cronometro-global-nome">${escaparHtml(t ? t.descricao : "Tarefa")}</span>`;
    }
    document.title = "● Gravando · CRM Freelancer";
  } else {
    if (global) global.style.display = "none";
    document.title = "CRM Freelancer";
  }
}

/** Clicar no indicador global leva para o painel do cliente dono da tarefa em andamento. */
function iniciarIndicadorCronometro() {
  const global = document.getElementById("cronometro-global");
  if (global) global.addEventListener("click", () => {
    const a = ESTADO.cronometroAtivo;
    const t = a && tarefaPorId(a.tarefaId);
    if (t && t.clienteId && typeof abrirPainelCliente === "function") abrirPainelCliente(t.clienteId);
    else irParaPagina("clientes");
  });
  atualizarIndicadorCronometro();
}
