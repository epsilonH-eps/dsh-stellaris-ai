# dsh-stellaris-ai

DSH 插件：给「群星 AI」做一页设置（设置 → 群星 AI）。

## 这一版做了什么

- **10 个多维倾向滑块**（0-100）：侵略性 / 大胆 / 谨慎 / 荣誉 / 外交 / 扩张 / 经济 / 科研 / 军事 / 共情；
  每个滑块下面会跟着数值变化显示「偏低的解释 / 平衡 / 偏高的解释」。
- **人格文本**：名字、头衔、身份、来路、价值观（每行一条）、小毛病（每行一条）。
- **说话方式**：风格、声音、语言、每句最多字数、示例台词。
- **人格预设**：均衡 / 征服者 / 守成者 / 外交家 / 求知者 / 工业家 / 狂热者，一键套用。
- **system prompt 预览**：直接看拼出来的「人格段」，和 A 仓的 personaPrompt 措辞一致。
- 保存到 `~/.dsh/stellaris-ai/config.json`，供后续 agent / 工具读取。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/stellaris-ai/config` | 当前人格 + 倾向元数据 + 预设 + prompt |
| POST | `/api/stellaris-ai/config` | `{ persona }` 保存（部分字段也行） |
| POST | `/api/stellaris-ai/preset` | `{ id }` 套用预设 |
| GET | `/api/stellaris-ai/prompt` | 只取渲染后的 prompt |

## 安装

```powershell
# 1. 链接进 DSH profile
cd $env:USERPROFILE\.dsh\profiles\desktop
# package.json 的 dependencies 加 "dsh-stellaris-ai": "link:D:/paradox-dsh-bridge/dsh-stellaris-ai"
# 并在 dsh.profile.bundles 里追加 "dsh-stellaris-ai"
# 2. 建链接
New-Item -ItemType Junction -Path node_modules\dsh-stellaris-ai -Target D:\paradox-dsh-bridge\dsh-stellaris-ai
# 3. 重启 DSH
```

## 数据来源

人格结构、10 个倾向、预设文案借自 `stellaris-agent/agent/lib/persona.mjs`（MIT）；
本插件只保留设置页需要的部分，不依赖 A 仓运行。
