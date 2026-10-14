const STATUS_URL = "/api/status";
const DESKTOP_URL = "https://vmcomputer.enzonic.dev/vnc.html";
const REFRESH_MS = 60000;

const elements = {
  button: document.querySelector("#refresh"),
  link: document.querySelector("#open-desktop"),
  hint: document.querySelector("#open-hint"),
  indicator: document.querySelector("#status-indicator"),
  title: document.querySelector("#status-title"),
  detail: document.querySelector("#status-detail"),
  code: document.querySelector("#status-code"),
  checkedAt: document.querySelector("#checked-at")
};

const labels = {
  available: "Página disponível",
  unavailable: "Servidor indisponível",
  reset: "Conexão interrompida",
  timeout: "Sem resposta",
  unexpected: "Acesso não confirmado",
  error: "Falha na verificação"
};

let checking = false;
let lastAttempt = 0;

function present(result) {
  const state = Object.hasOwn(labels, result.state) ? result.state : "error";
  const canOpen = state === "available" && result.online === true && result.httpStatus === 200;
  const checkedAt = new Date(result.checkedAt);

  elements.title.textContent = labels[state];
  elements.detail.textContent = result.detail || "Não foi possível confirmar o estado do desktop.";
  elements.code.textContent = Number.isInteger(result.httpStatus) ? `HTTP ${result.httpStatus}` : "Sem resposta HTTP";
  elements.checkedAt.textContent = Number.isNaN(checkedAt.getTime()) ? "—" : checkedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  elements.indicator.className = `status-indicator is-${state}`;

  if (canOpen) {
    elements.link.href = DESKTOP_URL;
    elements.link.tabIndex = 0;
    elements.link.classList.remove("is-disabled");
    elements.link.removeAttribute("aria-disabled");
    elements.hint.textContent = "O noVNC solicitará a senha da sessão. O portal não armazena credenciais.";
  } else {
    elements.link.removeAttribute("href");
    elements.link.tabIndex = -1;
    elements.link.classList.add("is-disabled");
    elements.link.setAttribute("aria-disabled", "true");
    elements.hint.textContent = "O acesso só aparece quando a rota do desktop responde HTTP 200.";
  }
}

async function refreshStatus(force = false) {
  if (checking || (!force && Date.now() - lastAttempt < 30000)) return;
  lastAttempt = Date.now();
  checking = true;
  elements.button.disabled = true;
  elements.button.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(STATUS_URL, { cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("A verificação do portal falhou.");
    const result = await response.json();
    if (typeof result?.online !== "boolean" || typeof result?.state !== "string") {
      throw new Error("A resposta do portal é inválida.");
    }
    present(result);
  } catch {
    present({
      state: "error",
      online: false,
      httpStatus: null,
      checkedAt: new Date().toISOString(),
      detail: "O portal não conseguiu consultar o estado. Tente atualizar novamente."
    });
  } finally {
    checking = false;
    elements.button.disabled = false;
    elements.button.removeAttribute("aria-busy");
  }
}

elements.button.addEventListener("click", () => refreshStatus(true));
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshStatus(); });
setInterval(() => { if (!document.hidden) refreshStatus(); }, REFRESH_MS);
refreshStatus(true);
