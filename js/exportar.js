/**
 * exportar.js
 * Exporta planilhas CSV (abrem direto no Excel/Google Planilhas em português:
 * separador ";" e acentos corretos) de clientes, orçamentos, pagamentos e horas.
 */

function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function celulaCsv(v) {
  let t = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(t)) t = "'" + t; // evita fórmula injetada ao abrir na planilha
  return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

function numeroCsv(n) { return (Number(n) || 0).toFixed(2).replace(".", ","); }

function gerarCsv(cabecalho, linhas) {
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
}

function dataCsv(iso) { return iso ? formatarDataBR(paraDataISO(iso)) : ""; }

const EXPORTACOES_CSV = {
  clientes: {
    arquivo: "clientes",
    montar: () => gerarCsv(
      ["Nome", "Razão social", "CNPJ", "Contato", "Etapa do funil", "Próximo contato", "Faturamento total (R$)"],
      ESTADO.clientes.map((c) => [c.nome, c.razaoSocial, c.cnpj, c.contato, c.etapaFunil, dataCsv(c.proximoContato),
        numeroCsv((c.historicoFinanceiro || []).reduce((s, h) => s + Number(h.valor || 0), 0))])
    ),
  },
  orcamentos: {
    arquivo: "orcamentos",
    montar: () => gerarCsv(
      ["Data", "Cliente", "Descrição", "Modo", "Quantidade", "Valor unitário (R$)", "Total (R$)", "Status"],
      ESTADO.orcamentos.map((o) => {
        const c = ESTADO.clientes.find((x) => x.id === o.clienteId);
        return [dataCsv(o.dataEnvio), c ? c.nome : "", o.descricao, ROTULOS_MODO[o.modo] || o.modo, o.quantidade,
          numeroCsv(o.valorUnitario), numeroCsv(o.valor), o.aceito ? "Aceito" : o.recusado ? "Recusado" : "Enviado"];
      })
    ),
  },
  pagamentos: {
    arquivo: "pagamentos",
    montar: () => gerarCsv(
      ["Vencimento", "Cliente", "Descrição", "Valor (R$)", "Status", "Data do pagamento"],
      ESTADO.pagamentos.map((p) => [dataCsv(p.vencimento), nomeClientePagamento(p), p.descricao, numeroCsv(p.valor),
        rotuloStatusPagamento(statusPagamento(p)), dataCsv(p.dataPagamento)])
    ),
  },
  horas: {
    arquivo: "horas-trabalhadas",
    montar: () => gerarCsv(
      ["Tarefa", "Vínculo", "Cliente", "Status", "Início da sessão", "Duração (h)"],
      ESTADO.sessoesTempo.map((s) => {
        const t = tarefaPorId(s.tarefaId) || {};
        const c = ESTADO.clientes.find((x) => x.id === t.clienteId);
        return [t.descricao, t.fixo ? "Cliente fixo" : t.orcamentoId ? "Orçamento" : "Avulsa", c ? c.nome : "",
          ROTULOS_PROGRESSO[t.progresso] || "", dataCsv(s.inicio), numeroCsv((Number(s.segundos) || 0) / 3600)];
      })
    ),
  },
};

function exportarCsv(chave) {
  const e = EXPORTACOES_CSV[chave];
  baixarArquivo(`${e.arquivo}-${hojeISO()}.csv`, e.montar(), "text/csv;charset=utf-8");
}
