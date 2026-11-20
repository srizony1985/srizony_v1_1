import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('Page Builder section item actions are grouped, labelled, visible and responsive', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const css = read('app/globals.css')

  assert.match(builder, /REPEAT_HEADER_CLASS = .*grid-cols-\[minmax\(0,1fr\)_auto\]/)
  assert.match(builder, /REPEAT_ACTION_GROUP_CLASS = .*cms-repeat-actions/)
  assert.match(builder, /role="group" aria-label=\{`\$\{config\.singular\} \$\{index \+ 1\} actions`\}/)
  assert.match(builder, /Move up/)
  assert.match(builder, /Move down/)
  assert.match(builder, /<span>Remove<\/span>/)
  assert.match(builder, /aria-expanded=\{isOpen\}/)
  assert.doesNotMatch(builder, /ICON_BUTTON_CLASS/)
  assert.match(builder, /cms-repeat-actions--single/)
  assert.match(builder, /aria-label=\{`Branch \$\{index \+ 1\} actions`\}/)

  assert.match(css, /\.admin-theme-root \.cms-repeat-actions[\s\S]*border: 1px solid var\(--border\)/)
  assert.match(css, /\.admin-theme-root \.cms-repeat-action[\s\S]*background: var\(--card\)[\s\S]*color: var\(--foreground\)/)
  assert.match(css, /\.cms-repeat-action--danger[\s\S]*var\(--destructive\)/)
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*cms-repeat-actions:not\(\.cms-repeat-actions--single\)[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(css, /cms-repeat-actions--single[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
})
