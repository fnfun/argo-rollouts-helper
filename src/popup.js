(() => {
  const KEY_PATTERNS = 'urlPatterns';
  const KEY_ENABLED = 'promoteFullEnabled';
  const DEFAULT_PATTERN = 'https://argo-rollouts.example.com/*';

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

  function parseList(text) {
    return text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function getActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs && tabs[0];
    } catch (_) {
      return null;
    }
  }

  const $ = (id) => document.getElementById(id);

  function prettyUrl(url) {
    if (!url) return '—';
    try {
      const u = new URL(url);
      return u.host + (u.pathname === '/' ? '' : u.pathname);
    } catch (_) {
      return url;
    }
  }

  // Reflect both the match status and the armed (enabled) status in the UI.
  function render(matched, enabled) {
    // match badge
    const badge = $('current-match');
    badge.textContent = matched ? '已生效' : '未在列表';
    badge.dataset.state = matched ? 'matched' : 'unmatched';

    // control card armed state
    $('control').classList.toggle('armed', enabled);
    $('enable-toggle').checked = enabled;

    // header status light
    const light = $('status-light');
    const label = $('status-label');
    if (!matched) {
      light.dataset.state = 'idle';
      label.textContent = '未生效';
    } else if (enabled) {
      light.dataset.state = 'armed';
      label.textContent = 'FULL 已武装';
    } else {
      light.dataset.state = 'matched';
      label.textContent = '已生效 · 安全';
    }
  }

  function setHint(msg, isError) {
    const hint = $('save-hint');
    hint.textContent = msg || '';
    hint.classList.toggle('error', !!isError);
  }

  async function load() {
    const [store, tab] = await Promise.all([
      chrome.storage.local.get([KEY_PATTERNS, KEY_ENABLED]),
      getActiveTab(),
    ]);

    let patterns = Array.isArray(store[KEY_PATTERNS]) ? store[KEY_PATTERNS] : [];
    const enabled = !!store[KEY_ENABLED];

    $('patterns').value = patterns.join('\n');

    const tabUrl = tab && tab.url ? tab.url : '';
    $('current-url').textContent = tabUrl ? prettyUrl(tabUrl) : '(无活动标签页)';
    $('current-url').title = tabUrl;

    let matched = patterns.some((p) => urlMatches(tabUrl, p));
    render(matched, enabled);

    // Open advanced automatically if nothing is configured yet.
    if (patterns.length === 0) $('adv').open = true;

    $('enable-toggle').addEventListener('change', async (e) => {
      const next = e.target.checked;
      render(matched, next);
      try {
        await chrome.storage.local.set({ [KEY_ENABLED]: next });
      } catch (_) {
        setHint('开关状态保存失败', true);
      }
    });

    $('add-current').addEventListener('click', () => {
      if (!tab || !tab.url) {
        setHint('无法读取当前标签页 URL', true);
        return;
      }
      try {
        const u = new URL(tab.url);
        if (!/^https?:$/.test(u.protocol)) {
          setHint('仅支持 http/https 协议页面', true);
          return;
        }
        const pattern = `${u.protocol}//${u.host}/*`;
        const ta = $('patterns');
        const cur = parseList(ta.value);
        if (cur.includes(pattern)) {
          setHint('该模式已存在');
          return;
        }
        ta.value = [...cur, pattern].join('\n');
        setHint('已添加，记得点保存');
      } catch (_) {
        setHint('当前 URL 解析失败', true);
      }
    });

    $('reset-default').addEventListener('click', () => {
      const ta = $('patterns');
      const cur = parseList(ta.value);
      if (!cur.includes(DEFAULT_PATTERN)) {
        ta.value = [...cur, DEFAULT_PATTERN].join('\n');
        setHint('已追加默认模式，记得点保存');
      } else {
        setHint('默认模式已在列表中');
      }
    });

    $('save').addEventListener('click', async () => {
      patterns = parseList($('patterns').value);
      try {
        await chrome.storage.local.set({ [KEY_PATTERNS]: patterns });
        matched = patterns.some((p) => urlMatches(tabUrl, p));
        render(matched, $('enable-toggle').checked);
        setHint('已保存 · 已打开的页面需刷新才能生效');
      } catch (err) {
        setHint('保存失败：' + (err && err.message), true);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', load);
})();
