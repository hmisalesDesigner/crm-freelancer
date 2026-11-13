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

let driveTokenClient = null;
let driveAccessToken = null;
let driveTokenExpiraEm = 0;
let driveArquivoId = localStorage.getItem(CHAVE_DRIVE_ARQUIVO_ID) || null;
let driveSalvandoTimeout = null;
let driveSincronizando = false;

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

function atualizarStatusDrive(texto) {
  const el = document.getElementById("status-drive");
  if (el) el.textContent = texto;
  const elCfg = document.getElementById("drive-status-config");
  if (elCfg) elCfg.textContent = texto;
  atualizarBotaoDrive();
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
    atualizarStatusDrive("🔗 Conectado ao Google Drive — sincronizando...");
    sincronizarInicialComDrive();
  };
  driveTokenClient.requestAccessToken({ prompt: "consent" });
}

function garantirTokenValido() {
  if (driveConectado()) return Promise.resolve(true);
  return new Promise((resolve) => {
    inicializarDriveTokenClient();
    if (!driveTokenClient) return resolve(false);
    driveTokenClient.callback = (resposta) => {
      if (resposta.error) return resolve(false);
      driveAccessToken = resposta.access_token;
      driveTokenExpiraEm = Date.now() + (resposta.expires_in - 60) * 1000;
      salvarTokenDriveNaSessao();
      resolve(true);
    };
    driveTokenClient.requestAccessToken({ prompt: "" });
  });
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
  if (!(await garantirTokenValido())) return false;
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

    if (!resp.ok) {
      atualizarStatusDrive("⚠️ Erro ao salvar no Drive");
      return false;
    }

    const resultado = await resp.json();
    if (!driveArquivoId) {
      driveArquivoId = resultado.id;
      localStorage.setItem(CHAVE_DRIVE_ARQUIVO_ID, driveArquivoId);
    }
    atualizarStatusDrive("☁️ Salvo no Google Drive — " + new Date().toLocaleTimeString("pt-BR"));
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
  if (!driveConectado()) return;
  clearTimeout(driveSalvandoTimeout);
  driveSalvandoTimeout = setTimeout(() => salvarNoDrive(ESTADO), 1500);
}

restaurarTokenDriveDaSessao();
