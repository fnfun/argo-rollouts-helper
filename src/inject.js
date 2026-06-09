(() => {
  if (window.__ARGO_HELPER_INJECTED__) return;
  window.__ARGO_HELPER_INJECTED__ = true;

  const PROMOTE_PATH = /^\/api\/v1\/rollouts\/[^/]+\/[^/]+\/promote$/;
  const LOG_PREFIX = '[ArgoHelper]';
  let enabled = false;

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data;
    if (data && data.type === 'ARGO_HELPER_STATE') {
      enabled = !!data.enabled;
    }
  });

  window.postMessage({ type: 'ARGO_HELPER_INJECT_READY' }, '*');

  function shouldIntercept(url, method) {
    if (!enabled) return false;
    if ((method || 'GET').toUpperCase() !== 'PUT') return false;
    if (!url) return false;
    try {
      const u = new URL(url, location.href);
      return PROMOTE_PATH.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  function rewriteBody(body) {
    if (typeof body !== 'string') {
      try {
        console.warn(LOG_PREFIX, '非字符串 body，跳过改写', body);
      } catch (_) {}
      return body;
    }
    try {
      const obj = JSON.parse(body);
      if (obj && obj.full === false) {
        obj.full = true;
        const next = JSON.stringify(obj);
        try {
          console.warn(LOG_PREFIX, 'promote 已改写为 full:true');
        } catch (_) {}
        return next;
      }
      return body;
    } catch (_) {
      return body;
    }
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const initObj = init || {};
    let url;
    let method;
    if (typeof input === 'string') {
      url = input;
      method = initObj.method || 'GET';
    } else if (input instanceof Request) {
      url = input.url;
      method = initObj.method || input.method || 'GET';
    } else if (input && typeof input.url === 'string') {
      url = input.url;
      method = initObj.method || 'GET';
    }

    if (!shouldIntercept(url, method)) {
      return origFetch(input, init);
    }

    if (input instanceof Request) {
      return input
        .clone()
        .text()
        .then((text) => {
          const newBody = rewriteBody(text);
          const newReq = new Request(input, { body: newBody });
          return origFetch(newReq);
        });
    }

    const nextInit = Object.assign({}, initObj, { body: rewriteBody(initObj.body) });
    return origFetch(input, nextInit);
  };

  const OrigXHR = window.XMLHttpRequest;
  if (OrigXHR && OrigXHR.prototype) {
    const origOpen = OrigXHR.prototype.open;
    const origSend = OrigXHR.prototype.send;
    OrigXHR.prototype.open = function (method, url) {
      try {
        this.__argoHelperMeta = { method: method, url: url };
      } catch (_) {}
      return origOpen.apply(this, arguments);
    };
    OrigXHR.prototype.send = function (body) {
      const meta = this.__argoHelperMeta;
      if (meta && shouldIntercept(meta.url, meta.method)) {
        const newBody = rewriteBody(body);
        return origSend.call(this, newBody);
      }
      return origSend.apply(this, arguments);
    };
  }
})();
