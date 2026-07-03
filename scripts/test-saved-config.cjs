const { app, safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(async () => {
  const results = { api: null, pty: null, claude: null }

  try {
    const configPath = path.join(process.env.APPDATA, 'claude-launcher', 'claude-launcher-config.json')
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    let apiKey = ''
    if (data.encryptedApiKey) {
      if (safeStorage.isEncryptionAvailable()) {
        apiKey = safeStorage.decryptString(Buffer.from(data.encryptedApiKey, 'base64'))
      } else {
        apiKey = data.encryptedApiKey
      }
    }

    const baseUrl = (data.baseUrl || '').replace(/\/+$/, '')
    const url = `${baseUrl}/v1/models?limit=10`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'anthropic-version': '2023-06-01',
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'error'
    })

    const body = await response.text()
    results.api = {
      ok: response.ok,
      status: response.status,
      baseUrl,
      modelCount: response.ok ? (JSON.parse(body).data?.length ?? 0) : 0,
      message: response.ok
        ? `连接成功，获取到 ${JSON.parse(body).data?.length ?? 0} 个模型`
        : `连接失败 (${response.status})`
    }
  } catch (error) {
    results.api = { ok: false, message: error.message }
  }

  try {
    const pty = require('node-pty')
    const term = pty.spawn('cmd.exe', ['/c', 'echo pty_ok'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env,
      useConpty: true
    })
    results.pty = { ok: true, pid: term.pid, message: '内嵌终端 native 模块正常' }
    term.kill()
  } catch (error) {
    results.pty = { ok: false, message: error.message }
  }

  try {
    const { execSync } = require('child_process')
    const output = execSync('where claude', { encoding: 'utf8', shell: true }).trim()
    results.claude = { ok: true, path: output.split(/\r?\n/)[0], message: '已找到 claude 命令' }
  } catch {
    results.claude = { ok: false, message: '未找到 claude 命令' }
  }

  console.log('=== Claude Launcher 自检结果 ===')
  console.log(JSON.stringify(results, null, 2))

  const allCriticalOk = results.api?.ok && (results.pty?.ok || true)
  process.exit(results.api?.ok ? 0 : 1)
})
