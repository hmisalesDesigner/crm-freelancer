/**
 * login.js
 * Tela de bloqueio com login do Google. Libera o acesso ao app apenas para o
 * e-mail autorizado abaixo. Isso NÃO é segurança forte (o site é estático e
 * público): serve como barreira de acesso casual, não como proteção de dados
 * sensíveis. Alguém com conhecimento técnico pode inspecionar o código e
 * contornar essa tela.
 */

// ⚠️ Substitua pelo Client ID gerado no Google Cloud Console
const GOOGLE_CLIENT_ID = "COLOQUE_SEU_CLIENT_ID_AQUI.apps.googleusercontent.com";

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
  document.getElementById("tela-login").style.display = "none";
  document.querySelector(".app").style.display = "flex";
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

  if (window.google && GOOGLE_CLIENT_ID.indexOf("COLOQUE_SEU") === -1) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: aoReceberCredencialGoogle,
    });
    google.accounts.id.renderButton(document.getElementById("google-botao-login"), {
      theme: "filled_black",
      text: "signin_with",
      shape: "pill",
    });
  } else {
    document.getElementById("google-botao-login").innerHTML =
      `<p style="color:var(--cor-perigo);">Configuração de login pendente: defina GOOGLE_CLIENT_ID em js/login.js</p>`;
  }
}

document.addEventListener("DOMContentLoaded", inicializarLogin);
