import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'

/**
 * Inserts conspicuously fictional content for local/staging UI and workflow previews only.
 * It refuses to run in production, and requires an explicit opt-in even in development.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo preview data may never be seeded in production.')
  if (process.env.ALLOW_DEMO_PREVIEW_SEED !== 'YES_DEMO_ONLY') {
    throw new Error('Set ALLOW_DEMO_PREVIEW_SEED=YES_DEMO_ONLY to confirm this database is a local/demo database.')
  }
  if (!db) throw new Error('DATABASE_URL is required to seed demo preview data.')

  await ensureCmsSchema()
  const today = new Date().toISOString().slice(0, 10)
  const demoJobSlug = 'demo-community-field-officer-preview-only'
  const jobResult = await db.execute(sql`
    INSERT INTO cms_content_items (
      component, slug, title_en, title_bn, summary_en, summary_bn, body_en, body_bn,
      published_at, status, attributes
    ) VALUES (
      'job', ${demoJobSlug},
      '[DEMO PREVIEW] Community Field Officer — NOT A REAL VACANCY',
      '[ডেমো প্রিভিউ] কমিউনিটি ফিল্ড অফিসার — প্রকৃত নিয়োগ নয়',
      'Fictional sample content used to preview the job listing and application workflow. Do not treat this as an official job circular.',
      'চাকরির তালিকা ও আবেদন প্রক্রিয়া দেখানোর জন্য কাল্পনিক নমুনা। এটিকে অফিসিয়াল নিয়োগ বিজ্ঞপ্তি হিসেবে বিবেচনা করবেন না।',
      'DEMO ONLY. This is fictional sample content to test the public detail page and application form. Replace or delete it before any official launch. No actual vacancy exists.',
      'শুধুমাত্র ডেমো। পাবলিক ডিটেইল পেজ ও আবেদন ফর্ম পরীক্ষা করার জন্য কাল্পনিক নমুনা। অফিসিয়াল প্রকাশের আগে এটি বদলান বা মুছে দিন। প্রকৃত কোনো পদ খালি নেই।',
      ${today}::date, 'published',
      ${JSON.stringify({ routeParent: '/carrer-job', deadline: '2099-12-31', location_en: 'Demo Location — preview only', location_bn: 'ডেমো কর্মস্থল — শুধু প্রিভিউ', employmentType: 'Full-time', vacancies: '2', salary: 'Demo only — not applicable' })}::jsonb
    ) ON CONFLICT DO NOTHING
    RETURNING id
  `)
  const existingJob = jobResult.rows[0] as { id: string | number } | undefined
  const savedJob = existingJob || ((await db.execute(sql`
    SELECT id FROM cms_content_items
    WHERE component = 'job' AND slug = ${demoJobSlug} AND attributes->>'routeParent' = '/carrer-job'
    LIMIT 1
  `)).rows[0] as { id: string | number } | undefined)
  if (!savedJob) throw new Error('Could not create or find the demo job at /carrer-job.')
  const jobId = Number(savedJob.id)

  // A deliberately fake, reviewable application entry proves the admin applications table.
  await db.execute(sql`
    INSERT INTO job_applications (job_id, name, email, phone, cover_letter, resume_url, status)
    SELECT ${jobId}, 'Demo Applicant (Preview Only)', 'demo.applicant@example.com', '+880 1000-000000',
      'DEMO ONLY — placeholder application for reviewing the admin table. This is not a real applicant and has no resume attachment.', NULL, 'new'
    WHERE NOT EXISTS (SELECT 1 FROM job_applications WHERE job_id = ${jobId} AND email = 'demo.applicant@example.com')
  `)

  const existingEssentials = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, 'cms-document:website-essentials.json')).limit(1)
  const backupKey = 'cms-demo-backup:website-essentials.json'
  const existingBackup = await db.select({ key: siteSettings.key }).from(siteSettings).where(eq(siteSettings.key, backupKey)).limit(1)
  if (!existingBackup.length) {
    await db.insert(siteSettings).values({ key: backupKey, value: { existed: existingEssentials.length > 0, value: existingEssentials[0]?.value ?? null }, updatedAt: new Date() })
      .onConflictDoNothing({ target: siteSettings.key })
  }

  const previewEssentials = {
    socials: {
      facebook: 'https://example.com/preview-facebook',
      instagram: 'https://example.com/preview-instagram',
      youtube: 'https://example.com/preview-youtube',
      linkedin: 'https://bd.linkedin.com/company/srizonyfoundation',
    },
    documents: {
      // Intentionally blank: the public UI should show no download link until an approved PDF is uploaded.
      staffListPdf: { titleEn: 'Staff List (Preview — PDF not uploaded)', titleBn: 'কর্মকর্তা-কর্মচারীর তালিকা (প্রিভিউ — PDF আপলোড হয়নি)', url: '' },
      locationsPdf: { titleEn: 'Working Locations (Preview — PDF not uploaded)', titleBn: 'কার্যক্রমের স্থান (প্রিভিউ — PDF আপলোড হয়নি)', url: '' },
    },
    staff: [{
      id: 'demo-preview-staff-01', nameEn: 'Demo Person 01 — Preview Only', nameBn: 'ডেমো ব্যক্তি ০১ — শুধু প্রিভিউ',
      designationEn: 'Sample Designation — Not Real', designationBn: 'নমুনা পদবি — প্রকৃত নয়',
      bioEn: 'Fictional profile to preview cards and bilingual layout. Remove before launch.',
      bioBn: 'কার্ড ও দ্বিভাষিক বিন্যাস দেখানোর কাল্পনিক প্রোফাইল। চালুর আগে মুছে দিন।',
      photoUrl: '', published: true, sortOrder: 0,
    }],
    locations: [{
      id: 'demo-preview-branch-01', kind: 'branch',
      name: { en: 'DEMO Branch — Preview Only', bn: 'ডেমো শাখা — শুধু প্রিভিউ' },
      district: { en: 'Demo District', bn: 'ডেমো জেলা' }, division: { en: 'Demo Division', bn: 'ডেমো বিভাগ' },
      address: { en: 'Placeholder address; not an actual branch', bn: 'নমুনা ঠিকানা; প্রকৃত শাখা নয়' },
      lat: 23.8103, lng: 90.4125,
    }],
  }
  await db.insert(siteSettings).values({ key: 'cms-document:website-essentials.json', value: previewEssentials, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: previewEssentials, updatedAt: new Date() } })

  console.log('Demo preview seed completed. Sample content is fictional; remove it before production. Run npm run db:seed:demo:remove to remove preview records and restore the previous Website Essentials settings.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
