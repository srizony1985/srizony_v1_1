import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataset = JSON.parse(await readFile(resolve(root, 'data/ui-demo-content.v1.json'), 'utf8'))
const allowedComponents = ['project','news','enterprise','partner-agency','health-service','loan-product','product','team','notice','report','job','success-story','stat']
const routeMap = {
  project:'/projects', news:'/news', enterprise:'/enterprise-development', 'partner-agency':'/about-us/partners-networks',
  'health-service':'/social-development/health-program', 'loan-product':'/organizational-development', product:'/enterprise-development',
  team:'/management-staff', notice:'/notice', report:'/resources', job:'/carrer-job', 'success-story':'/success-stories', stat:'/impact/statistics',
}
const requiredByComponent = {
  project:['title_en','date'], news:['title_en','date'], enterprise:['title_en','date'], 'partner-agency':['title_en','date'],
  'health-service':['title_en','date'], 'loan-product':['title_en','date'], product:['title_en','date'],
  team:['title_en','date','role_en','group'], notice:['title_en','date'], report:['title_en','date','file'],
  job:['title_en','date','deadline'], 'success-story':['title_en','date','image'], stat:['title_en','date','value'],
}

test('dataset envelope and safety markers are present', () => {
  assert.equal(dataset.format, 'srizony-cms-ui-demo-content')
  assert.equal(dataset.version, 1)
  assert.equal(dataset.siteKey, 'default')
  assert.equal(dataset.safety.allRecordsAreDemo, true)
  assert.equal(dataset.safety.publishedForLocalPreview, true)
  assert.equal(dataset.items.length, 38)
})

test('every CMS content component is covered', () => {
  const found = new Set(dataset.items.map((item) => item.component))
  assert.deepEqual([...found].sort(), [...allowedComponents].sort())
})

test('slugs are unique, namespaced and records are explicitly marked for preview', () => {
  const keys = dataset.items.map((item) => `${item.component}::${item.slug}`)
  assert.equal(new Set(keys).size, keys.length)
  for (const item of dataset.items) {
    assert.match(item.slug, /^demo-ui-[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.equal(item.status, 'published')
    assert.match(item.values.title_en, /^DEMO PREVIEW — /)
    assert.match(item.values.title_bn, /^\[ডেমো প্রিভিউ\] /)
    assert.equal(item.values.routeParent, routeMap[item.component])
  }
})

test('component required fields and field bounds are satisfied', () => {
  const coreTitleMax = 200
  for (const item of dataset.items) {
    const v = item.values
    for (const key of requiredByComponent[item.component]) assert.ok(String(v[key] ?? '').trim(), `${item.slug} missing ${key}`)
    assert.ok(v.title_en.length <= coreTitleMax, `${item.slug} title exceeds max`)
    assert.match(v.date, /^\d{4}-\d{2}-\d{2}$/)
    if (v.image) assert.match(v.image, /^https:\/\/images\.unsplash\.com\//)
    if (item.component === 'project') assert.ok(['Ongoing','Completed','Planned'].includes(v.projectStatus))
    if (item.component === 'team') assert.ok(['Governing Body','Executive Secretariat','Advisor','Staff'].includes(v.group))
    if (item.component === 'job') {
      assert.ok(['Full-time','Part-time','Contract','Internship'].includes(v.employmentType))
      assert.match(v.deadline, /^\d{4}-\d{2}-\d{2}$/)
    }
    if (item.component === 'stat') assert.ok(['heart','leaf','book','scale','users','sun','droplets','briefcase','coins','building','megaphone','shield','play','arrow','check','home'].includes(v.icon))
    for (const [key, value] of Object.entries(v)) {
      assert.ok(typeof value === 'string' || typeof value === 'number' || value === null, `${item.slug}.${key} has unsupported JSON type`)
    }
  }
})

test('jobs are marked as preview-only with future deadlines', () => {
  const jobs = dataset.items.filter((item) => item.component === 'job')
  assert.equal(jobs.length, 3)
  for (const job of jobs) {
    assert.match(job.values.body_en, /DEMO ONLY — NOT A REAL VACANCY/)
    assert.ok(job.values.deadline > '2026-11-11')
  }
})

test('success stories are fictional composite records with images', () => {
  const stories = dataset.items.filter((item) => item.component === 'success-story')
  assert.equal(stories.length, 3)
  for (const story of stories) {
    assert.ok(story.values.image)
    assert.match(story.values.body_en, /FICTIONAL COMPOSITE/)
  }
})

test('CMS database-transfer JSON is compatible with the project import envelope', async () => {
  const transfer = JSON.parse(await readFile(resolve(root, 'data/ui-demo-cms-transfer.v1.json'), 'utf8'))
  assert.equal(transfer.format, 'srizony-cms-site-data')
  assert.equal(transfer.version, 1)
  assert.deepEqual(transfer.includedTables, ['cms_content_items'])
  assert.equal(transfer.data.cms_content_items.length, dataset.items.length)
  for (const row of transfer.data.cms_content_items) {
    assert.equal(row.site_id, '1')
    assert.ok(!Object.hasOwn(row, 'id'), 'generated IDs should be left to PostgreSQL')
    assert.ok(row.component && row.slug && row.route_parent)
    assert.equal(row.status, 'published')
    assert.equal(row.attributes.demoOnly, true)
    assert.equal(row.attributes.demoDataset, dataset.datasetId)
  }
})

test('direct database/API import scripts are syntactically valid and production guarded', async () => {
  const { execFileSync } = await import('node:child_process')
  for (const filename of ['seed-ui-demo.mjs','remove-ui-demo.mjs','upload-ui-demo-api.mjs','remove-ui-demo-api.mjs']) {
    execFileSync(process.execPath, ['--check', resolve(root, 'scripts', filename)])
  }
  const [dbSeed, apiSeed] = await Promise.all([
    readFile(resolve(root, 'scripts/seed-ui-demo.mjs'), 'utf8'),
    readFile(resolve(root, 'scripts/upload-ui-demo-api.mjs'), 'utf8'),
  ])
  assert.match(dbSeed, /NODE_ENV === 'production'/)
  assert.match(dbSeed, /ALLOW_UI_DEMO_SEED !== 'YES_DEMO_ONLY'/)
  assert.match(apiSeed, /NODE_ENV === 'production'/)
  assert.match(apiSeed, /ALLOW_REMOTE_DEMO_API !== 'YES_REMOTE_DEMO'/)
})
