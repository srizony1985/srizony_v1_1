import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('navbar imports social brand icons from packages that export them', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/ui/NavBar.tsx'), 'utf8')
  assert.match(source, /SiFacebook, SiInstagram, SiYoutube\s*}\s*from ['\"]react-icons\/si['\"]/ )
  assert.match(source, /FaLinkedin\s*}\s*from ['\"]react-icons\/fa['\"]/ )
  assert.match(source, /linkedin: FaLinkedin/)
  assert.doesNotMatch(source, /SiLinkedin/)
  assert.doesNotMatch(source, /from ['\"]lucide-react['\"].*(Facebook|Instagram|Linkedin|Youtube)/)
})
