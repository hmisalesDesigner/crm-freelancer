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

/** Faturamento (valor cobrado) por mês no ano informado, incluindo o cliente fixo. Retorna array de 12 números. */
function faturamentoPorMes(ano) {
  const meses = new Array(12).fill(0);
  ESTADO.clientes.forEach((c) => {
    (c.historicoFinanceiro || []).forEach((h) => {
      const d = new Date(h.data);
      if (d.getFullYear() === ano) meses[d.getMonth()] += Number(h.valor || 0);
    });
  });
  const hoje = new Date();
  const ultimoMes = ano < hoje.getFullYear() ? 11 : ano === hoje.getFullYear() ? hoje.getMonth() : -1;
  for (let m = 0; m <= ultimoMes; m++) meses[m] += Number(ESTADO.configuracoes.clienteFixoMensal || 0);
  return meses;
}
