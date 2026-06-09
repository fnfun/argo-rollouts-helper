(() => {
  const KEY_PATTERNS = 'urlPatterns';
  const KEY_ENABLED = 'promoteFullEnabled';

  function urlMatches(url, pattern) {
    if (!url || !pattern) return false;
    try {
      const re = new RegExp(
        '^' +
          pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') +
          '$'
      );
      return re.test(url);
    } catch (_) {
      return false;
    }
  }

  let enabled = false;

  function postState() {
    window.postMessage({ type: 'ARGO_HELPER_STATE', enabled: enabled }, '*');
  }

  function mountBanner() {
    if (document.getElementById('argo-helper-banner')) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', mountBanner, { once: true });
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'argo-helper-banner';
    banner.innerHTML =
      '<span class="argo-helper-icon" aria-hidden="true">⚠️</span>' +
      '<span class="argo-helper-text">Argo Rollouts Helper</span>' +
      '<label class="argo-helper-switch">' +
      '  <input type="checkbox" id="argo-helper-toggle" />' +
      '  <span class="argo-helper-slider" aria-hidden="true"></span>' +
      '  <span class="argo-helper-label">Promote Full 模式</span>' +
      '</label>' +
      '<span class="argo-helper-warning">⚠️ 已开启 FULL PROMOTE,所有 Promote 操作将直接全量发布,跳过剩余 step!</span>' +
      '<span class="argo-helper-hint">关闭时不干预请求</span>';

    document.body.prepend(banner);
    document.body.classList.add('argo-helper-page');

    const toggle = banner.querySelector('#argo-helper-toggle');
    toggle.checked = enabled;
    toggle.addEventListener('change', () => {
      const next = toggle.checked;
      chrome.storage.local.set({ [KEY_ENABLED]: next });
    });

    updateBanner();
  }

  function updateBanner() {
    const banner = document.getElementById('argo-helper-banner');
    if (!banner) return;
    banner.classList.toggle('argo-helper-active', enabled);
    const toggle = banner.querySelector('#argo-helper-toggle');
    if (toggle && toggle.checked !== enabled) {
      toggle.checked = enabled;
    }
  }

  function injectMainWorldScript() {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('src/inject.js');
    s.async = false;
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }

  (async () => {
    let store;
    try {
      store = await chrome.storage.local.get([KEY_PATTERNS, KEY_ENABLED]);
    } catch (_) {
      return;
    }

    const patterns = Array.isArray(store[KEY_PATTERNS]) ? store[KEY_PATTERNS] : [];
    enabled = !!store[KEY_ENABLED];

    if (!patterns.some((p) => urlMatches(location.href, p))) {
      return;
    }

    injectMainWorldScript();

    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const data = e.data;
      if (data && data.type === 'ARGO_HELPER_INJECT_READY') {
        postState();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[KEY_ENABLED]) {
        enabled = !!changes[KEY_ENABLED].newValue;
        postState();
        updateBanner();
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountBanner, { once: true });
    } else {
      mountBanner();
    }
  })();
})();
