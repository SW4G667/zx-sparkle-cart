const DESKTOP_URL = "https://vmcomputer.enzonic.dev/vnc.html";
const PROBE_TIMEOUT_MS = 4500;

function failureState(error) {
  const code = String(error?.cause?.code ?? error?.code ?? "").toUpperCase();
  const message = String(error?.cause?.message ?? error?.message ?? "");

  if (error?.name === "TimeoutError" || code === "ETIMEDOUT") {
    return {
      state: "timeout",
      detail: "A verificação expirou antes de receber uma resposta do servidor."
    };
  }
  if (["ECONNRESET", "UND_ERR_SOCKET", "EPIPE"].includes(code) || /socket hang up|connection reset/i.test(message)) {
    return {
      state: "reset",
      detail: "A conexão com o servidor foi interrompida antes da resposta."
    };
  }
  return {
    state: "error",
    detail: "Não foi possível consultar a página do desktop."
  };
}

export async function probeDesktop(fetcher = fetch, checkedAt = () => new Date()) {
  const timestamp = checkedAt().toISOString();

  try {
    const response = await fetcher(DESKTOP_URL, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    await response.body?.cancel().catch(() => {});

    if (response.status === 200) {
      return {
        state: "available",
        online: true,
        httpStatus: 200,
        checkedAt: timestamp,
        detail: "A página de acesso ao desktop respondeu HTTP 200."
      };
    }

    if ([502, 503, 504].includes(response.status)) {
      return {
        state: "unavailable",
        online: false,
        httpStatus: response.status,
        checkedAt: timestamp,
        detail: `A rota pública do desktop respondeu HTTP ${response.status}.`
      };
    }

    return {
      state: "unexpected",
      online: false,
      httpStatus: response.status,
      checkedAt: timestamp,
      detail: `A página do desktop respondeu HTTP ${response.status}; acesso ainda não confirmado.`
    };
  } catch (error) {
    return {
      ...failureState(error),
      online: false,
      httpStatus: null,
      checkedAt: timestamp
    };
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Método não permitido." });
  }

  const result = await probeDesktop();
  return response.status(200).json(result);
}
