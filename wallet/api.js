self.addEventListener("message", onMessage);

const CACHE = "x";
const registry = new Map();
const txt = new TextEncoder();
let chan;

const onRequest = async ({ data: req }) => {
  let output = await onMessage({ data: reqToMsg(req) });
  let headers = new Headers(req.headers);
  let cache = await caches.open(CACHE);

  let id = headers.get("x-request-id");
  let res = dataToResponse(output);
  cache.put(id, res);
  chan.postMessage(id);
};

const reqId = async (method, url) => {
  let h = await crypto.subtle.digest("SHA-1", txt.encode(method + url));
  return btoa(String.fromCharCode(...new Uint8Array(h)));
};

const dataToResponse = (data) => {
  if (!data) return Response.redirect(`/`, 303);
  if (typeof data == "string") return new Response(data);
  if (data instanceof ArrayBuffer) {
    return new Response(data, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  }
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

async function onMessage({ data: { plugin, action, meta, data } }) {
  switch (plugin) {
    case undefined:
    case "_":
      switch (action) {
        case "connect":
          chan = data;
          chan.onmessage = onRequest;
          break;
        case "register":
          for (let { name, url, config } of data) {
            let mod = await import(url);
            if (mod._create) await mod._create(config);
            registry.set(name, mod);
          }
          let s = registry.size;
          console.debug(`loaded ${s} plugin${s > 1 ? "s" : ""}`);
      }
      break;
    default:
      let p = registry.get(plugin);
      return p ? p[action]?.(data) : null;
  }
}

const reqToMsg = ({ method, url, headers, body }) => {
  let [plugin, action, params] = pluginAction(method, url);
  let meta = toObjLiteral(headers);
  meta.url = url;
  return {
    plugin,
    action,
    meta,
    data: method == "GET" || method == "HEAD" ? params : body,
  };
};

const pluginAction = (m, u) => {
  m = m == "POST" ? "create" : m.toLowerCase();
  let url = new URL(u);
  let path = url.pathname.replace("/", "").split("/");
  return [
    path.shift(),
    camelize([m, ...path].join(" ")),
    toObjLiteral(url.searchParams),
  ];
};

function camelize(str) {
  return str.replace(
    /(?:^\w|[A-Z]|\b\w)/g,
    (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase(),
  ).replace(/\s+/g, "");
}

function toObjLiteral(iter) {
  return [...iter].reduce((o, [k, v]) => {
    o[k] = v;
    return o;
  }, {});
}
