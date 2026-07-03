const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots')
const RENDERER = path.join(ROOT, 'out', 'renderer', 'index.html')
const PRELOAD = path.join(__dirname, 'screenshot-preload.cjs')

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function capture(window, filename, height) {
  if (height) {
    const [width] = window.getSize()
    window.setSize(width, height)
    await delay(300)
  }
  await delay(600)
  const image = await window.webContents.capturePage()
  const target = path.join(OUT_DIR, filename)
  fs.writeFileSync(target, image.toPNG())
  console.log(`Saved ${target}`)
}

async function scrollToTerminal(window) {
  await window.webContents.executeJavaScript(`
    (() => {
      const panel = document.querySelector('.terminal-panel-visible')
      panel?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })()
  `)
}

async function clickNav(window, index) {
  await window.webContents.executeJavaScript(`
    (() => {
      const links = document.querySelectorAll('.nav-link')
      links[${index}]?.click()
    })()
  `)
}

async function clickLaunch(window) {
  await window.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('.btn-primary'))
      const launchBtn = buttons.find((btn) => btn.textContent?.includes('启动 Claude Code'))
      launchBtn?.click()
    })()
  `)
}

app.whenReady().then(async () => {
  if (!fs.existsSync(RENDERER)) {
    console.error('Renderer not built. Run `npm run build` first.')
    app.exit(1)
    return
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: false
    }
  })

  await window.loadFile(RENDERER)
  await delay(800)
  await capture(window, 'home.png')

  await clickNav(window, 1)
  await capture(window, 'settings.png', 1180)

  await clickNav(window, 2)
  await capture(window, 'history.png', 760)

  await clickNav(window, 0)
  await delay(400)
  await clickLaunch(window)
  await delay(1000)
  await scrollToTerminal(window)
  await capture(window, 'terminal.png', 1180)

  app.exit(0)
})

app.on('window-all-closed', () => {
  app.quit()
})
