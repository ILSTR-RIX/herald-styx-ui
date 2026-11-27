// Build dist/plugin.js: fetch the logos named in logos.config.json (cached in
// .cache/), sanitise them, and inline them as data URIs into src/plugin.js.
// No dependencies; Node 18+.
//
//   node scripts/build.mjs            build
//   node scripts/build.mjs --install  build, then copy to $HERMES_HOME/desktop-plugins/herald-styx-ui/
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'logos.config.json'), 'utf8'))
const cacheDir = join(root, '.cache')
mkdirSync(cacheDir, { recursive: true })

const CDN = {
  lobe: name => `https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@${config.versions.lobe}/icons/${name}.svg`,
  si: slug => `https://cdn.jsdelivr.net/npm/simple-icons@${config.versions.si}/icons/${slug}.svg`
}

async function fetchSvg(src) {
  const [kind, name] = src.split(':')
  if (!CDN[kind] || !/^[a-z0-9-]+$/.test(name ?? '')) throw new Error(`bad logo source "${src}"`)
  const file = join(cacheDir, `${kind}-${name}.svg`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const res = await fetch(CDN[kind](name), { headers: { 'User-Agent': 'herald-styx-ui-build/1.0' } })
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`)
  const text = await res.text()
  if (!text.trimStart().startsWith('<svg')) throw new Error(`${src}: not an SVG`)
  writeFileSync(file, text)
  return text
}

// Keep only drawing markup: no scripts, handlers, foreign objects or external refs.
// Monochrome marks (currentColor or no fill) get the configured colour, because
// an <img> cannot inherit the text colour.
function sanitise(svg, colour) {
  let out = svg
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
    .replace(/\s(width|height|style|role)="[^"]*"/g, '')
  if (/<(script|foreignObject)/i.test(out) || /\son[a-z]+=/i.test(out)) throw new Error('unsafe SVG after sanitise')
  out = out.replace(/currentColor/g, colour)
  if (!/fill=/.test(out.slice(0, out.indexOf('>')))) out = out.replace('<svg', `<svg fill="${colour}"`)
  return out.replace(/\s+/g, ' ').trim()
}

const dataUri = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

async function table(rows, label) {
  const icons = {}
  const entries = []
  for (const [id, aliases, src, colour] of rows) {
    if (!icons[src]) icons[src] = dataUri(sanitise(await fetchSvg(src), colour))
    entries.push({ id, aliases: aliases.map(a => a.toLowerCase()), icon: src, colour })
  }
  console.log(`  ${label}: ${entries.length} entries`)
  return { entries, icons }
}

const models = await table(config.models, 'models')
const services = await table(config.services, 'services')
const LOGOS = {
  models: models.entries,
  services: services.entries,
  families: config.families,
  icons: { ...models.icons, ...services.icons }
}

const source = readFileSync(join(root, 'src', 'plugin.js'), 'utf8')
if (!source.includes('"__HERALD_STYX_LOGOS__"')) throw new Error('src/plugin.js has no "__HERALD_STYX_LOGOS__" placeholder')
const built = source.replace('"__HERALD_STYX_LOGOS__"', JSON.stringify(LOGOS))
mkdirSync(join(root, 'dist'), { recursive: true })
writeFileSync(join(root, 'dist', 'plugin.js'), built)
const sha = createHash('sha256').update(built).digest('hex').slice(0, 12)
console.log(`  dist/plugin.js ${(built.length / 1024).toFixed(1)} KiB  sha256:${sha}`)

if (process.argv.includes('--install')) {
  const home = process.env.HERMES_HOME || join(homedir(), '.hermes')
  if (!existsSync(join(home, 'config.yaml'))) throw new Error(`no Hermes home at ${home} (no config.yaml). Set HERMES_HOME.`)
  const target = join(home, 'desktop-plugins', 'herald-styx-ui')
  mkdirSync(target, { recursive: true })
  copyFileSync(join(root, 'dist', 'plugin.js'), join(target, 'plugin.js'))
  console.log(`  installed ${join(target, 'plugin.js')}`)
}
