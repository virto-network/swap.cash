self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(handleRequest(e.request)));

const hasWhitelistedExt = (url) =>
  ["/", ".html", ".css", ".ico", ".js", ".wasm", ".json"].some((ext) =>
    url.endsWith(ext)
  );

const toObjLiteral = (iter) =>
  [...iter].reduce((o, [k, v]) => {
    o[k] = v;
    return o;
  }, {});

const pluginAction = (m, u) => {
  m = m == "POST" ? "create" : m;
  let url = new URL(u);
  let path = url.pathname.replace("/", "").split("/");
  return [
    path.shift(),
    camelize([m.toLowerCase(), ...path].join(" ")),
    toObjLiteral(url.searchParams),
  ];
};

const reqToTransferable = async (req) => {
  let [plugin, action, params] = pluginAction(req.method, req.url);
  let msg = {
    meta: { plugin, action, ...toObjLiteral(req.headers) },
  };
  msg.data = req.method == "GET" || req.method == "HEAD"
    ? params
    : await req.arrayBuffer();
  return msg;
};

const handleRequest = (req) =>
  hasWhitelistedExt(req.url) ? fetch(req) : broadcastAndWaitResponse(req);

const TIMEOUT = 5000;
const timeout = (ms) => new Promise((res) => setTimeout(res, ms));
const timeoutResponse = (id) =>
  timeout(TIMEOUT).then(() => {
    pendingRequests.delete(id);
    return new Response("Timeout!", { status: 504 });
  });

async function broadcastAndWaitResponse(req) {
  let msg = await reqToTransferable(req);
  const id = uuidv4();
  msg.meta.id = id;

  reqChan.postMessage(msg);

  let resolve;
  const response = new Promise((r) => {
    resolve = r;
  });
  pendingRequests.set(id, resolve);

  return Promise.race([timeoutResponse(id), response]);
}

const reqChan = new BroadcastChannel("req_channel");
const resChan = new BroadcastChannel("res_channel");
const pendingRequests = new Map();

resChan.onmessage = ({ data }) => {
  const id = data?.meta?.id;
  if (!id) {
    console.debug("request without id");
    return;
  }
  delete data.meta.id;

  const resolve = pendingRequests.get(id);
  if (!resolve) {
    console.debug(`no matching request for ${id}`);
    return;
  }

  resolve(new Response(data.data, { ...data.meta }));
};

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
    /[018]/g,
    (c) =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(
        16,
      ),
  );
}

function camelize(str) {
  return str.replace(
    /(?:^\w|[A-Z]|\b\w)/g,
    (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase(),
  ).replace(/\s+/g, "");
}
