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
    acaoB3: { ticker: "", percentualReserva: 10, valorMinimo: 25, valorMaximo: 60 }, // reserva ajustada à faixa [mín, máx]
    nomeProfissional: "Henrique",
    whatsapp: "",             // só números, com DDD (ex: 44999999999)
    validadeOrcamentoDias: 7,
    leadSeguidoresMin: 500,   // faixa ideal de seguidores para o score dos leads
    leadSeguidoresMax: 20000,
    diasFollowUp: 3,          // dias sem resposta para alertar um orçamento enviado
    metaMensal: 0,            // meta de faturamento mensal (0 = sem meta)
    diaPagamentoFixo: 5,      // dia do mês em que o cliente fixo costuma pagar
    dasPagos: [],             // meses (AAAA-MM) com DAS já pago
  },
  clientes: [],      // { id, nome, contato, cnpj, razaoSocial, capitalSocial, demanda, historicoFinanceiro, etapaFunil, criadoEm }
  orcamentos: [],     // { id, clienteId, descricao, modo, valor, dataEnvio, aceito }
  leads: [],          // sistema de prospecção (ver prospeccao.js)
  prospeccoes: [],    // { id, nome, tipo, local, contato, status, observacao }
  demandasMensais: [], // { id, descricao, horas, data (ISO), clienteId? }  (lançamentos manuais do modo "Por Mês")
  pagamentos: [],      // { id, clienteId, orcamentoId?, descricao, valor, vencimento (AAAA-MM-DD), pago, dataPagamento, fixoMes? }
  tarefas: [],         // { id, descricao, clienteId, orcamentoId, fixo, progresso: "comeco"|"metade"|"finalizada", criadaEm, finalizadaEm }
  sessoesTempo: [],    // { id, tarefaId, inicio (ISO), fim (ISO), segundos }
  despesas: [         // { id, descricao, categoria, tipo: "mensal"|"equipamento", valor, dataCompra, vidaUtilMeses }
    { id: "desp-pc-i7-6700", descricao: "Computador Syma i7-6700 (NF-e 828503, comprado pelo pai; valor com IPI)", categoria: "Equipamento", tipo: "equipamento", valor: 5077.8, dataCompra: "2016-11-25", vidaUtilMeses: 60 },
    { id: "desp-ssd-kingston-240", descricao: "SSD Kingston 240 GB SUV400 (NF-e 828503)", categoria: "Equipamento", tipo: "equipamento", valor: 429.8, dataCompra: "2016-11-25", vidaUtilMeses: 60 },
    { id: "desp-monitor-lg-23mp55", emReserva: true, descricao: "Monitor LG 23\" 23MP55HQ IPS (NF-e 828503)", categoria: "Equipamento", tipo: "equipamento", valor: 887.9, dataCompra: "2016-11-25", vidaUtilMeses: 60 },
    { id: "desp-memoria-8gb", descricao: "Memória 8 GB DDR4 2400 Kingston (NF-e 912373, já com desconto)", categoria: "Equipamento", tipo: "equipamento", valor: 297.79, dataCompra: "2019-09-05", vidaUtilMeses: 60 },
    { id: "desp-memoria-fury-8gb", descricao: "Memória 8 GB DDR4 2400 Kingston Fury (NF-e 912413, já com desconto)", categoria: "Equipamento", tipo: "equipamento", valor: 297.79, dataCompra: "2019-09-05", vidaUtilMeses: 60 },
    { id: "desp-wacom-intuos", emReserva: true, descricao: "Mesa digitalizadora Wacom Intuos P CTL4100 (NF-e 912373, já com desconto)", categoria: "Equipamento", tipo: "equipamento", valor: 520.21, dataCompra: "2019-09-05", vidaUtilMeses: 60 },
    { id: "desp-energia-trabalho", estimado: true, descricao: "Energia elétrica do trabalho (PC 8 h/dia + metade dos 2 ventiladores 24 h/dia, a ~R$ 1,00/kWh)", categoria: "Internet e energia", tipo: "mensal", valor: 107, dataCompra: "", vidaUtilMeses: 0 },
    { id: "desp-internet-fibra", estimado: true, descricao: "Internet fibra R$ 99,90/mês (934 Mbps) — 50% para o trabalho (PC no cabo; 3 celulares no Wi-Fi)", categoria: "Internet e energia", tipo: "mensal", valor: 49.95, dataCompra: "", vidaUtilMeses: 0 },
    { id: "desp-gtx960", estimado: true, descricao: "Placa de vídeo Zotac GTX 960 4 GB", categoria: "Equipamento", tipo: "equipamento", valor: 900, dataCompra: "2017-01-01", vidaUtilMeses: 60 },
    { id: "desp-hdd-seagate-2tb", estimado: true, descricao: "HDD Seagate 2 TB ST2000DM001", categoria: "Equipamento", tipo: "equipamento", valor: 350, dataCompra: "2016-12-01", vidaUtilMeses: 60 },
    { id: "desp-ssd-sa400", estimado: true, descricao: "SSD Kingston SA400 240 GB (usado, disco do sistema)", categoria: "Equipamento", tipo: "equipamento", valor: 100, dataCompra: "2026-09-01", vidaUtilMeses: 60 },
    { id: "desp-teclado-satellite", estimado: true, descricao: "Teclado USB Satellite AK-XP1", categoria: "Equipamento", tipo: "equipamento", valor: 60, dataCompra: "2020-01-01", vidaUtilMeses: 36 },
    { id: "desp-memoria-shopee-2026", descricao: "Memória 8 GB DDR4 Kingston HyperX Fury 2133 (Shopee, Pix)", categoria: "Equipamento", tipo: "equipamento", valor: 221.71, dataCompra: "2026-10-01", vidaUtilMeses: 60 },
    { id: "desp-mouse-vertical-inland", descricao: "Mouse vertical ergonômico Inland Sounds USB, óptico LED, preto", categoria: "Equipamento", tipo: "equipamento", valor: 79.39, dataCompra: "2026-11-15", vidaUtilMeses: 36 },
    { id: "desp-monitor-24p1u", descricao: "Monitor AOC 24P1U 23,8\"", categoria: "Equipamento", tipo: "equipamento", valor: 920, dataCompra: "2020-11-27", vidaUtilMeses: 60 },
    { id: "desp-monitor-m2470", emReserva: true, descricao: "Monitor AOC M2470SWD 23,6\" (valor da NF cancelada: confirmar)", categoria: "Equipamento", tipo: "equipamento", valor: 739, dataCompra: "2020-11-27", vidaUtilMeses: 60 },
    { id: "desp-cabo-usb", descricao: "Cabo extensor USB 3.0 1,8 m", categoria: "Equipamento", tipo: "equipamento", valor: 45, dataCompra: "2020-10-16", vidaUtilMeses: 36 },
    { id: "desp-microfone-c3tech", descricao: "Microfone Gamer C3Tech MI-G10BK (NF-e 1027139)", categoria: "Equipamento", tipo: "equipamento", valor: 56.3, dataCompra: "2023-06-06", vidaUtilMeses: 36 },
  ],
  cronometroAtivo: null, // { tarefaId, inicio (ISO) }
  modelosOrcamento: [  // { id, nome, descricao, modo, quantidade, valorUnitario }
    { id: "modelo-stories", nome: "5 stories/reels (R$ 40 por peça)", descricao: "Criação de 5 stories/reels para Instagram", modo: "peca", quantidade: 5, valorUnitario: 40 },
  ],
};

DADOS_PADRAO.sementesDespesas = DADOS_PADRAO.despesas.map((d) => d.id);

function normalizarDados(dados) {
  const padrao = estruturaClonada(DADOS_PADRAO);
  const completo = { ...padrao, ...dados };
  // mescla profunda das configurações (chaves novas aparecem em bases antigas)
  completo.configuracoes = { ...padrao.configuracoes, ...(dados.configuracoes || {}) };
  completo.configuracoes.acaoB3 = { ...padrao.configuracoes.acaoB3, ...((dados.configuracoes || {}).acaoB3 || {}) };
  ["clientes", "orcamentos", "prospeccoes", "leads", "demandasMensais", "pagamentos", "tarefas", "sessoesTempo", "modelosOrcamento", "despesas"].forEach((k) => {
    if (!Array.isArray(completo[k])) completo[k] = padrao[k];
  });
  // migração: leads antigos da lista simples de prospecção viram leads do novo sistema (uma vez)
  if (!Array.isArray(dados.leads) && completo.prospeccoes.length) {
    const digitos = (v) => String(v || "").replace(/\D/g, "");
    const zap = (v) => { const n = digitos(v); return n.length >= 10 && n.length <= 11 ? "55" + n : n.length >= 12 && n.length <= 13 ? n : ""; };
    const hoje = new Date(); const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    completo.leads = completo.prospeccoes.map((p) => {
      const contato = String(p.contato || "");
      const whatsapp = zap(contato), email = /@/.test(contato) ? contato : "";
      return {
        id: p.id, perfil: "", nome: p.nome, tipo: p.tipo === "Freelancer parceiro" ? "Social Media" : "Empresa", nicho: "",
        cidade: p.local || "", seguidores: null, publicacoes: null, ultimoPost: "", postsPorSemana: null, curtidasMedias: null, visual: "",
        whatsapp, email, site: "", status: "Novo", proximoContato: "",
        obs: [p.observacao, !whatsapp && !email ? contato : ""].filter(Boolean).join(" · "), capturadoEm: hojeIso,
      };
    });
  }
  // migração: peças das notas fiscais entram uma vez em bases antigas (sem recriar as que foram apagadas depois)
  const jaOferecidas = Array.isArray(dados.sementesDespesas) ? dados.sementesDespesas : [];
  padrao.despesas.forEach((d) => {
    if (!jaOferecidas.includes(d.id) && !completo.despesas.some((x) => x.id === d.id)) completo.despesas.push(d);
  });
  if (!dados.reservaDespesasAplicada) {
    ["desp-monitor-lg-23mp55", "desp-wacom-intuos", "desp-monitor-m2470"].forEach((id) => { const d = completo.despesas.find((x) => x.id === id); if (d) d.emReserva = true; });
  }
  completo.reservaDespesasAplicada = true;
  completo.sementesDespesas = padrao.despesas.map((d) => d.id);
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
    // guarda uma cópia dos dados originais para não perdê-los se o próximo salvamento sobrescrever
    try { localStorage.setItem(CHAVE_DADOS + "_backup_erro", localStorage.getItem(CHAVE_DADOS) || ""); } catch {}
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
  if (!el) return;
  // erros aparecem como estão; o resto reflete o estado real do Drive
  el.textContent = texto.startsWith("⚠️") || typeof statusGeralDrive !== "function" ? texto : statusGeralDrive();
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
