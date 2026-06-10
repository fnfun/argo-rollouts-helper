# Argo Rollouts Promote Full Helper

> [English](README.md)

一个 Chrome 扩展，在 Argo Rollouts UI 中提供一键 **Promote Full** 模式：开关开启时，自动把 `PUT /api/v1/rollouts/{ns}/{name}/promote` 请求体里的 `{"full": false}` 改为 `{"full": true}`，等价于命令行的 `kubectl argo rollouts promote --full`。

⚠️ **Full promote 会跳过所有剩余 step 直接全量发布，是高危操作。** 横幅在开关开启时会变红闪烁，请谨慎使用。

---

## 功能

- 仅在用户配置的 URL 列表（默认预置 `https://argo-rollouts.example.com/*`）下生效，其它页面完全静默。
- 在生效页面顶部插入醒目横幅：
  - 关闭态：简洁白色/深色条（自动跟随系统主题），Argo 橙徽标，提示扩展已加载、不干预任何请求。
  - 开启态：整条变红 + 脉冲动画 + 警告文字，明确告知"FULL PROMOTE 已开启"。
- 拦截 `PUT /api/v1/rollouts/{namespace}/{name}/promote` 请求，重写请求体中的 `full` 字段。
- 仅处理 JSON 字符串 body，非 JSON 直接放行。
- 状态和配置通过 `chrome.storage.local` 持久化，多标签页同步。
- 提供扩展图标 popup，用于管理生效 URL 列表、查看当前页是否生效、快速切换开关。

## 安装

1. 打开 Chrome → `chrome://extensions/`
2. 右上角打开**开发者模式**
3. 点击**加载已解压的扩展程序**，选中本目录
4. 扩展加载完成后，点击工具栏上的扩展图标打开 popup：
   - 点**恢复默认**把 Argo 默认 URL 加入列表
   - 点**保存**
5. 刷新 `https://argo-rollouts.example.com/` 即可看到顶部横幅

## 使用

- **切换 Promote Full**：直接点击页面顶部横幅上的开关，或在扩展 popup 里切换。两处状态实时同步。
- **添加其他 URL**（如内部 staging 环境）：popup 里点**添加当前页** → **保存** → 刷新页面。
- **关闭后不留痕**：关闭开关后，所有 promote 请求恢复 Argo 默认行为，扩展不修改任何请求。

## 验证

打开 DevTools Network 面板，触发 Argo UI 的 `Promote` 按钮：

| 开关状态 | Request Payload |
| --- | --- |
| 关闭 | `{"full":false}` |
| 开启 | `{"full":true}` |

也可在 Console 直接测试：

```js
fetch('/api/v1/rollouts/foo/bar/promote', { method: 'PUT', body: '{"full":false}' });
```

开关开启时 Network 面板里这条请求的 payload 会被改成 `{"full":true}`。

## 工程结构

```
manifest.json          MV3 清单
src/
  content.js           隔离世界：URL 守门 + 横幅 UI + 状态同步
  inject.js            页面主世界：覆盖 fetch / XMLHttpRequest
  banner.css           横幅样式（含脉冲动画）
  popup.html/js/css    扩展图标 popup（配置 URL + 快捷开关）
icons/                 16/48/128 占位图标
```

## 已知限制 / 注意事项

- 修改 URL 模式配置后，**已经打开的页面不会自动重新注入或卸载**，需要手动刷新页面才能生效（popup 保存时会提示）。
- 扩展 `host_permissions` 申请了 `<all_urls>`（安装时 Chrome 会显示"读取所有网站数据"），但 content script 第一行就读 storage 判断 URL 不匹配立即 return，对非配置页面零副作用。
- 仅处理 JSON 字符串 body。当前 Argo UI 使用 JSON 提交 promote，无需处理 FormData / Blob。
- API 字段 `full` 硬编码在 `inject.js`；若 Argo 后端字段变化需手动更新。
