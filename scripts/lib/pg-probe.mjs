import net from "node:net";

/**
 * @param {string} databaseUrl
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function probePostgres(databaseUrl, timeoutMs = 2000) {
  let host = "localhost";
  let port = 5432;

  try {
    const url = new URL(databaseUrl.replace(/^postgresql:/, "http:"));
    host = url.hostname || host;
    port = url.port ? Number(url.port) : port;
  } catch {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });

    socket.setTimeout(timeoutMs);
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
