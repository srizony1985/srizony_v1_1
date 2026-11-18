-- 0022: Move special page composition and commonly used public UI copy into CMS data.
-- Safe to run more than once. Existing non-empty editor values always win.
BEGIN;

UPDATE public.pages AS p
SET render_cache = COALESCE(p.render_cache, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
    'pageView', CASE
      WHEN NOT (COALESCE(p.render_cache, '{}'::jsonb) ? 'pageView') AND p.slug = '/management-staff' THEN 'staff-directory'
      WHEN NOT (COALESCE(p.render_cache, '{}'::jsonb) ? 'pageView') AND p.slug = '/resources' THEN 'resource-library'
      ELSE NULL END,
    'showContactMap', CASE
      WHEN NOT (COALESCE(p.render_cache, '{}'::jsonb) ? 'showContactMap') AND p.slug = '/contact' THEN true
      ELSE NULL END,
    'cardStyle', CASE
      WHEN NOT (COALESCE(p.render_cache, '{}'::jsonb) ? 'cardStyle') AND p.slug = '/social-development' THEN 'social'
      WHEN NOT (COALESCE(p.render_cache, '{}'::jsonb) ? 'cardStyle') AND p.slug = '/enterprise-development' THEN 'enterprise'
      ELSE NULL END
  )),
  updated_at = now()
WHERE p.slug IN ('/management-staff', '/resources', '/contact', '/social-development', '/enterprise-development');

INSERT INTO public.ui_content (key, value_en, value_bn, updated_at) VALUES
('staff.roleLabel', 'MANAGEMENT TEAM', 'ব্যবস্থাপনা দল', now()),
('staff.showLess', 'Show less', 'সংক্ষিপ্ত দেখুন', now()),
('staff.readProfile', 'Read full profile', 'সম্পূর্ণ পরিচিতি', now()),
('staff.eyebrow', 'LEADERSHIP & MANAGEMENT', 'নেতৃত্ব ও ব্যবস্থাপনা', now()),
('staff.heading', 'Meet our management team', 'আমাদের ব্যবস্থাপনা দল', now()),
('staff.intro', 'Get to know the people responsible for guiding and supporting the work of Srizony Foundation.', 'সৃজনী ফাউন্ডেশনের কার্যক্রম পরিচালনা ও বাস্তবায়নে দায়িত্বপ্রাপ্ত ব্যক্তিদের পরিচিতি।', now()),
('staff.publishedProfiles', 'published profiles', 'প্রকাশিত প্রোফাইল', now()),
('staff.searchLabel', 'Search by name, designation or profile', 'নাম, পদবি বা পরিচিতি দিয়ে খুঁজুন', now()),
('staff.searchPlaceholder', 'Search name, designation or profile', 'নাম, পদবি বা পরিচিতি দিয়ে খুঁজুন', now()),
('staff.clearSearch', 'Clear search', 'অনুসন্ধান মুছুন', now()),
('staff.loading', 'Loading staff directory…', 'তথ্য লোড হচ্ছে…', now()),
('staff.loadErrorTitle', 'Staff information could not be loaded', 'তথ্য লোড করা যায়নি', now()),
('staff.loadErrorMessage', 'Please refresh the page and try again.', 'অনুগ্রহ করে পরে আবার চেষ্টা করুন।', now()),
('staff.emptyTitle', 'Management staff information will be published soon', 'ব্যবস্থাপনা কর্মকর্তাদের তথ্য শিগগির প্রকাশ করা হবে', now()),
('staff.emptyMessage', 'This directory will be updated when approved staff records are added by the website administrator.', 'অনুমোদিত তথ্য যুক্ত হলে এই তালিকা হালনাগাদ হবে।', now()),
('staff.noResultsTitle', 'No matching profiles found', 'কোনো প্রোফাইল পাওয়া যায়নি', now()),
('staff.noResultsMessage', 'Try a different name or designation.', 'অন্য শব্দ দিয়ে খুঁজুন।', now()),
('resources.staffTitle', 'Staff List', 'কর্মকর্তা-কর্মচারীর তালিকা', now()),
('resources.locationsTitle', 'Working Locations', 'কার্যালয় ও কার্যক্রমের স্থান', now()),
('resources.publicationTitle', 'Publication', 'প্রকাশনা', now()),
('resources.staffSummary', 'The approved staff list, available as a PDF document.', 'অনুমোদিত কর্মকর্তা-কর্মচারীর তালিকা PDF ফাইলে।', now()),
('resources.locationsSummary', 'Head office, working locations and branch offices in one PDF directory.', 'কার্যালয়, কার্যক্রমের স্থান ও শাখার তালিকা PDF ফাইলে।', now()),
('resources.reportSummary', 'An official publication from Srizony Foundation.', 'প্রকাশিত প্রতিবেদন ও প্রাতিষ্ঠানিক তথ্য।', now()),
('resources.filterAll', 'All resources', 'সব রিসোর্স', now()),
('resources.filterReports', 'Reports', 'প্রতিবেদন', now()),
('resources.filterDocuments', 'Official documents', 'অফিসিয়াল ডকুমেন্ট', now()),
('resources.eyebrow', 'PUBLICATIONS & INFORMATION', 'প্রকাশনা ও তথ্যভান্ডার', now()),
('resources.heading', 'Resources and updates', 'রিসোর্স ও হালনাগাদ', now()),
('resources.intro', 'Browse annual reports, official documents and published information from Srizony Foundation.', 'বার্ষিক প্রতিবেদন, প্রাতিষ্ঠানিক নথি ও প্রকাশিত তথ্য এক জায়গায় খুঁজুন।', now()),
('resources.availableItems', 'available items', 'টি রিসোর্স', now()),
('resources.searchLabel', 'Search resources', 'রিসোর্স খুঁজুন', now()),
('resources.searchPlaceholder', 'Search reports and documents', 'প্রতিবেদন বা ডকুমেন্ট খুঁজুন', now()),
('resources.filterLabel', 'Filter resources', 'রিসোর্স ফিল্টার', now()),
('resources.loading', 'Loading documents…', 'ডকুমেন্ট লোড হচ্ছে…', now()),
('resources.loadErrorTitle', 'Documents could not be loaded', 'ডকুমেন্ট লোড করা যায়নি', now()),
('resources.loadErrorMessage', 'Please refresh the page and try again.', 'অনুগ্রহ করে পরে আবার চেষ্টা করুন।', now()),
('resources.publication', 'PUBLICATION', 'প্রকাশনা', now()),
('resources.officialDocument', 'OFFICIAL DOCUMENT', 'অফিসিয়াল ডকুমেন্ট', now()),
('resources.download', 'Download document', 'PDF ডাউনলোড করুন', now()),
('resources.pending', 'Document has not been published yet', 'ডকুমেন্ট শিগগির প্রকাশ করা হবে', now()),
('resources.noResultsTitle', 'No matching resources found', 'কোনো রিসোর্স পাওয়া যায়নি', now()),
('resources.noResultsMessage', 'Try another search term or clear the selected filter.', 'অন্য শব্দ দিয়ে খুঁজুন অথবা সব রিসোর্স দেখুন।', now()),
('resources.clearFilters', 'Clear filters', 'ফিল্টার মুছুন', now()),
('resources.staffLinkTitle', 'Meet the management team', 'ব্যবস্থাপনা দলের পরিচিতি', now()),
('resources.staffLinkDescription', 'View leadership and management profiles.', 'সৃজনী ফাউন্ডেশনের ব্যবস্থাপনা কর্মকর্তাদের প্রোফাইল দেখুন।', now()),
('resources.viewProfiles', 'View profiles', 'প্রোফাইল দেখুন', now())
ON CONFLICT (key) DO NOTHING;

COMMIT;
