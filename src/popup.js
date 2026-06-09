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

  function renderMatch(matched) {
    const el = document.getElementById('current-match');
    el.textContent = matched ? '✅ 已生效' : '⚠️ 当前页未在生效列表';
    el.classList.toggle('matched', matched);
    el.classList.toggle('unmatched', !matched);
  }

  function setHint(msg, isError) {
    const hint = document.getElementById('save-hint');
    hint.textContent = msg || '';
    hint.classList.toggle('error', !!isError);
  }

  async function load() {
    const [store, tab] = await Promise.all([
      chrome.storage.local.get([KEY_PATTERNS, KEY_ENABLED]),
      getActiveTab(),
    ]);

    const patterns = Array.isArray(store[KEY_PATTERNS]) ? store[KEY_PATTERNS] : [];
    const enabled = !!store[KEY_ENABLED];

    document.getElementById('patterns').value = patterns.join('\n');
    document.getElementById('enable-toggle').checked = enabled;

    const tabUrl = tab && tab.url ? tab.url : '(无活动标签页)';
    document.getElementById('current-url').textContent = tabUrl;
    const matched = patterns.some((p) => urlMatches(tabUrl, p));
    renderMatch(matched);

    document.getElementById('add-current').addEventListener('click', () => {
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
        const ta = document.getElementById('patterns');
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

    document.getElementById('reset-default').addEventListener('click', () => {
      const ta = document.getElementById('patterns');
      const cur = parseList(ta.value);
      if (!cur.includes(DEFAULT_PATTERN)) {
        ta.value = [...cur, DEFAULT_PATTERN].join('\n');
        setHint('已追加默认模式，记得点保存');
      } else {
        setHint('默认模式已在列表中');
      }
    });

    document.getElementById('enable-toggle').addEventListener('change', async (e) => {
      try {
        await chrome.storage.local.set({ [KEY_ENABLED]: e.target.checked });
      } catch (err) {
        setHint('开关状态保存失败', true);
      }
    });

    document.getElementById('save').addEventListener('click', async () => {
      const list = parseList(document.getElementById('patterns').value);
      try {
        await chrome.storage.local.set({ [KEY_PATTERNS]: list });
        const matchedNow = list.some((p) => urlMatches(tabUrl, p));
        renderMatch(matchedNow);
        setHint('已保存。已打开的页面需刷新才能生效。');
      } catch (err) {
        setHint('保存失败：' + (err && err.message), true);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', load);
})();
