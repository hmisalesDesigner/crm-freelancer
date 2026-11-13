/**
 * google-drive.js
 * Sincronização automática dos dados (clientes, orçamentos, faturamento) com
 * um arquivo JSON dentro de uma pasta específica do Google Drive do usuário.
 *
 * Usa o escopo "drive.file" (não sensível): o site só enxerga/edita o arquivo
 * que ele mesmo cria — nunca lista nem acessa outros arquivos do Drive.
 *
 * Pré-requisitos (feitos uma vez no Google Cloud Console, projeto "CRM Freelancer"):
 *  1. Ativar a "Google Drive API" em APIs e Serviços → Biblioteca.
 *  2. Na Tela de consentimento OAuth → Dados de acesso/Escopos, adicionar o
 *     escopo ".../auth/drive.file".
 */

const DRIVE_PASTA_ID = "1W0icA2PGNpcoiT3gewv5WHZnyr8qx_Ng";
const DRIVE_NOME_ARQUIVO = "crm-freelancer-dados.json";
const DRIVE_ESCOPO = "https://www.googleapis.com/auth/drive.file";
const CHAVE_DRIVE_ARQUIVO_ID = "crm_freelancer_drive_arquivo_id";
const CHAVE_DRIVE_TOKEN = "crm_freelancer_drive_token";
const CHAVE_DRIVE_AUTORIZADO = "crm_freelancer_drive_autorizado"; // usuário já conectou e não desconectou manualmente

let driveTokenClient = null;
let driveAccessToken = null;
let driveTokenExpiraEm = 0;
let driveArquivoId = localStorage.getItem(CHAVE_DRIVE_ARQUIVO_ID) || null;
let driveSalvandoTimeout = null;
let driveSincronizando = false;
let driveUltimoEnvio = null;    // hora do último envio bem-sucedido ao Drive
let drivePendente = false;      // há alterações locais ainda não enviadas ao Drive
let driveRenovando = null;      // promessa da renovação em andamento
let driveMonitorIniciado = false;

function driveAutorizado() { return localStorage.getItem(CHAVE_DRIVE_AUTORIZADO) === "1"; }
function driveExpiraEmBreve() { return driveConectado() && driveTokenExpiraEm - Date.now() < 5 * 60 * 1000; }
function emailDaSessao() {
  try { return JSON.parse(sessionStorage.getItem("crm_freelancer_sessao_login") || "null")?.email || undefined; } catch { return undefined; }
}
function esquecerTokenDriveLocal() {
  driveAccessToken = null; driveTokenExpiraEm = 0;
  sessionStorage.removeItem(CHAVE_DRIVE_TOKEN);
}

function restaurarTokenDriveDaSessao() {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE_DRIVE_TOKEN) || "null");
    if (salvo && salvo.expiraEm > Date.now()) {
      driveAccessToken = salvo.token;
      driveTokenExpiraEm = salvo.expiraEm;
    }
  } catch {}
}

function salvarTokenDriveNaSessao() {
  sessionStorage.setItem(CHAVE_DRIVE_TOKEN, JSON.stringify({ token: driveAccessToken, expiraEm: driveTokenExpiraEm }));
}

function driveConectado() {
  return !!driveAccessToken && Date.now() < driveTokenExpiraEm;
}

function statusGeralDrive() {
  if (driveConectado()) {
    if (drivePendente) return "☁️ Drive conectado — enviando alterações...";
    return driveUltimoEnvio ? "☁️ Salvo no Google Drive — " + driveUltimoEnvio : "☁️ Conectado ao Google Drive";
  }
  return driveAutorizado() ? "⚠️ Drive desconectado — salvo só neste navegador" : "💾 Dados salvos localmente";
}

function atualizarStatusDrive(texto) {
  const aviso = texto && texto.startsWith("⚠️");
  const el = document.getElementById("status-drive");
  if (el) el.textContent = aviso ? texto : statusGeralDrive();
  const elCfg = document.getElementById("drive-status-config");
  if (elCfg) elCfg.textContent = driveConectado() ? "🔗 Conectado ao Google Drive" : (texto || statusGeralDrive());
  atualizarBotaoDrive();
  atualizarFaixaDrive();
}

function atualizarFaixaDrive() {
  const conteudo = document.querySelector(".conteudo");
  if (!conteudo) return;
  let faixa = document.getElementById("faixa-drive");
  if (!faixa) {
    faixa = document.createElement("div");
    faixa.id = "faixa-drive";
    faixa.className = "faixa-drive";
    conteudo.insertBefore(faixa, conteudo.firstChild);
  }
  if (driveConectado()) { faixa.classList.remove("visivel"); return; }
  const tentando = !!driveRenovando;
  faixa.innerHTML = `<span>${tentando ? "🔄 Reconectando ao Google Drive..." : driveAutorizado()
    ? "⚠️ Google Drive desconectado — seus dados estão só neste navegador até reconectar."
    : "⚠️ Google Drive não conectado — seus dados estão só neste navegador."}</span>
    ${tentando ? "" : '<button class="botao pequeno" id="btn-faixa-drive">🔗 Conectar agora</button>'}`;
  faixa.classList.add("visivel");
  const b = document.getElementById("btn-faixa-drive");
  if (b) b.addEventListener("click", conectarDrive);
}

function atualizarBotaoDrive() {
  const btn = document.getElementById("btn-conectar-drive");
  if (!btn) return;
  if (driveConectado()) {
    btn.textContent = "Desconectar";
    btn.classList.add("sucesso");
  } else {
    btn.textContent = "🔗 Conectar ao Google Drive";
    btn.classList.remove("sucesso");
  }
}

function desconectarDrive() {
  localStorage.removeItem(CHAVE_DRIVE_AUTORIZADO);
  const token = driveAccessToken;
  driveAccessToken = null;
  driveTokenExpiraEm = 0;
  clearTimeout(driveSalvandoTimeout);
  sessionStorage.removeItem(CHAVE_DRIVE_TOKEN);
  if (token && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(token, () => {});
  }
  atualizarStatusDrive("Desconectado do Google Drive");
}

function inicializarDriveTokenClient() {
  if (driveTokenClient || !window.google?.accounts?.oauth2) return;
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_ESCOPO,
    callback: () => {}, // sobrescrito a cada chamada em conectarDrive()/garantirTokenValido()
    error_callback: (erro) => { if (driveTokenClient && driveTokenClient.erroCb) driveTokenClient.erroCb(erro); },
  });
}

function conectarDrive() {
  inicializarDriveTokenClient();
  if (!driveTokenClient) {
    alert("O login do Google ainda está carregando. Tente novamente em alguns segundos.");
    return;
  }
  driveTokenClient.callback = (resposta) => {
    if (resposta.error) {
      atualizarStatusDrive("⚠️ Não foi possível conectar ao Google Drive.");
      return;
    }
    driveAccessToken = resposta.access_token;
    driveTokenExpiraEm = Date.now() + (resposta.expires_in - 60) * 1000;
    salvarTokenDriveNaSessao();
    localStorage.setItem(CHAVE_DRIVE_AUTORIZADO, "1");
    atualizarStatusDrive("🔗 Conectado ao Google Drive — sincronizando...");
    sincronizarInicialComDrive();
  };
  driveTokenClient.erroCb = () => atualizarStatusDrive("⚠️ Não foi possível conectar ao Google Drive.");
  driveTokenClient.requestAccessToken({ prompt: driveAutorizado() ? "" : "consent", hint: emailDaSessao() });
}

function garantirTokenValido(forcar) {
  if (driveConectado() && !forcar) return Promise.resolve(true);
  if (driveRenovando) return driveRenovando;
  inicializarDriveTokenClient();
  if (!driveTokenClient) return Promise.resolve(false);

  driveRenovando = new Promise((resolve) => {
    let terminou = false;
    const fim = (ok) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(limite);
      driveRenovando = null;
      atualizarStatusDrive(ok ? "☁️ Conectado ao Google Drive" : "⚠️ Google Drive desconectado");
      resolve(ok);
    };
    const limite = setTimeout(() => fim(false), 20000);
    driveTokenClient.callback = (resposta) => {
      if (resposta.error) return fim(false);
      driveAccessToken = resposta.access_token;
      driveTokenExpiraEm = Date.now() + (resposta.expires_in - 60) * 1000;
      salvarTokenDriveNaSessao();
      fim(true);
    };
    driveTokenClient.erroCb = () => fim(false);
    try { driveTokenClient.requestAccessToken({ prompt: "", hint: emailDaSessao() }); } catch { fim(false); }
  });
  atualizarFaixaDrive();
  return driveRenovando;
}

/**
 * Monitor automático: confere a conexão ao abrir, a cada 30 s e ao voltar para a aba.
 * Renova o token em segundo plano (sem clique) enquanto o Google permitir; se exigir
 * interação, a faixa no topo oferece o botão para reconectar.
 */
async function verificarConexaoDrive() {
  atualizarStatusDrive();
  if (!window.google?.accounts?.oauth2 || !sessaoValida()) return;
  if (!driveAutorizado()) { atualizarFaixaDrive(); return; }
  if (!driveConectado() || driveExpiraEmBreve()) {
    const ok = await garantirTokenValido(true); // renova antes de expirar
    if (ok && drivePendente) salvarNoDrive(ESTADO);
  }
  atualizarFaixaDrive();
}

function iniciarMonitorDrive() {
  if (driveMonitorIniciado) return;
  driveMonitorIniciado = true;
  let tentativas = 0;
  const esperarGoogle = setInterval(() => {
    tentativas++;
    if (window.google?.accounts?.oauth2) {
      clearInterval(esperarGoogle);
      verificarConexaoDrive();
      setInterval(verificarConexaoDrive, 30000);
    } else if (tentativas > 40) {
      clearInterval(esperarGoogle);
      atualizarFaixaDrive();
    }
  }, 500);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) verificarConexaoDrive(); });
  window.addEventListener("focus", verificarConexaoDrive);
  window.addEventListener("online", verificarConexaoDrive);
}

async function localizarArquivoNoDrive() {
  const query = `'${DRIVE_PASTA_ID}' in parents and name = '${DRIVE_NOME_ARQUIVO}' and trashed = false`;
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${driveAccessToken}` } }
  );
  if (!resp.ok) return null;
  const dados = await resp.json();
  return dados.files && dados.files[0] ? dados.files[0].id : null;
}

async function salvarNoDrive(objetoDados) {
  if (driveSincronizando) return false;
  if (!(await garantirTokenValido())) { drivePendente = true; atualizarFaixaDrive(); return false; }
  driveSincronizando = true;

  try {
    if (!driveArquivoId) {
      driveArquivoId = await localizarArquivoNoDrive();
      if (driveArquivoId) localStorage.setItem(CHAVE_DRIVE_ARQUIVO_ID, driveArquivoId);
    }

    const conteudo = JSON.stringify(objetoDados, null, 2);
    const metadados = driveArquivoId ? { name: DRIVE_NOME_ARQUIVO } : { name: DRIVE_NOME_ARQUIVO, parents: [DRIVE_PASTA_ID] };

    const boundary = "crmfreelancerlimite";
    const corpo =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadados) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      conteudo +
      `\r\n--${boundary}--`;

    const url = driveArquivoId
      ? `https://www.googleapis.com/upload/drive/v3/files/${driveArquivoId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const resp = await fetch(url, {
      method: driveArquivoId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${driveAccessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: corpo,
    });

    if (resp.status === 401) { // token revogado/expirado: renova e tenta de novo
      esquecerTokenDriveLocal();
      driveSincronizando = false;
      drivePendente = true;
      if (await garantirTokenValido()) return salvarNoDrive(objetoDados);
      return false;
    }
    if (!resp.ok) {
      drivePendente = true;
      atualizarStatusDrive("⚠️ Erro ao salvar no Drive");
      return false;
    }
    drivePendente = false;

    const resultado = await resp.json();
    if (!driveArquivoId) {
      driveArquivoId = resultado.id;
      localStorage.setItem(CHAVE_DRIVE_ARQUIVO_ID, driveArquivoId);
    }
    driveUltimoEnvio = new Date().toLocaleTimeString("pt-BR");
    atualizarStatusDrive();
    return true;
  } finally {
    driveSincronizando = false;
  }
}

async function carregarDoDrive() {
  if (!(await garantirTokenValido())) return null;
  if (!driveArquivoId) driveArquivoId = await localizarArquivoNoDrive();
  if (!driveArquivoId) return null;

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${driveArquivoId}?alt=media`, {
    headers: { Authorization: `Bearer ${driveAccessToken}` },
  });
  if (!resp.ok) return null;
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

async function sincronizarInicialComDrive() {
  // Na primeira conexão, se já existir um arquivo salvo no Drive mais completo
  // (mais clientes/orçamentos) do que o que está no navegador, pergunta o que fazer.
  const dadosDrive = await carregarDoDrive();
  if (dadosDrive && (dadosDrive.clientes?.length || dadosDrive.orcamentos?.length)) {
    const totalLocal = (ESTADO.clientes?.length || 0) + (ESTADO.orcamentos?.length || 0);
    const totalDrive = (dadosDrive.clientes?.length || 0) + (dadosDrive.orcamentos?.length || 0);
    if (totalDrive > totalLocal) {
      const usarDrive = confirm(
        "Foi encontrado um backup no Google Drive com mais dados do que este navegador. Deseja carregar os dados do Drive? (Cancelar mantém os dados atuais deste navegador)"
      );
      if (usarDrive) {
        ESTADO = dadosDrive;
        salvarDados(ESTADO);
        location.reload();
        return;
      }
    }
  }
  salvarNoDrive(ESTADO);
}

function agendarSincronizacaoComDrive() {
  if (!driveConectado() && !driveAutorizado()) return;
  drivePendente = true;
  clearTimeout(driveSalvandoTimeout);
  driveSalvandoTimeout = setTimeout(() => salvarNoDrive(ESTADO), 1500);
}

restaurarTokenDriveDaSessao();
// quem já conectou antes (arquivo do Drive conhecido) ou tem token vigente conta como autorizado
if (driveConectado() || (driveArquivoId && localStorage.getItem(CHAVE_DRIVE_AUTORIZADO) === null)) localStorage.setItem(CHAVE_DRIVE_AUTORIZADO, "1");
document.addEventListener("DOMContentLoaded", () => { atualizarStatusDrive(); iniciarMonitorDrive(); });
