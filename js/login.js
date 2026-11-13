/**
 * login.js
 * Tela de bloqueio com login do Google. Libera o acesso ao app apenas para o
 * e-mail autorizado abaixo. Isso NÃO é segurança forte (o site é estático e
 * público): serve como barreira de acesso casual, não como proteção de dados
 * sensíveis. Alguém com conhecimento técnico pode inspecionar o código e
 * contornar essa tela.
 */

// ⚠️ Substitua pelo Client ID gerado no Google Cloud Console
const GOOGLE_CLIENT_ID = "754936832886-6och1664ibcplfr4pdp8ls9ch420dhr0.apps.googleusercontent.com";

// Único e-mail autorizado a entrar
const EMAIL_AUTORIZADO = "hmisales@protonmail.com";

const CHAVE_SESSAO_LOGIN = "crm_freelancer_sessao_login";

function decodificarJwt(token) {
  const payload = token.split(".")[1];
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decodeURIComponent(escape(json)));
}

function aoReceberCredencialGoogle(resposta) {
  const dados = decodificarJwt(resposta.credential);
  const statusEl = document.getElementById("login-status");

  if (dados.email && dados.email.toLowerCase() === EMAIL_AUTORIZADO.toLowerCase()) {
    sessionStorage.setItem(CHAVE_SESSAO_LOGIN, JSON.stringify({ email: dados.email, nome: dados.name, em: Date.now() }));
    liberarAcesso();
  } else {
    statusEl.style.display = "block";
    statusEl.textContent = `⛔ Acesso negado. Esta conta (${dados.email}) não tem permissão para usar este CRM.`;
  }
}

function liberarAcesso() {
  const telaLogin = document.getElementById("tela-login");
  if (telaLogin) telaLogin.style.display = "none";
  document.querySelector(".app").style.display = "flex";
  esconderTelaCarregando();
}

function esconderTelaCarregando() {
  const tela = document.getElementById("tela-carregando");
  if (tela) tela.remove();
}

function sessaoValida() {
  try {
    const sessao = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO_LOGIN) || "null");
    return sessao && sessao.email?.toLowerCase() === EMAIL_AUTORIZADO.toLowerCase();
  } catch {
    return false;
  }
}

function inicializarLogin() {
  if (sessaoValida()) {
    liberarAcesso();
    return;
  }

  document.querySelector(".app").style.display = "none";

  const tela = document.createElement("div");
  tela.id = "tela-login";
  tela.innerHTML = `
    <div class="login-caixa">
      <div class="login-logo">CRM <span>Freelancer</span></div>
      <p>Acesso restrito. Entre com a conta Google autorizada.</p>
      <div id="google-botao-login"></div>
      <div id="login-status" class="aviso mei" style="display:none;"></div>
    </div>
  `;
  document.body.appendChild(tela);
  esconderTelaCarregando();

  renderizarBotaoGoogle();
}

function renderizarBotaoGoogle(tentativas) {
  tentativas = tentativas || 0;
  const alvo = document.getElementById("google-botao-login");
  if (!alvo) return; // tela de login já não existe mais (acesso liberado nesse meio tempo)

  if (GOOGLE_CLIENT_ID.indexOf("COLOQUE_SEU") !== -1) {
    alvo.innerHTML = `<p style="color:var(--cor-perigo);">Configuração de login pendente: defina GOOGLE_CLIENT_ID em js/login.js</p>`;
    return;
  }

  if (!window.google) {
    // O script do Google pode ainda estar carregando (ou foi bloqueado por
    // um bloqueador de anúncios/rastreadores). Tenta de novo por alguns segundos.
    if (tentativas < 20) {
      setTimeout(() => renderizarBotaoGoogle(tentativas + 1), 250);
    } else {
      alvo.innerHTML = `<p style="color:var(--cor-perigo);">Não foi possível carregar o login do Google. Verifique se algum bloqueador de anúncios/rastreadores (ex: Brave Shields) não está bloqueando accounts.google.com, e recarregue a página.</p>`;
    }
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: aoReceberCredencialGoogle,
  });
  google.accounts.id.renderButton(alvo, {
    theme: "filled_black",
    text: "signin_with",
    shape: "pill",
  });
}

async function sairDoSite() {
  if (ESTADO && ESTADO.cronometroAtivo && !confirm("Há um relógio rodando. Sair mesmo assim? (ele continua contando quando você voltar)")) return;
  // garante que o que foi alterado chegue ao Drive antes de sair
  try { if (typeof salvarNoDrive === "function" && driveConectado()) await salvarNoDrive(ESTADO); } catch {}
  try { if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect(); } catch {}
  if (typeof esquecerTokenDriveLocal === "function") esquecerTokenDriveLocal();
  sessionStorage.clear();
  location.reload();
}

document.addEventListener("DOMContentLoaded", inicializarLogin);
