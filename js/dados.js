/**
 * dados.js
 * Camada de persistência do CRM Freelancer.
 *
 * Estratégia: localStorage é a fonte principal (funciona offline, sem configuração).
 * Para sincronizar com o Google Drive, use os botões "Exportar backup (.json)" e
 * "Importar backup (.json)" na tela de Configurações, salvando o arquivo dentro
 * da pasta sincronizada do Google Drive no seu computador
 * (ex: G:\Meu Drive\CRM Freelancer\backup.json).
 *
 * Isso evita depender de autenticação OAuth do Google só para um uso pessoal,
 * mas mantém os dados seguros na sua conta do Drive.
 */

const CHAVE_DADOS = "crm_freelancer_dados_v1";

const DADOS_PADRAO = {
  configuracoes: {
    tema: "escuro",
    salarioDesejado: 4000,
    custosFixosMensais: 600,
    horasPagasPorMes: 100,
    limiteMeiAnual: 81000,
    clienteFixoMensal: 3000,
    acaoB3: { ticker: "", percentualReserva: 10 },
    nomeProfissional: "Henrique",
    whatsapp: "",             // só números, com DDD (ex: 44999999999)
    validadeOrcamentoDias: 7,
    diasFollowUp: 3,          // dias sem resposta para alertar um orçamento enviado
    metaMensal: 0,            // meta de faturamento mensal (0 = sem meta)
    diaPagamentoFixo: 5,      // dia do mês em que o cliente fixo costuma pagar
    dasPagos: [],             // meses (AAAA-MM) com DAS já pago
  },
  clientes: [],      // { id, nome, contato, cnpj, razaoSocial, capitalSocial, demanda, historicoFinanceiro, etapaFunil, criadoEm }
  orcamentos: [],     // { id, clienteId, descricao, modo, valor, dataEnvio, aceito }
  prospeccoes: [],    // { id, nome, tipo, local, contato, status, observacao }
  demandasMensais: [], // { id, descricao, horas, data (ISO), clienteId? }  (lançamentos manuais do modo "Por Mês")
  pagamentos: [],      // { id, clienteId, orcamentoId?, descricao, valor, vencimento (AAAA-MM-DD), pago, dataPagamento, fixoMes? }
  tarefas: [],         // { id, descricao, clienteId, orcamentoId, fixo, progresso: "comeco"|"metade"|"finalizada", criadaEm, finalizadaEm }
  sessoesTempo: [],    // { id, tarefaId, inicio (ISO), fim (ISO), segundos }
  cronometroAtivo: null, // { tarefaId, inicio (ISO) }
  modelosOrcamento: [  // { id, nome, descricao, modo, quantidade, valorUnitario }
    { id: "modelo-stories", nome: "5 stories/reels (R$ 40 por peça)", descricao: "Criação de 5 stories/reels para Instagram", modo: "peca", quantidade: 5, valorUnitario: 40 },
  ],
};

function normalizarDados(dados) {
  const padrao = estruturaClonada(DADOS_PADRAO);
  const completo = { ...padrao, ...dados };
  // mescla profunda das configurações (chaves novas aparecem em bases antigas)
  completo.configuracoes = { ...padrao.configuracoes, ...(dados.configuracoes || {}) };
  completo.configuracoes.acaoB3 = { ...padrao.configuracoes.acaoB3, ...((dados.configuracoes || {}).acaoB3 || {}) };
  ["clientes", "orcamentos", "prospeccoes", "demandasMensais", "pagamentos", "tarefas", "sessoesTempo", "modelosOrcamento"].forEach((k) => {
    if (!Array.isArray(completo[k])) completo[k] = padrao[k];
  });
  // migração: etapas renomeadas ("Em andamento" -> "Ativos", "Entregue" -> "Inativos")
  completo.clientes.forEach((c) => {
    if (c.etapaFunil === "Em andamento") c.etapaFunil = "Ativos";
    if (c.etapaFunil === "Entregue") c.etapaFunil = "Inativos";
  });
  return completo;
}

function carregarDados() {
  try {
    const bruto = localStorage.getItem(CHAVE_DADOS);
    if (!bruto) return estruturaClonada(DADOS_PADRAO);
    const dados = JSON.parse(bruto);
    const completo = normalizarDados(dados);
    return completo;
  } catch (e) {
    console.error("Erro ao carregar dados, usando padrão.", e);
    return estruturaClonada(DADOS_PADRAO);
  }
}

function salvarDados(dados) {
  try {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados));
    atualizarStatusSalvamento("💾 Dados salvos localmente — " + new Date().toLocaleTimeString("pt-BR"));
    if (typeof agendarSincronizacaoComDrive === "function") agendarSincronizacaoComDrive();
    return true;
  } catch (e) {
    console.error("Erro ao salvar dados.", e);
    atualizarStatusSalvamento("⚠️ Erro ao salvar dados");
    return false;
  }
}

function atualizarStatusSalvamento(texto) {
  const el = document.getElementById("status-drive");
  if (el) el.textContent = texto;
}

function estruturaClonada(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function exportarBackupJSON() {
  const dados = carregarDados();
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crm-freelancer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importarBackupJSON(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        salvarDados(dados);
        resolve(dados);
      } catch (err) {
        reject(err);
      }
    };
    leitor.onerror = reject;
    leitor.readAsText(arquivo);
  });
}

// Estado global em memória, carregado uma vez e mantido em sincronia com o localStorage
let ESTADO = carregarDados();

function atualizarEstado(mutador) {
  mutador(ESTADO);
  salvarDados(ESTADO);
}
