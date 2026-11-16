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
    { id: "desp-memoria-fury-8gb", descricao: "Memória 8 GB DDR4 2400 Kingston Fury (NF-e 912413, já com desconto)", categoria: "Equipamento", tipo: "equipamento", valor: 297.79, dataCompra: "2019-09-05", vidaUtilMeses: 60 },
    { id: "desp-wacom-intuos", emReserva: true, descricao: "Mesa digitalizadora Wacom Intuos P CTL4100 (NF-e 912373, já com desconto)", categoria: "Equipamento", tipo: "equipamento", valor: 520.21, dataCompra: "2019-09-05", vidaUtilMeses: 60 },
    { id: "desp-das-mei", descricao: "DAS do MEI (contribuição mensal)", categoria: "Impostos (DAS do MEI)", tipo: "mensal", valor: 87.05, dataCompra: "", vidaUtilMeses: 0 },
    { id: "desp-energia-trabalho", estimado: true, descricao: "Energia elétrica do trabalho (PC 8 h/dia + metade dos 2 ventiladores 24 h/dia, a ~R$ 1,00/kWh)", categoria: "Internet e energia", tipo: "mensal", valor: 107, dataCompra: "", vidaUtilMeses: 0 },
    { id: "desp-internet-fibra", estimado: true, descricao: "Internet fibra R$ 99,90/mês (934 Mbps) — 50% para o trabalho (PC no cabo; 3 celulares no Wi-Fi)", categoria: "Internet e energia", tipo: "mensal", valor: 49.95, dataCompra: "", vidaUtilMeses: 0 },
    { id: "desp-servico-2022-11-08", descricao: "Serviço 08/11/2022: limpeza e formatação do PC (NFS-e 11468)", categoria: "Outros", tipo: "equipamento", valor: 180, dataCompra: "2022-11-08", vidaUtilMeses: 12 },
    { id: "desp-servico-2025-12-21", descricao: "Serviço 21/12/2025: limpeza e formatação do PC", categoria: "Outros", tipo: "equipamento", valor: 43.9, dataCompra: "2025-12-21", vidaUtilMeses: 12 },
    { id: "desp-servico-2026-02-09", descricao: "Serviço 09/02/2026: limpeza do PC", categoria: "Outros", tipo: "equipamento", valor: 30, dataCompra: "2026-02-09", vidaUtilMeses: 12 },
    { id: "desp-servico-2026-05-07", descricao: "Serviço 07/05/2026: formatação e instalação do Windows 11 (com limpeza)", categoria: "Outros", tipo: "equipamento", valor: 35, dataCompra: "2026-05-07", vidaUtilMeses: 12 },
    { id: "desp-manutencao-2026-10", descricao: "Manutenção 30/10/2026: limpeza, ajustes, inversão dos coolers, cabo HDMI e extensão de energia curta", categoria: "Outros", tipo: "equipamento", valor: 94.9, dataCompra: "2026-10-30", vidaUtilMeses: 12 },
    { id: "desp-gtx960", estimado: true, descricao: "Placa de vídeo Zotac GTX 960 4 GB", categoria: "Equipamento", tipo: "equipamento", valor: 900, dataCompra: "2017-01-01", vidaUtilMeses: 60 },
    { id: "desp-hdd-seagate-2tb", estimado: true, descricao: "HDD Seagate 2 TB ST2000DM001", categoria: "Equipamento", tipo: "equipamento", valor: 350, dataCompra: "2016-12-01", vidaUtilMeses: 60 },
    { id: "desp-ssd-sa400", descricao: "SSD Kingston SA400 240 GB, usado de notebook (instalado em 14/08/2026 com 99% de vida; hoje 98%)", categoria: "Equipamento", tipo: "equipamento", valor: 309, dataCompra: "2026-08-14", vidaUtilMeses: 60 },
    { id: "desp-teclado-satellite", estimado: true, descricao: "Teclado USB Satellite AK-XP1", categoria: "Equipamento", tipo: "equipamento", valor: 60, dataCompra: "2020-01-01", vidaUtilMeses: 36 },
    { id: "desp-memoria-shopee-2026", descricao: "Memória 8 GB DDR4 Kingston HyperX Fury 2133 (Shopee, Pix)", categoria: "Equipamento", tipo: "equipamento", valor: 221.71, dataCompra: "2026-10-01", vidaUtilMeses: 60 },
    { id: "desp-mouse-vertical-inland", descricao: "Mouse vertical ergonômico Inland Sounds USB, óptico LED, preto", categoria: "Equipamento", tipo: "equipamento", valor: 79.39, dataCompra: "2026-11-15", vidaUtilMeses: 36 },
    { id: "desp-monitor-24p1u", descricao: "Monitor AOC 24P1U 23,8\"", categoria: "Equipamento", tipo: "equipamento", valor: 920, dataCompra: "2020-11-27", vidaUtilMeses: 60 },
    { id: "desp-monitor-m2470", emReserva: true, descricao: "Monitor AOC M2470SWD 23,6\" (valor da NF cancelada: confirmar)", categoria: "Equipamento", tipo: "equipamento", valor: 739, dataCompra: "2020-11-27", vidaUtilMeses: 60 },
    { id: "desp-cabo-usb", descricao: "Cabo extensor USB 3.0 1,8 m", categoria: "Equipamento", tipo: "equipamento", valor: 45, dataCompra: "2020-10-16", vidaUtilMeses: 36 },
    { id: "desp-microfone-c3tech", descricao: "Microfone Gamer C3Tech MI-G10BK (NF-e 1027139)", categoria: "Equipamento", tipo: "equipamento", valor: 56.3, dataCompra: "2023-06-06", vidaUtilMeses: 36 },
  ],
  demandas: [],        // { id, cliente, titulo, data (AAAA-MM-DD), status: "fazer"|"andamento"|"concluida", semana?, categoria? }
  avaliacoesGoogle: [], // { id, data (AAAA-MM-DD), tipo: "positiva"|"negativa", quantidade }
  cronometroAtivo: null, // { tarefaId, inicio (ISO) }
  modelosOrcamento: [  // { id, nome, descricao, modo, quantidade, valorUnitario }
    { id: "modelo-stories", nome: "5 stories/reels (R$ 40 por peça)", descricao: "Criação de 5 stories/reels para Instagram", modo: "peca", quantidade: 5, valorUnitario: 40 },
  ],
};

DADOS_PADRAO.sementesDespesas = DADOS_PADRAO.despesas.map((d) => d.id);

function hojeISOLocal() { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}-${String(h.getDate()).padStart(2,"0")}`; }

function normalizarDados(dados) {
  const padrao = estruturaClonada(DADOS_PADRAO);
  const completo = { ...padrao, ...dados };
  // mescla profunda das configurações (chaves novas aparecem em bases antigas)
  completo.configuracoes = { ...padrao.configuracoes, ...(dados.configuracoes || {}) };
  completo.configuracoes.acaoB3 = { ...padrao.configuracoes.acaoB3, ...((dados.configuracoes || {}).acaoB3 || {}) };
  ["clientes", "orcamentos", "prospeccoes", "leads", "demandasMensais", "pagamentos", "tarefas", "sessoesTempo", "modelosOrcamento", "despesas", "demandas", "avaliacoesGoogle"].forEach((k) => {
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
  if (!dados.memoriaKvrRemovida) completo.despesas = completo.despesas.filter((d) => d.id !== "desp-memoria-8gb"); // KVR24N17 não está no PC (conferido via PowerShell)
  completo.memoriaKvrRemovida = true;
  if (!dados.ssdSa400Corrigido) { // valor real do SSD SA400 (antes estimado)
    const velho = completo.despesas.find((d) => d.id === "desp-ssd-sa400"), novo = padrao.despesas.find((d) => d.id === "desp-ssd-sa400");
    if (velho && novo) { delete velho.estimado; Object.assign(velho, novo); }
  }
  completo.ssdSa400Corrigido = true;
  if (!dados.demandasVespor && Array.isArray(window.DEMANDAS_VESPOR_SEED)) { // histórico da planilha entra uma vez como "Concluída"
    window.DEMANDAS_VESPOR_SEED.forEach((x, i) => completo.demandas.push({ id: "vp-" + i, cliente: "Vespor", titulo: x[2], data: x[0] || "", semana: x[1], status: "concluida" }));
  }
  completo.demandasVespor = true;
  completo.sementesDespesas = padrao.despesas.map((d) => d.id);
  // ajuste de preço pedido pelo Henrique (16/11/2026): salário desejado, custos reais e horas de dedicação (8h/dia, seg a sex)
  if (!dados.calculadoraAjustada2026) {
    const custoMensalLocal = (d) => (d.emReserva ? 0 : d.tipo === "equipamento" ? (Number(d.valor) || 0) / Math.max(Number(d.vidaUtilMeses) || 60, 1) : Number(d.valor) || 0);
    completo.configuracoes.salarioDesejado = 4000;
    completo.configuracoes.custosFixosMensais = Math.round(completo.despesas.reduce((s, d) => s + custoMensalLocal(d), 0) * 100) / 100;
    completo.configuracoes.horasPagasPorMes = 173; // 8h/dia x 5 dias x ~4,33 semanas/mês
  }
  completo.calculadoraAjustada2026 = true;
  if (!dados.horasAjustadas2026b) { // 16/11/2026: Henrique trabalha quase todo dia, incluindo domingos (menos) e feriados
    completo.configuracoes.horasPagasPorMes = 224; // ~26 dias x 8h + ~4 domingos x 4h
  }
  completo.horasAjustadas2026b = true;
  if (!dados.configPreenchida2026) { // 16/11/2026: Henrique pediu para preencher WhatsApp, nome e meta, e salvar margem de 30% para avulsos
    completo.configuracoes.whatsapp = "44997742036";
    completo.configuracoes.nomeProfissional = "Henrique Designer e Editor de vídeos";
    completo.configuracoes.metaMensal = 4000;
    completo.configuracoes.margemAvulsos = 30;
  }
  completo.configPreenchida2026 = true;
  if (!dados.universidadeVesporSeed2026) { // Universidade Vespor (Vedéks): módulos como demandas comuns, conforme pedido
    completo.demandas.push(
      { id: "vp-mod9", cliente: "Vespor", titulo: "Módulo 9 — Iniciando um Orçamento (Universidade Vespor)", data: hojeISOLocal(), status: "concluida" },
      { id: "vp-mod10", cliente: "Vespor", titulo: "Módulo 10 — Condições Comerciais (Universidade Vespor)", data: hojeISOLocal(), status: "concluida" },
      { id: "vp-mod11", cliente: "Vespor", titulo: "Módulo 11 — Formas de Pagamento (Universidade Vespor)", data: hojeISOLocal(), status: "concluida" },
      { id: "vp-mod12", cliente: "Vespor", titulo: "Módulo 12 — Transporte e Frete (Universidade Vespor): substituir texto genérico do exercício por resumo explicativo", data: hojeISOLocal(), status: "fazer" }
    );
  }
  completo.universidadeVesporSeed2026 = true;
  if (!dados.categoriasVesporAplicadas2026 && window.CATEGORIA_POR_TITULO_VESPOR) { // categorias (Arte, Vídeo/Áudio, Suporte, Revisão) do histórico de atividades
    completo.demandas.forEach((d) => { if (!d.categoria && window.CATEGORIA_POR_TITULO_VESPOR[d.titulo]) d.categoria = window.CATEGORIA_POR_TITULO_VESPOR[d.titulo]; });
  }
  completo.categoriasVesporAplicadas2026 = true;
  if (!dados.avaliacoesGoogleSeed2026 && window.AVALIACOES_GOOGLE_SEED) { // ponto de partida: avaliações do Google já respondidas, extraídas do histórico
    window.AVALIACOES_GOOGLE_SEED.forEach((x, i) => completo.avaliacoesGoogle.push({ id: "av-" + i, data: x[0], tipo: x[1], quantidade: x[2] }));
  }
  completo.avaliacoesGoogleSeed2026 = true;
  if (!dados.mod9Corrigido2026) { // Henrique avisou: Módulo 9 ainda está em edição, não concluído
    const m9 = completo.demandas.find((d) => d.id === "vp-mod9");
    if (m9) { m9.status = "andamento"; m9.data = hojeISOLocal(); }
  }
  completo.mod9Corrigido2026 = true;
  if (!dados.vesporModulosAtualizados2026) { // Henrique: módulos 9, 10 e 11 ainda em edição (arquivos diferentes); faltam 13, 14 e 15 para fechar o projeto
    ["vp-mod9", "vp-mod10", "vp-mod11"].forEach((id) => { const m = completo.demandas.find((d) => d.id === id); if (m) { m.status = "andamento"; m.data = hojeISOLocal(); } });
    completo.demandas.push(
      { id: "vp-mod13", cliente: "Vespor", titulo: "Módulo 13 — Boas Práticas (Universidade Vespor)", data: hojeISOLocal(), status: "fazer" },
      { id: "vp-mod14", cliente: "Vespor", titulo: "Módulo 14 — Erros Mais Comuns (Universidade Vespor)", data: hojeISOLocal(), status: "fazer" },
      { id: "vp-mod15", cliente: "Vespor", titulo: "Módulo 15 — Encerramento (Universidade Vespor)", data: hojeISOLocal(), status: "fazer" }
    );
  }
  completo.vesporModulosAtualizados2026 = true;
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
    if (!bruto) return normalizarDados({});
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
