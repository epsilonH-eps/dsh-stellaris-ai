/**
 * dsh-stellaris-ai —— 浏览器半端（设置 →「群星 AI」一页）。
 *
 * 约定（与 dsh-bili-subagent 相同）：
 *   window.__ModuleLoader__.load({ id: '<包名>', factory: (require) => ({ inject, apply }) })
 *   apply 里 slots.inject('settings.section', ...) 注册左侧导航里的「群星 AI」。
 */
window.__ModuleLoader__.load({
  id: 'dsh-stellaris-ai',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const API = '/api/stellaris-ai'

    const asJson = async (res) => {
      if (res.ok) return res.json()
      throw new Error('HTTP ' + res.status)
    }
    const jget = async (path) => asJson(await fetch(API + path, { credentials: 'same-origin' }))
    const jpost = async (path, body) =>
      asJson(
        await fetch(API + path, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body || {}),
        }),
      )

    const CSS = `
[data-sa-page]{display:flex;flex-direction:column;gap:18px;padding:2px 2px 12px;max-width:680px;}
[data-sa-sec]{display:flex;flex-direction:column;gap:10px;}
[data-sa-h]{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sa-row]{display:flex;align-items:center;gap:10px;}
[data-sa-label]{font-size:13px;min-width:58px;}
[data-sa-val]{font-size:12px;width:36px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#c0c4cc);}
[data-sa-range]{flex:1;accent-color:#3b82f6;height:18px;}
[data-sa-hint]{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#9aa0a6);margin:-2px 0 2px 68px;}
[data-sa-input]{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;font-size:12px;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.12));color:inherit;font-family:inherit;}
[data-sa-input]:focus{outline:none;border-color:#3b82f6;}
[data-sa-textarea]{min-height:64px;resize:vertical;line-height:1.55;}
[data-sa-grid]{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
[data-sa-btn]{padding:7px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.14));color:inherit;}
[data-sa-btn]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.24));}
[data-sa-btn][data-primary]{background:#3b82f6;border-color:#3b82f6;color:#fff;}
[data-sa-btn][disabled]{opacity:.5;cursor:default;}
[data-sa-msg]{font-size:11px;line-height:16px;padding:7px 9px;border-radius:8px;word-break:break-all;
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.12));color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sa-msg][data-good]{color:#22c55e;}
[data-sa-msg][data-warn]{color:#f59e0b;}
[data-sa-pre]{font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.6;white-space:pre-wrap;
  word-break:break-word;max-height:320px;overflow:auto;padding:10px 12px;border-radius:8px;
  background:rgba(127,127,127,.10);color:var(--dsw-alias-label-secondary,#c0c4cc);}
[data-sa-tip]{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sa-tag]{display:inline-block;padding:1px 6px;border-radius:5px;font-size:10px;margin-left:6px;
  background:rgba(59,130,246,.15);color:#7db4ff;}
`

    const toLines = (text) =>
      String(text || '')
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean)
    const fromLines = (rows) => (Array.isArray(rows) ? rows.join('\n') : '')

    function Slider({ trait, value, onChange }) {
      const number = Number(value) || 0
      const hint = number >= 70 ? trait.high : number <= 30 ? trait.low : '保持平衡，按局势调整'
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h(
          'div',
          { 'data-sa-row': '' },
          h('div', { 'data-sa-label': '' }, trait.label),
          h('input', {
            'data-sa-range': '',
            type: 'range',
            min: 0,
            max: 100,
            step: 1,
            value: number,
            onChange: (event) => onChange(Number(event.target.value)),
          }),
          h('div', { 'data-sa-val': '' }, number),
        ),
        h('div', { 'data-sa-hint': '' }, hint),
      )
    }

    function Panel() {
      const [state, setState] = React.useState(null)
      const [persona, setPersona] = React.useState(null)
      const [msg, setMsg] = React.useState('')
      const [msgTone, setMsgTone] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [prompt, setPrompt] = React.useState('')

      React.useEffect(() => {
        jget('/config')
          .then((data) => {
            setState(data)
            setPersona(data.persona)
            setPrompt(data.prompt || '')
          })
          .catch((error) => {
            setMsg('加载失败：' + error.message)
            setMsgTone('warn')
          })
      }, [])

      if (!state || !persona) {
        return h('div', { style: { padding: '16px', opacity: 0.7, fontSize: '13px' } }, '加载人格设置…')
      }

      const patch = (next) => setPersona((prev) => ({ ...prev, ...next }))
      const setTrait = (key, value) =>
        setPersona((prev) => ({ ...prev, traits: { ...prev.traits, [key]: value } }))
      const setSpeech = (next) =>
        setPersona((prev) => ({ ...prev, speech: { ...prev.speech, ...next } }))

      const save = async () => {
        setBusy(true)
        setMsg('保存中…')
        setMsgTone('')
        try {
          const data = await jpost('/config', { persona })
          setState(data)
          setPersona(data.persona)
          setPrompt(data.prompt || '')
          setMsg('已保存 · ' + new Date().toLocaleTimeString())
          setMsgTone('good')
        } catch (error) {
          setMsg('保存失败：' + error.message)
          setMsgTone('warn')
        } finally {
          setBusy(false)
        }
      }

      const usePreset = async (id) => {
        setBusy(true)
        try {
          const data = await jpost('/preset', { id })
          setState(data)
          setPersona(data.persona)
          setPrompt(data.prompt || '')
          setMsg('已套用预设')
          setMsgTone('good')
        } catch (error) {
          setMsg('预设失败：' + error.message)
          setMsgTone('warn')
        } finally {
          setBusy(false)
        }
      }

      const refreshPrompt = async () => {
        try {
          const data = await jget('/prompt')
          setPrompt(data.prompt || '')
        } catch (error) {
          setMsg('预览失败：' + error.message)
          setMsgTone('warn')
        }
      }

      return h(
        'div',
        { 'data-sa-page': '' },
        h(
          'div',
          { 'data-sa-sec': '' },
          h('div', { style: { fontSize: '15px', fontWeight: 700 } }, '群星 AI'),
          h(
            'div',
            { 'data-sa-tip': '' },
            '决定 AI 玩家「是什么性格、偏好什么」：10 个 0-100 的倾向 + 人格文本。保存后会写进 ~/.dsh/stellaris-ai/config.json，供后续 agent 读取。',
          ),
        ),

        h(
          'div',
          { 'data-sa-sec': '' },
          h('div', { 'data-sa-h': '' }, '总开关'),
          h(
            'label',
            { 'data-sa-row': '', style: { cursor: 'pointer' } },
            h('input', {
              type: 'checkbox',
              checked: Boolean(persona.enabled),
              onChange: (event) => patch({ enabled: event.target.checked }),
            }),
            h('span', { style: { fontSize: '13px' } }, persona.enabled ? '启用（AI 会带人格）' : '禁用（纯流程）'),
          ),
        ),

        h(
          'div',
          { 'data-sa-sec': '' },
          h('div', { 'data-sa-h': '' }, '人格预设'),
          h(
            'div',
            { 'data-sa-row': '' },
            h(
              'select',
              {
                'data-sa-input': '',
                value: persona.preset || 'balanced',
                onChange: (event) => usePreset(event.target.value),
                style: { maxWidth: '260px' },
              },
              ...state.presets.map((preset) =>
                h('option', { key: preset.id, value: preset.id }, preset.label),
              ),
            ),
            h(
              'button',
              { 'data-sa-btn': '', disabled: busy, onClick: () => usePreset(persona.preset || 'balanced') },
              '套用预设',
            ),
          ),
          h('div', { 'data-sa-tip': '' }, '套用预设会覆盖 10 个倾向和人格文本；下面的滑块可再微调。'),
        ),

        h(
          'div',
          { 'data-sa-sec': '' },
          h('div', { 'data-sa-h': '' }, '多维倾向（0-100）'),
          ...state.traits.map((trait) =>
            h(Slider, {
              key: trait.key,
              trait,
              value: persona.traits?.[trait.key] ?? 50,
              onChange: (value) => setTrait(trait.key, value),
            }),
          ),
        ),

        h(
          'div',
          { 'data-sa-sec': '' },
          h('div', { 'data-sa-h': '' }, '人格文本'),
          h(
            'div',
            { 'data-sa-grid': '' },
            h('input', {
              'data-sa-input': '',
              placeholder: '名字（例：总指挥）',
              value: persona.name || '',
              onChange: (event) => patch({ name: event.target.value }),
            }),
            h('input', {
              'data-sa-input': '',
              placeholder: '头衔（例：群星参谋）',
              value: persona.title || '',
              onChange: (event) => patch({ title: event.target.value }),
            }),
          ),
          h('textarea', {
            'data-sa-input': '',
            'data-sa-textarea': '',
            placeholder: '你是谁（身份）',
            value: persona.identity || '',
            onChange: (event) => patch({ identity: event.target.value }),
          }),
          h('textarea', {
            'data-sa-input': '',
            'data-sa-textarea': '',
            placeholder: '你的来路（背景）',
            value: persona.background || '',
            onChange: (event) => patch({ background: event.target.value }),
          }),
          h('textarea', {
            'data-sa-input': '',
            'data-sa-textarea': '',
            placeholder: '价值观（每行一条）',
            value: fromLines(persona.values),
            onChange: (event) => patch({ values: toLines(event.target.value) }),
          }),
          h('textarea', {
            'data-sa-input': '',
            'data-sa-textarea': '',
            placeholder: '小毛病（每行一条）',
            value: fromLines(persona.quirks),
            onChange: (event) => patch({ quirks: toLines(event.target.value) }),
          }),
        ),

        h(
          'div',
          { 'data-sa-sec': '' },
          h('div', { 'data-sa-h': '' }, '说话方式'),
          h(
            'div',
            { 'data-sa-grid': '' },
            h('input', {
              'data-sa-input': '',
              placeholder: '说话风格',
              value: persona.speech?.style || '',
              onChange: (event) => setSpeech({ style: event.target.value }),
            }),
            h('input', {
              'data-sa-input': '',
              placeholder: '声音（低沉/克制…）',
              value: persona.speech?.voice || '',
              onChange: (event) => setSpeech({ voice: event.target.value }),
            }),
          ),
          h(
            'div',
            { 'data-sa-grid': '' },
            h('input', {
              'data-sa-input': '',
              placeholder: '语言',
              value: persona.speech?.language || '中文',
              onChange: (event) => setSpeech({ language: event.target.value }),
            }),
            h('input', {
              'data-sa-input': '',
              type: 'number',
              min: 20,
              max: 600,
              placeholder: '每句最多字数',
              value: persona.speech?.maxChars ?? 120,
              onChange: (event) => setSpeech({ maxChars: Number(event.target.value) || 120 }),
            }),
          ),
          h('textarea', {
            'data-sa-input': '',
            'data-sa-textarea': '',
            placeholder: '示例台词（每行一句）',
            value: fromLines(persona.speech?.examples),
            onChange: (event) => setSpeech({ examples: toLines(event.target.value) }),
          }),
        ),

        h(
          'div',
          { 'data-sa-sec': '' },
          h(
            'div',
            { 'data-sa-row': '' },
            h(
              'button',
              { 'data-sa-btn': '', onClick: refreshPrompt },
              '预览 system prompt',
            ),
            h('span', { 'data-sa-tip': '' }, `${prompt.length} 字符`),
          ),
          h('pre', { 'data-sa-pre': '' }, prompt || '（空）'),
        ),

        h(
          'div',
          { 'data-sa-row': '' },
          h(
            'button',
            { 'data-sa-btn': '', 'data-primary': '', disabled: busy, onClick: save },
            busy ? '保存中…' : '保存',
          ),
          h(
            'button',
            { 'data-sa-btn': '', disabled: busy, onClick: () => usePreset('balanced') },
            '恢复默认',
          ),
          h('div', { style: { flex: 1 } }),
          msg ? h('div', { 'data-sa-msg': '', 'data-good': msgTone === 'good' ? '' : undefined, 'data-warn': msgTone === 'warn' ? '' : undefined }, msg) : null,
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-stellaris-ai')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-stellaris-ai: 设置页样式')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () =>
          slots.register(
            { name: 'settings.section', id: 'stellaris-ai', order: 35, label: '群星 AI' },
            () => h(Panel),
          ),
        )
      },
    }
  },
})
