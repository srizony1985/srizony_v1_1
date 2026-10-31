import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('shared social links import brand icons from packages that export them and are used by nav and footer', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/ui/SocialLinks.tsx'), 'utf8')
  for (const file of ['NavBar', 'Footer']) assert.match(readFileSync(resolve(process.cwd(), `components/ui/${file}.tsx`), 'utf8'), /<SocialLinks /)
  assert.match(source, /SiFacebook, SiInstagram, SiYoutube\s*}\s*from ['\"]react-icons\/si['\"]/ )
  assert.match(source, /FaLinkedin\s*}\s*from ['\"]react-icons\/fa['\"]/ )
  assert.match(source, /linkedin: \{ Icon: FaLinkedin/)
  assert.doesNotMatch(source, /SiLinkedin/)
  assert.doesNotMatch(source, /from ['\"]lucide-react['\"].*(Facebook|Instagram|Linkedin|Youtube)/)
})
