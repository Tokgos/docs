import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const config = JSON.parse(fs.readFileSync(path.join(root, 'docs.json'), 'utf8'))
const errors = []
const routes = new Set()
const apiRoutes = new Set()
const specs = new Map()
const redirects = new Map()

function files(directory) {
    if (!fs.existsSync(directory)) return []
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name)
        return entry.isDirectory() ? files(filename) : [filename]
    })
}

for (const language of ['zh', 'en']) {
    for (const filename of files(path.join(root, language)).filter(name => name.endsWith('.mdx'))) {
        const route = '/' + path.relative(root, filename).replaceAll('\\', '/').slice(0, -4)
        if (!/^\/[a-z0-9/-]+$/.test(route)) errors.push(`Noncanonical page path: ${route}`)
        routes.add(route)
    }
}

for (const filename of files(path.join(root, 'openapi')).filter(name => name.endsWith('.json'))) {
    const relative = path.relative(root, filename).replaceAll('\\', '/')
    specs.set(relative, JSON.parse(fs.readFileSync(filename, 'utf8')))
    routes.add('/' + relative)
}

function checkNavigation(node, inheritedSpec) {
    if (!node || typeof node !== 'object') return
    const spec = node.openapi || inheritedSpec
    if (node.openapi && !specs.has(node.openapi)) errors.push(`Missing OpenAPI file: ${node.openapi}`)
    for (const page of node.pages || []) {
        if (typeof page !== 'string') {
            checkNavigation(page, spec)
            continue
        }
        const operation = page.match(/^(?:(.+\.json) )?(GET|POST|DELETE|PUT|PATCH|HEAD|OPTIONS|TRACE) (.+)$/)
        if (!operation) {
            if (!routes.has('/' + page)) errors.push(`Missing navigation page: ${page}`)
            continue
        }
        const [, source = spec, method, endpoint] = operation
        const definition = specs.get(source)?.paths?.[endpoint]?.[method.toLowerCase()]
        if (!definition) {
            errors.push(`Missing operation: ${source} ${method} ${endpoint}`)
            continue
        }
        const href = definition['x-mint']?.href
        if (!/^\/(zh|en)\/api-reference\/[a-z0-9/-]+$/.test(href || '')) errors.push(`Noncanonical API URL: ${href}`)
        if (apiRoutes.has(href)) errors.push(`Duplicate API URL: ${href}`)
        apiRoutes.add(href)
        routes.add(href)
    }
    for (const key of ['languages', 'tabs', 'groups']) {
        for (const child of node[key] || []) checkNavigation(child, spec)
    }
}
checkNavigation(config.navigation)

for (const { source, destination } of config.redirects || []) {
    if (redirects.has(source)) errors.push(`Duplicate redirect: ${source}`)
    redirects.set(source, destination)
    if (source === destination) errors.push(`Self redirect: ${source}`)
    if (!routes.has(destination)) errors.push(`Missing redirect destination: ${source} -> ${destination}`)
}
for (const [source, destination] of redirects) {
    if (redirects.has(destination)) errors.push(`Chained redirect: ${source} -> ${destination}`)
}

function checkLink(link, filename) {
    const clean = decodeURI(link.split(/[?#]/)[0]).replace(/\/$/, '') || '/'
    if (clean === '/') return
    if (redirects.has(clean)) errors.push(`Old documentation URL in ${filename}: ${clean}`)
    else if (!routes.has(clean) && !fs.existsSync(path.join(root, clean.slice(1)))) errors.push(`Unknown documentation URL in ${filename}: ${clean}`)
}

let webLinks = 0
const web = path.resolve(root, '../ai-forward-web')
for (const directory of ['src', 'public', 'tests', 'scripts']) {
    for (const filename of files(path.join(web, directory)).filter(name => /\.(vue|ts|js|mjs|json|md|txt|html)$/.test(name))) {
        const source = fs.readFileSync(filename, 'utf8')
        const matches = [
            ...source.matchAll(/https:\/\/docs\.tikway\.ai(\/[^\s)'"`<>]*)?/g),
            ...source.matchAll(/\$\{docsUrl\}(\/[^\s)'"`<>]+)/g)
        ]
        if (filename.endsWith('GatewayNavigation.vue')) matches.push(...source.matchAll(/(?:path:\s*|docUrl\()['"]([^'"]+)['"]/g))
        for (const match of matches) {
            checkLink(match[1] || '/', path.relative(web, filename))
            webLinks++
        }
    }
}

if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
} else {
    console.log(`Routes OK: ${apiRoutes.size} API pages, ${redirects.size} redirects, ${webLinks} web documentation links.`)
}
