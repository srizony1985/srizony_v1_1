import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('../components/pages/JobPostingDetail.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/site-polish.css', import.meta.url), 'utf8')

test('job application modal renders through a body portal', () => {
  assert.match(component, /import\s*\{\s*createPortal\s*\}\s*from\s*'react-dom'/)
  assert.match(component, /createPortal\([\s\S]*?document\.body/)
  assert.match(component, /portalReady/)
})

test('job application modal escapes page stacking contexts', () => {
  const rule = styles.match(/\.sf-job-modal-backdrop\s*\{([^}]+)\}/)?.[1] ?? ''
  assert.match(rule, /position:\s*fixed/)
  assert.match(rule, /z-index:\s*2147483600/)
  assert.match(rule, /isolation:\s*isolate/)
})

test('job application modal traps focus and restores scroll styles', () => {
  assert.match(component, /querySelectorAll<HTMLElement>/)
  assert.match(component, /event\.key === 'Escape'/)
  assert.match(component, /event\.key !== 'Tab'/)
  assert.match(component, /root\.style\.overflow = 'hidden'/)
  assert.match(component, /body\.style\.overflow = 'hidden'/)
  assert.match(component, /root\.style\.overflow = previousRootOverflow/)
  assert.match(component, /body\.style\.overflow = previousBodyOverflow/)
})

test('the modal body remains independently scrollable on small screens', () => {
  const rule = styles.match(/\.sf-job-modal-body\s*\{([^}]+)\}/)?.[1] ?? ''
  assert.match(rule, /min-height:\s*0/)
  assert.match(rule, /overflow-y:\s*auto/)
  assert.match(rule, /overscroll-behavior:\s*contain/)
})
