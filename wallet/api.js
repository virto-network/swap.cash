const reqChan = new BroadcastChannel("req_channel");
const resChan = new BroadcastChannel("res_channel");

addEventListener("message", onMessage);
reqChan.addEventListener("message", onMessage);

const registry = new Map();

async function onMessage({ data: { meta, data } }) {
  switch (meta.plugin) {
    case undefined:
    case "_":
      switch (meta.action) {
        case "register":
          for (let { name, url, config } of data) {
            let mod = await import(url);
            if (mod._create) await mod._create(config);
            registry.set(name, mod);
          }
          console.info(
            `loaded ${registry.size} plugin${registry.size > 1 ? "s" : ""}`,
          );
      }
      break;
    default:
      let p = registry.get(meta.plugin);
      if (p && p[meta.action]) {
        let data = p[meta.action]();
        resChan.postMessage({ meta: { id: meta.id }, data });
      } else {
        resChan.postMessage({
          meta: { status: 404, id: meta.id },
          data: `${meta.plugin}->${meta.action} not found`,
        });
      }
  }
}
