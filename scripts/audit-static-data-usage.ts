import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['app', 'components', 'lib', 'seed-structural.ts', 'scripts']
const ALLOWED = new Set(['lib/cms/fallback-gateway.ts'])
const IMPORT_PATTERN = /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g
const violations: string[] = []

function visit(path: string): string[] {
  try {
    const stat = statSync(path)
    if (stat.isFile()) return /\.(?:[cm]?[jt]sx?)$/.test(path) ? [path] : []
    if (!stat.isDirectory()) return []
    return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
      entry.name === 'node_modules' || entry.name === '.next' ? [] : visit(join(path, entry.name)),
    )
  } catch { return [] }
}

for (const root of ROOTS) {
  for (const file of visit(root)) {
    const rel = relative(process.cwd(), file).replaceAll('\\', '/')
    if (ALLOWED.has(rel)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1]
      if (specifier.startsWith('@/data/') || specifier === '@/data' || /^(?:\.\.\/|\.\/)+data\//.test(specifier)) {
        violations.push(`${rel}: direct data import ${specifier}`)
      }
    }
  }
}

if (violations.length) {
  console.error('Static-data boundary audit failed. Route runtime/maintenance imports through lib/cms/fallback-gateway.ts:')
  for (const violation of violations) console.error(` - ${violation}`)
  process.exitCode = 1
} else {
  console.log('Static-data boundary audit passed: app, components, lib and operational scripts use the unified fallback gateway.')
}
