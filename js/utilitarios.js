/**
 * utilitarios.js
 * Funções auxiliares compartilhadas (datas, telefone, duração, texto seguro).
 */

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function somarDiasISO(dataISO, dias) {
  const d = new Date(dataISO + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diasEntre(dataISOInicio, dataISOFim) {
  const a = new Date(dataISOInicio + "T12:00:00");
  const b = new Date(dataISOFim + "T12:00:00");
  return Math.round((b - a) / 86400000);
}

function paraDataISO(valor) {
  // aceita "AAAA-MM-DD" ou data/hora ISO completa
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return String(valor); // só data: não converter fuso
  const d = new Date(valor);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";
  const [a, m, d] = String(dataISO).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function chaveMes(valor) {
  // "2026-11" a partir de uma data
  return paraDataISO(valor).slice(0, 7);
}

function mesAtualChave() {
  return hojeISO().slice(0, 7);
}

function formatarDuracao(segundos) {
  segundos = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatarDuracaoCurta(segundos) {
  segundos = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Converte um contato em número de WhatsApp (55 + DDD + número) ou null se não parecer telefone. */
function telefoneParaWhatsapp(contato) {
  const digitos = String(contato || "").replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return "55" + digitos;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return digitos;
  return null;
}

function linkWhatsapp(contato, mensagem) {
  const numero = telefoneParaWhatsapp(contato);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem || "")}`;
}

function nomeMesCurto(indiceMes) {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][indiceMes];
}

/** Ano e mês (0-11) de uma data, sem o deslocamento de fuso horário de "new Date('AAAA-MM-DD')". */
function anoMesDe(valor) {
  const [ano, mes] = chaveMes(valor).split("-").map(Number);
  return { ano, mesIndice: mes - 1 };
}

/** Faturamento (valor cobrado) por mês no ano informado, incluindo o cliente fixo. Retorna array de 12 números. */
function faturamentoPorMes(ano) {
  const meses = new Array(12).fill(0);
  ESTADO.clientes.forEach((c) => {
    (c.historicoFinanceiro || []).forEach((h) => {
      const { ano: anoH, mesIndice } = anoMesDe(h.data);
      if (anoH === ano) meses[mesIndice] += Number(h.valor || 0);
    });
  });
  const hoje = new Date();
  const ultimoMes = ano < hoje.getFullYear() ? 11 : ano === hoje.getFullYear() ? hoje.getMonth() : -1;
  // o cliente fixo só entra nos meses em que ele mesmo não tem um lançamento próprio (senão soma em dobro)
  const fixo = ESTADO.clientes.find((c) => c.id === ESTADO.configuracoes.clienteFixoId);
  const mesesComRegistroFixo = new Set((fixo?.historicoFinanceiro || [])
    .map((h) => anoMesDe(h.data))
    .filter((x) => x.ano === ano)
    .map((x) => x.mesIndice));
  for (let m = 0; m <= ultimoMes; m++) if (!mesesComRegistroFixo.has(m)) meses[m] += Number(ESTADO.configuracoes.clienteFixoMensal || 0);
  return meses;
}

/**
 * Reserva sugerida para investir na B3 a partir de um valor recebido:
 * % do valor, ajustada para a faixa [mínimo, máximo] (padrão R$ 25 a R$ 60),
 * sem nunca passar de 50% do valor recebido (para trabalhos muito pequenos).
 */
function reservaB3(valor) {
  const cfg = (ESTADO.configuracoes.acaoB3) || {};
  const v = Number(valor) || 0;
  const pct = Number(cfg.percentualReserva) || 0;
  if (v <= 0 || pct <= 0) return 0;
  const min = Number(cfg.valorMinimo) || 25;
  const max = Math.max(Number(cfg.valorMaximo) || 60, min);
  const ajustado = Math.min(Math.max(v * pct / 100, min), max);
  return Math.round(Math.min(ajustado, v * 0.5) * 100) / 100;
}

/* ---------- Painel por cliente ---------- */

function normalizarNome(s) {
  return (s || "").trim().toLowerCase();
}

/** Compara nomes "por conteúdo": bate exato ou se um contém o outro (ex: "Vespor" e "Vespor Automotive"). */
function nomesCorrespondemCliente(nomeTexto, nomeCliente) {
  const a = normalizarNome(nomeTexto), b = normalizarNome(nomeCliente);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Demandas de um cliente: por clienteId (vínculo exato) ou, nas antigas, pelo nome em texto. */
function demandasDoCliente(cliente) {
  return (ESTADO.demandas || []).filter((d) => d.clienteId === cliente.id || (!d.clienteId && nomesCorrespondemCliente(d.cliente, cliente.nome)));
}

/** Avaliações do Google de um cliente, casando pelo nome em texto (mesma lógica das demandas). */
function avaliacoesDoCliente(cliente) {
  return (ESTADO.avaliacoesGoogle || []).filter((a) => nomesCorrespondemCliente(a.cliente, cliente.nome));
}

/** Faturamento por mês de um cliente específico. O cliente fixo só entra nos meses sem lançamento próprio, pra não somar em dobro. */
function faturamentoPorMesCliente(ano, cliente) {
  const meses = new Array(12).fill(0);
  const mesesComRegistro = new Set();
  (cliente.historicoFinanceiro || []).forEach((h) => {
    const { ano: anoH, mesIndice } = anoMesDe(h.data);
    if (anoH === ano) { meses[mesIndice] += Number(h.valor || 0); mesesComRegistro.add(mesIndice); }
  });
  if (ESTADO.configuracoes.clienteFixoId === cliente.id) {
    const hoje = new Date();
    const ultimoMes = ano < hoje.getFullYear() ? 11 : ano === hoje.getFullYear() ? hoje.getMonth() : -1;
    for (let m = 0; m <= ultimoMes; m++) if (!mesesComRegistro.has(m)) meses[m] += Number(ESTADO.configuracoes.clienteFixoMensal || 0);
  }
  return meses;
}

/** Horas trabalhadas para um cliente: tarefas vinculadas direto, por orçamento dele, e o cliente fixo (se for este). */
function horasDoCliente(cliente, mes) {
  const idsOrcamentos = (ESTADO.orcamentos || []).filter((o) => o.clienteId === cliente.id).map((o) => o.id);
  let segundos = (ESTADO.tarefas || [])
    .filter((t) => t.clienteId === cliente.id || idsOrcamentos.includes(t.orcamentoId))
    .reduce((s, t) => s + segundosTarefa(t.id, mes), 0);
  if (ESTADO.configuracoes.clienteFixoId === cliente.id) {
    segundos += (ESTADO.tarefas || []).filter((t) => t.fixo).reduce((s, t) => s + segundosTarefa(t.id, mes), 0);
  }
  return segundos;
}

/** Soma das horas de um cliente no ano inteiro (12 meses), em segundos. */
function horasAnoCliente(cliente, ano) {
  let segundos = 0;
  for (let m = 0; m < 12; m++) segundos += horasDoCliente(cliente, `${ano}-${String(m + 1).padStart(2, "0")}`);
  return segundos;
}
