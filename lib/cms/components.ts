/** Shared (client + server) definition of every manageable content component. */
export type ContentComponent = 'project' | 'news' | 'enterprise' | 'partner-agency' | 'health-service' | 'loan-product' | 'product' | 'team' | 'notice' | 'report' | 'job' | 'success-story' | 'stat'
export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'url' | 'image' | 'email'
export type FieldDef = {
  key: string            // bilingual fields are stored as `${key}_en` / `${key}_bn`
  label: string
  type: FieldType
  bilingual?: boolean
  required?: boolean
  options?: string[]
  max?: number
  help?: string
}
export type ComponentDef = { key: ContentComponent; label: string; plural: string; description: string; fields: FieldDef[] }

const core = (dateLabel = 'Publish date'): FieldDef[] => [
  { key: 'title', label: 'Title', type: 'text', bilingual: true, required: true, max: 200 },
  { key: 'summary', label: 'Summary', type: 'textarea', bilingual: true, max: 600 },
  { key: 'body', label: 'Details', type: 'textarea', bilingual: true, max: 20000 },
  { key: 'image', label: 'Image URL', type: 'image', help: 'Use an HTTPS image URL from a source you are allowed to use (for example Unsplash), or an uploaded media URL. Replace demo stock photos with approved organizational photos before publishing factual field reports.' },
  { key: 'date', label: dateLabel, type: 'date', required: true },
]

export const COMPONENTS: Record<ContentComponent, ComponentDef> = {
  project: {
    key: 'project', label: 'Project', plural: 'Projects', description: 'Programmes and projects.', fields: [
      ...core('Start / publish date'),
      { key: 'projectStatus', label: 'Project status', type: 'select', options: ['Ongoing', 'Completed', 'Planned'] },
      { key: 'location', label: 'Location', type: 'text', bilingual: true, max: 200 },
      { key: 'donor', label: 'Donor / partner', type: 'text', max: 200 },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'beneficiaries', label: 'Beneficiaries', type: 'number' },
    ]
  },
  news: {
    key: 'news', label: 'News item', plural: 'News', description: 'Bilingual news articles and field updates.', fields: [
      ...core('Publication date'),
      { key: 'displayOrder', label: 'Landing card order (optional)', type: 'number', help: 'Lower numbers appear first in the homepage News Rail. Leave blank to sort by publication date.' },
      { key: 'category', label: 'News category', type: 'text', bilingual: true, max: 120 },
      { key: 'source', label: 'Source / reference', type: 'text', max: 200 },
    ]
  },
  enterprise: {
    key: 'enterprise', label: 'Enterprise', plural: 'Enterprises', description: 'Foundation enterprise profiles.', fields: [
      ...core(),
      { key: 'category', label: 'Enterprise category', type: 'text', bilingual: true, max: 120 },
      { key: 'link', label: 'Enquiry / website link', type: 'url' },
    ]
  },
  'partner-agency': {
    key: 'partner-agency', label: 'Partner agency', plural: 'Partner agencies', description: 'Donor, institutional and network profiles.', fields: [
      ...core(),
      { key: 'partnerType', label: 'Partner type', type: 'text', bilingual: true, max: 120 },
      { key: 'website', label: 'Official website', type: 'url' },
    ]
  },
  'health-service': {
    key: 'health-service', label: 'Health service', plural: 'Health services', description: 'Health service catalogue and guidance.', fields: [
      ...core(),
      { key: 'serviceType', label: 'Service type', type: 'text', bilingual: true, max: 120 },
      { key: 'availability', label: 'Availability / service note', type: 'text', bilingual: true, max: 300 },
    ]
  },
  'loan-product': {
    key: 'loan-product', label: 'Loan product', plural: 'Loan products', description: 'Loan products, purpose and application guidance.', fields: [
      ...core(),
      { key: 'category', label: 'Loan category', type: 'text', bilingual: true, max: 120 },
      { key: 'terms', label: 'Terms / pricing note', type: 'text', bilingual: true, max: 500 },
      { key: 'eligibility', label: 'Eligibility guidance', type: 'textarea', bilingual: true, max: 1200 },
      { key: 'repayment', label: 'Repayment guidance', type: 'textarea', bilingual: true, max: 1200 },
      { key: 'link', label: 'Application / enquiry link', type: 'url' },
    ]
  },
  product: {
    key: 'product', label: 'Product / Service', plural: 'Products & Services', description: 'Loans, enterprises and other services.', fields: [
      ...core(),
      { key: 'category', label: 'Category', type: 'text', bilingual: true, max: 120 },
      { key: 'terms', label: 'Terms / pricing', type: 'text', bilingual: true, max: 300 },
      { key: 'link', label: 'Call-to-action link', type: 'url' },
    ]
  },
  team: {
    key: 'team', label: 'Team member', plural: 'Team', description: 'Governing body, secretariat and staff.', fields: [
      ...core('Joined / publish date').filter((f) => f.key !== 'summary'),
      { key: 'role', label: 'Role / designation', type: 'text', bilingual: true, required: true, max: 160 },
      { key: 'group', label: 'Group', type: 'select', options: ['Governing Body', 'Executive Secretariat', 'Advisor', 'Staff'], required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text', max: 40 },
      { key: 'order', label: 'Display order', type: 'number' },
    ]
  },
  notice: {
    key: 'notice', label: 'Notice', plural: 'Notices', description: 'Public notices.', fields: [
      ...core('Notice date'),
      { key: 'file', label: 'Attachment path', type: 'url' },
    ]
  },
  report: {
    key: 'report', label: 'Report', plural: 'Reports', description: 'Published reports.', fields: [
      ...core('Published date'),
      { key: 'file', label: 'Report file path', type: 'url', required: true },
      { key: 'category', label: 'Report category', type: 'text', bilingual: true, max: 120 },
    ]
  },
  job: {
    key: 'job', label: 'Job post', plural: 'Job posts', description: 'Career opportunities.', fields: [
      ...core('Posted date'),
      { key: 'deadline', label: 'Application deadline', type: 'date', required: true },
      { key: 'category', label: 'Job category', type: 'text', bilingual: true, max: 120, help: 'Group related vacancies together in the applicant notification inbox (for example: Programme, Finance, Field Operations).' },
      { key: 'location', label: 'Location', type: 'text', bilingual: true, max: 200 },
      { key: 'employmentType', label: 'Employment type', type: 'select', options: ['Full-time', 'Part-time', 'Contract', 'Internship'] },
      { key: 'vacancies', label: 'Vacancies', type: 'number' },
      { key: 'salary', label: 'Salary', type: 'text', max: 120 },
    ]
  },
  'success-story': {
    key: 'success-story', label: 'Success Story', plural: 'Success Stories', description: 'Stories of people and communities whose lives have changed.', fields: [
      ...core().map((field) => field.key === 'image' ? { ...field, required: true, help: 'Required: choose an approved organizational photograph from the media library. The homepage Success Stories Gallery displays image-and-title cards only.' } : field),
      { key: 'displayOrder', label: 'Landing gallery order (optional)', type: 'number', help: 'Lower numbers appear first in the homepage Success Stories Gallery. Leave blank to sort by publication date.' },
      { key: 'category', label: 'Story category', type: 'text', bilingual: true, max: 120 },
      { key: 'source', label: 'Source / reference', type: 'text', max: 200 },
    ]
  },
  stat: {
    key: 'stat', label: 'Statistic', plural: 'Statistics', description: 'A reusable metric for statistics sections and impact dashboards.', fields: [
      ...core('Metric date').filter((field) => field.key !== 'body' && field.key !== 'image'),
      { key: 'value', label: 'Display value', type: 'text', required: true, max: 40, help: 'Examples: 125+, 92%, 1.2M. Enter the exact display format.' },
      { key: 'icon', label: 'Icon', type: 'select', options: ['', 'heart', 'leaf', 'book', 'scale', 'users', 'sun', 'droplets', 'briefcase', 'coins', 'building', 'megaphone', 'shield', 'play', 'arrow', 'check', 'home'] },
      { key: 'illustration', label: 'Illustration preset', type: 'select', options: ['', 'mission', 'vision', 'values', 'heart', 'book', 'users', 'coins', 'sprout', 'store', 'women-business', 'small-enterprise', 'agriculture', 'migrant-household', 'rural-development', 'career', 'education'] },
      { key: 'image', label: 'Custom illustration image', type: 'image', help: 'Optional image that replaces the selected icon or illustration.' },
      { key: 'displayOrder', label: 'Display order', type: 'number' },
    ]
  }
}

/** Components an admin can attach to a navigation menu (at least one is mandatory). */
export const MENU_COMPONENTS: ContentComponent[] = ['project', 'product', 'team']
/** "News" is the date-sorted collection of these components. */
export const NEWS_COMPONENTS: ContentComponent[] = ['news', 'project', 'notice', 'report', 'job']

export const SUCCESS_STORY_COMPONENTS: ContentComponent[] = ['success-story']

/**
 * Each content type has a stable, editable collection page. Content editors may
 * choose another CMS page as the parent, in which case links inherit that menu
 * hierarchy (for example /about-us/our-team/field-worker).
 */
export type ContentCollectionRoute = {
  slug: string
  component: ContentComponent
  title: { en: string; bn: string }
  heading: { en: string; bn: string }
  subtitle: { en: string; bn: string }
}

export const CONTENT_COLLECTION_ROUTES: ContentCollectionRoute[] = [
  { slug: '/projects', component: 'project', title: { en: 'Projects', bn: 'প্রকল্পসমূহ' }, heading: { en: 'Projects', bn: 'প্রকল্পসমূহ' }, subtitle: { en: 'Explore published projects and programmes.', bn: 'প্রকাশিত প্রকল্প ও কর্মসূচি দেখুন।' } },
  { slug: '/news', component: 'news', title: { en: 'News', bn: 'সংবাদ' }, heading: { en: 'Latest News', bn: 'সর্বশেষ সংবাদ' }, subtitle: { en: 'Updates and stories from Srizony Foundation.', bn: 'সৃজনী ফাউন্ডেশনের খবর ও গল্প।' } },
  { slug: '/enterprise-development', component: 'enterprise', title: { en: 'Enterprise Development', bn: 'এন্টারপ্রাইজ উন্নয়ন' }, heading: { en: 'Enterprises', bn: 'উদ্যোগসমূহ' }, subtitle: { en: 'Explore foundation enterprise profiles.', bn: 'ফাউন্ডেশনের উদ্যোগসমূহ দেখুন।' } },
  { slug: '/about-us/partners-networks', component: 'partner-agency', title: { en: 'Partners & Networks', bn: 'অংশীদার ও নেটওয়ার্ক' }, heading: { en: 'Partner Agencies', bn: 'অংশীদার সংস্থা' }, subtitle: { en: 'Our partners and institutional networks.', bn: 'আমাদের অংশীদার ও প্রাতিষ্ঠানিক নেটওয়ার্ক।' } },
  { slug: '/social-development/health-program', component: 'health-service', title: { en: 'Health Program', bn: 'স্বাস্থ্য কর্মসূচি' }, heading: { en: 'Health Services', bn: 'স্বাস্থ্যসেবা' }, subtitle: { en: 'Health services and community guidance.', bn: 'স্বাস্থ্যসেবা ও কমিউনিটি নির্দেশনা।' } },
  { slug: '/organizational-development', component: 'loan-product', title: { en: 'Organizational Development', bn: 'প্রাতিষ্ঠানিক উন্নয়ন' }, heading: { en: 'Loan Products', bn: 'ঋণ পণ্য' }, subtitle: { en: 'Loan products, eligibility and guidance.', bn: 'ঋণ পণ্য, যোগ্যতা ও নির্দেশনা।' } },
  { slug: '/enterprise-development', component: 'product', title: { en: 'Enterprise Development', bn: 'এন্টারপ্রাইজ উন্নয়ন' }, heading: { en: 'Products & Services', bn: 'পণ্য ও সেবা' }, subtitle: { en: 'Products, services and enterprise offerings.', bn: 'পণ্য, সেবা ও উদ্যোগের প্রস্তাবনা।' } },
  { slug: '/management-staff', component: 'team', title: { en: 'Management Staff', bn: 'ব্যবস্থাপনা কর্মকর্তা' }, heading: { en: 'Our Team', bn: 'আমাদের টিম' }, subtitle: { en: 'Meet the published team and staff.', bn: 'প্রকাশিত টিম ও কর্মীদের সঙ্গে পরিচিত হোন।' } },
  { slug: '/notice', component: 'notice', title: { en: 'Notices', bn: 'নোটিশ' }, heading: { en: 'Notices', bn: 'নোটিশ' }, subtitle: { en: 'Official notices and announcements.', bn: 'অফিসিয়াল নোটিশ ও ঘোষণা।' } },
  { slug: '/resources', component: 'report', title: { en: 'Documents & Resources', bn: 'ডকুমেন্ট ও রিসোর্স' }, heading: { en: 'Reports', bn: 'প্রতিবেদন' }, subtitle: { en: 'Published reports and documents.', bn: 'প্রকাশিত প্রতিবেদন ও নথি।' } },
  { slug: '/carrer-job', component: 'job', title: { en: 'Career / Jobs', bn: 'ক্যারিয়ার / চাকরি' }, heading: { en: 'Current Vacancies', bn: 'চলমান চাকরির সুযোগ' }, subtitle: { en: 'Build your career with a purpose-driven organization.', bn: 'উদ্দেশ্যভিত্তিক প্রতিষ্ঠানের সঙ্গে আপনার ক্যারিয়ার গড়ুন।' } },
  { slug: '/success-stories', component: 'success-story', title: { en: 'Success Stories of Srizony', bn: 'সৃজনীর সাফল্যের গল্পসমূহ' }, heading: { en: 'Success Stories of Srizony', bn: 'সৃজনীর সাফল্যের গল্পসমূহ' }, subtitle: { en: 'Stories of people and communities whose lives have changed.', bn: 'মানুষ ও কমিউনিটির জীবনে ইতিবাচক পরিবর্তনের সাফল্যের গল্প।' } },
  { slug: '/impact/statistics', component: 'stat', title: { en: 'Impact Statistics', bn: 'প্রভাবের পরিসংখ্যান' }, heading: { en: 'Our Impact', bn: 'আমাদের প্রভাব' }, subtitle: { en: 'Verified impact figures and organizational metrics.', bn: 'যাচাইকৃত প্রভাবের পরিসংখ্যান ও সাংগঠনিক সূচক।' } },
]

export const DEFAULT_CONTENT_PARENT: Record<ContentComponent, string> = Object.fromEntries(
  CONTENT_COLLECTION_ROUTES.map((route) => [route.component, route.slug]),
) as Record<ContentComponent, string>

/** Canonical root collection routes are also the fixed parents for their detail records. */
export const FIXED_CONTENT_PARENT: Partial<Record<ContentComponent, string>> = {
  news: '/news',
  'success-story': '/success-stories',
}

export function getDefaultContentParent(component: ContentComponent): string {
  return FIXED_CONTENT_PARENT[component] || DEFAULT_CONTENT_PARENT[component] || '/'
}

export function getContentCollectionRoute(slug: string) {
  return CONTENT_COLLECTION_ROUTES.find((route) => route.slug === slug)
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Flat storage keys for a component: bilingual fields expand to _en/_bn. */
export function storageKeys(def: ComponentDef) {
  return def.fields.flatMap((f) => (f.bilingual ? [`${f.key}_en`, `${f.key}_bn`] : [f.key]))
}
export const CORE_KEYS = ['title_en', 'title_bn', 'summary_en', 'summary_bn', 'body_en', 'body_bn', 'image', 'date']
export type ContentValues = Record<string, string>
export type ContentRecord = { id: number; component: ContentComponent; slug: string; status: 'published' | 'draft' | 'hidden'; values: ContentValues; publishedAt: string; updatedAt: string }
export type FeedItem = { id: number; component: ContentComponent; slug: string; title: { en: string; bn: string }; summary: { en: string; bn: string }; image?: string; date: string; href?: string; deadline?: string; projectStatus?: string; location?: { en: string; bn: string }; employmentType?: string; vacancies?: string; salary?: string; attachment?: string; category?: { en: string; bn: string }; metricValue?: string; icon?: string; illustration?: string }
