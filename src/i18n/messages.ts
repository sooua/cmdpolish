// Translation dictionaries. `en` is the source of truth for keys; other locales
// fall back to `en` for any missing key. Use {var} placeholders for interpolation.

export const messages = {
  en: {
    "pane.input": "Input",
    "pane.output": "Output",
    "pane.inputHint": "paste command / code / config",
    "pane.outputEmpty": "Formatted output appears here",

    "banner.needAi":
      "Configure AI before formatting. Set Provider / Model / API Key and turn on “Format with AI”.",
    "banner.configAi": "Configure AI",

    "tab.security": "Security",
    "tab.warnings": "Warnings",
    "tab.ai": "Assistant",

    "overlay.generating": "Generating…",
    "warnings.none": "No warnings.",
    "warnings.truncated":
      "Output was cut off at the model's max length. Split the input into smaller parts, or switch to a model with a larger output limit (e.g. Claude).",

    "ai.panel.processing": "Working…",
    "ai.panel.error": "AI error: {msg}",
    "ai.panel.empty":
      "Run Explain, Steps, Rollback and other tasks from the “AI Actions” toolbar button — results show here.",
    "common.clear": "Clear",
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",
    "common.continue": "Continue",

    "toolbar.format": "Format",
    "toolbar.formatAi": "Format (AI)",
    "toolbar.redact": "Redact",
    "toolbar.copy": "Copy",
    "toolbar.copyMd": "Copy as Markdown",
    "toolbar.clear": "Clear",
    "toolbar.copied": "Copied output",
    "toolbar.copiedMd": "Copied as Markdown",
    "toolbar.copyFailed": "Copy failed",

    "aiMenu.useAi": "Format with AI",
    "aiMenu.useAiHint":
      "When on, “Format” uses AI. Provider / Model / API Key must be set.",
    "aiMenu.provider": "Provider",
    "aiMenu.localNoKey": "(not needed for local)",
    "aiMenu.apiKeyLocal": "(leave blank for local)",
    "aiMenu.test": "Test connection",
    "aiMenu.fail": "Failed",
    "aiMenu.cloudWarn":
      "Cloud provider: you’ll be asked to confirm before sending content with secrets.",

    "aiActions.title": "AI Actions",
    "aiActions.needProvider": "Configure a Provider under “AI” (top right) first.",

    "settings.title": "Settings",
    "settings.redaction": "Redaction",
    "settings.redactMode": "Redaction mode",
    "settings.redactEmail": "Redact emails",
    "settings.redactIp": "Redact IP addresses",
    "settings.autoDetect": "Auto-detect language",
    "settings.general": "General",
    "settings.language": "Language",
    "settings.fontSize": "Editor font size",
    "updates.title": "Updates",
    "updates.version": "Version {v}",
    "updates.check": "Check for updates",
    "updates.checking": "Checking…",
    "updates.upToDate": "You're on the latest version.",
    "updates.available": "Update available: v{v}",
    "updates.install": "Download & install",
    "updates.installing": "Downloading… {pct}",
    "updates.restartNote": "The app restarts to finish updating.",
    "updates.failed": "Update check failed: {msg}",
    "updates.badge": "Update",
    "settings.shortcuts": "Shortcuts",
    "shortcut.recording": "Press keys…",
    "shortcut.reset": "Reset to defaults",
    "shortcut.hint": "Click a shortcut to rebind (must include Ctrl/⌘).",

    "redactMode.preserve": "Preserve ends (re_TFB…d1xi)",
    "redactMode.placeholder": "Placeholder (<API_KEY>)",

    "security.allClean": "No dangerous commands or secrets found.",
    "security.riskCount": "{label} · {n} finding(s)",
    "security.redactedCount": "Redacted {n} secret(s)",
    "security.redactHint": "Click “Redact” in the toolbar to scan and mask secrets.",

    "risk.none": "No risk",
    "risk.low": "Low risk",
    "risk.medium": "Medium risk",
    "risk.high": "High risk",
    "risk.critical": "Critical risk",

    "history.title": "History",
    "history.search": "Search…",
    "history.empty": "No saved snippets yet.",
    "history.redacted": "redacted",
    "history.duration": "Formatting time",
    "history.clearConfirm": "Clear all history?",
    "history.restore": "Restore",
    "history.delete": "Delete",
    "history.clearAll": "Clear all",

    "time.justNow": "just now",
    "time.mAgo": "{n}m ago",
    "time.hAgo": "{n}h ago",
    "time.dAgo": "{n}d ago",

    "task.explain.label": "Explain this command",
    "task.explain.hint": "Step-by-step, with side effects",
    "task.rollback.label": "Generate rollback",
    "task.rollback.hint": "Commands to undo the operation",
    "task.precheck.label": "Generate pre-checks",
    "task.precheck.hint": "Commands to verify before running",

    "confirm.cloudSecrets":
      "Secrets detected and the provider is cloud-based. Continuing sends the raw content to the cloud. Continue?",
    "ai.notConfigured":
      "AI is not configured. Set Provider / Model / API Key under “AI” (top right) and turn on “Format with AI”.",
    "ai.callFailed": "AI call failed: {msg}",
    "win.minimize": "Minimize",
    "win.maximize": "Maximize",
    "win.close": "Close",
  },

  zh: {
    "pane.input": "输入",
    "pane.output": "输出",
    "pane.inputHint": "粘贴命令 / 代码 / 配置",
    "pane.outputEmpty": "格式化结果会显示在这里",

    "banner.needAi":
      "需要先配置 AI 才能格式化。填好 Provider / Model / API Key 并开启「用 AI 格式化」。",
    "banner.configAi": "配置 AI",

    "tab.security": "安全",
    "tab.warnings": "警告",
    "tab.ai": "助手",

    "overlay.generating": "生成中…",
    "warnings.none": "没有警告。",
    "warnings.truncated":
      "输出已达模型单次最大长度被截断。请将输入拆分成更小的部分，或改用支持更长输出的模型（如 Claude）。",

    "ai.panel.processing": "处理中…",
    "ai.panel.error": "AI 错误:{msg}",
    "ai.panel.empty":
      "从工具栏「AI 操作」运行解释、生成步骤、生成回滚等任务,结果会显示在这里。",
    "common.clear": "清除",
    "common.confirm": "确定",
    "common.cancel": "取消",
    "common.continue": "继续",

    "toolbar.format": "格式化",
    "toolbar.formatAi": "格式化 (AI)",
    "toolbar.redact": "脱敏",
    "toolbar.copy": "复制",
    "toolbar.copyMd": "复制为 Markdown",
    "toolbar.clear": "清空",
    "toolbar.copied": "已复制输出",
    "toolbar.copiedMd": "已复制为 Markdown",
    "toolbar.copyFailed": "复制失败",

    "aiMenu.useAi": "用 AI 格式化",
    "aiMenu.useAiHint": "开启后「格式化」走 AI;必须配置好 Provider / Model / API Key。",
    "aiMenu.provider": "Provider",
    "aiMenu.localNoKey": "(本地无需)",
    "aiMenu.apiKeyLocal": "(本地 Provider 可留空)",
    "aiMenu.test": "测试连接",
    "aiMenu.fail": "失败",
    "aiMenu.cloudWarn": "云端 Provider:含密钥的内容发送前会弹窗确认。",

    "aiActions.title": "AI 操作",
    "aiActions.needProvider": "请先在右上角「AI」中配置 Provider。",

    "settings.title": "设置",
    "settings.redaction": "脱敏",
    "settings.redactMode": "脱敏模式",
    "settings.redactEmail": "脱敏邮箱",
    "settings.redactIp": "脱敏 IP 地址",
    "settings.autoDetect": "自动识别语言",
    "settings.general": "通用",
    "settings.language": "语言",
    "settings.fontSize": "编辑器字体大小",
    "updates.title": "更新",
    "updates.version": "版本 {v}",
    "updates.check": "检查更新",
    "updates.checking": "检查中…",
    "updates.upToDate": "已是最新版本。",
    "updates.available": "有可用更新:v{v}",
    "updates.install": "下载并安装",
    "updates.installing": "下载中… {pct}",
    "updates.restartNote": "安装后将重启应用完成更新。",
    "updates.failed": "检查更新失败:{msg}",
    "updates.badge": "更新",
    "settings.shortcuts": "快捷键",
    "shortcut.recording": "按下按键…",
    "shortcut.reset": "恢复默认",
    "shortcut.hint": "点击快捷键可重新绑定(需含 Ctrl/⌘)。",

    "redactMode.preserve": "保留前后缀 (re_TFB…d1xi)",
    "redactMode.placeholder": "占位符 (<API_KEY>)",

    "security.allClean": "未发现危险命令或敏感信息。",
    "security.riskCount": "{label} · {n} 项",
    "security.redactedCount": "已脱敏 {n} 处敏感信息",
    "security.redactHint": "点击工具栏「脱敏」可扫描并脱敏敏感信息。",

    "risk.none": "无风险",
    "risk.low": "低风险",
    "risk.medium": "中风险",
    "risk.high": "高风险",
    "risk.critical": "严重风险",

    "history.title": "历史记录",
    "history.search": "搜索…",
    "history.empty": "还没有保存的记录。",
    "history.redacted": "已脱敏",
    "history.duration": "格式化用时",
    "history.clearConfirm": "清空全部历史?",
    "history.restore": "恢复",
    "history.delete": "删除",
    "history.clearAll": "清空全部",

    "time.justNow": "刚刚",
    "time.mAgo": "{n} 分钟前",
    "time.hAgo": "{n} 小时前",
    "time.dAgo": "{n} 天前",

    "task.explain.label": "解释这段命令",
    "task.explain.hint": "逐步说明,含副作用",
    "task.rollback.label": "生成回滚命令",
    "task.rollback.hint": "撤销该操作的命令",
    "task.precheck.label": "生成执行前检查",
    "task.precheck.hint": "执行前应先验证的命令",

    "confirm.cloudSecrets":
      "检测到敏感信息,且当前为云端 Provider。继续会把原文发送到云端,是否继续?",
    "ai.notConfigured":
      "尚未配置 AI。请在右上角「AI」中填好 Provider / Model / API Key 并开启「用 AI 格式化」。",
    "ai.callFailed": "AI 调用失败:{msg}",
    "win.minimize": "最小化",
    "win.maximize": "最大化",
    "win.close": "关闭",
  },
} as const;

export type Locale = keyof typeof messages;
export type MsgKey = keyof (typeof messages)["en"];

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];
