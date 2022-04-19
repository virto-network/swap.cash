self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(handleRequest(e.request)));
self.addEventListener("message", ({ data: { port } }) => {
  port.onmessage = onResponse;
  workers.unshift(port);
});

const workers = [];
const pendingRequests = new Map();
const TIMEOUT = 5 * 1_000;
const txt = new TextEncoder();

const handleRequest = async (req) =>
  hasWhitelistedExt(new URL(req.url).pathname) ? fetch(req) : processInWorker(req);

const hasWhitelistedExt = (url) =>
  ["/", ".html", ".css", ".ico", ".js", ".wasm", ".json"].some((ext) =>
    url.endsWith(ext)
  );

const reqId = (method, url) => {
  let h = crypto.subtle.digest("SHA-1", txt.encode(method + url));
  return btoa(String.fromCharCode(...new Uint8Array(h)));
};

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));
const timeoutResponse = async (id) => {
  await timeout(TIMEOUT);
  pendingRequests.delete(id);
  return new Response("Request timed out", { status: 504 });
};

// transfer request to be processed by plugin worker
const processInWorker = async (req) => {
  let method = req.method,
    url = req.url,
    headers = [...req.headers],
    body = await req.arrayBuffer();
  let id = crypto.randomUUID();
  headers.push(["x-request-id", id]);
  workers[0]?.postMessage({ method, url, headers, body }, [body]);

  let resolve,
    response = new Promise((r) => {
      resolve = r;
    });
  pendingRequests.set(id, resolve);

  return Promise.race([timeoutResponse(id), response]);
};

// handle answers coming from plugin worker
const onResponse = async ({ data: id }) => {
  const resolve = pendingRequests.get(id);
  if (!resolve) {
    console.debug(`no matching request for ${id}`);
    return;
  }
  resolve(Response.redirect(`/?rid=${id}`, 303));
};
