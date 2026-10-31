/**
 * Bundled bootstrap catalogue and deterministic build-time preview.
 *
 * systemData: defaults for system configuration (navigation, themes, media, UI copy, images).
 * contentData: baseline pages and entries used by the repeatable database seed.
 * Runtime public content is loaded from PostgreSQL; editors manage published content in the CMS.
 */
import { BriefcaseBusiness, Coins, CreditCard, Droplets, GraduationCap, HandHeart, HeartPulse, Landmark, Smartphone, SunMedium, WalletCards, Wheat } from 'lucide-react';
import { HERO_FEATURED, LEGACY_IMAGE, SLUG_IMAGE_KEYS, poolUrl } from './landingImages'
import { HOME_HERO_COPY_DEFAULTS } from './homeHeroDefaults'
import { contentDetails } from './contentDetails'
import { canonicalizeCmsRoute, getContentRouteParent } from '../lib/cms/routes'
import type { Bilingual, HeroData, MediaItem, NavGroup, NavItem, PageData, ContactInfo, ThemeDefinition, ContentEntry, Section, IconName, SDGStep, PaymentInfo } from '../types/entityType'

// ---- system: image registry ----
/**
 * Central image registry.
 * Change image paths here; rendering components should not need to change.
 * Supported formats: jpg, jpeg, png, webp, avif, gif and svg.
 */
const localImageManifest = {
  logo: '/images/Logo-SF.png',
  hero: {
    primary: '/images/hero-1.jpg',
    secondary: '/images/hero-2.jpg',
    feature: '/images/Hero-3.jpg',
  },
  general: {
    community: '/images/community.jpg',
    energy: '/images/energy.jpg',
    enterprise: '/images/enterprise.jpg',
    water: '/images/water.jpg',
    project1: '/images/project-1.jpg',
    project2: '/images/project-2.jpg',
    project3: '/images/project-3.jpg',
  },
  field: {
    climate: '/images/field/climate.jpg',
    education: '/images/field/education.jpg',
    health: '/images/field/health.jpg',
    livelihood: '/images/field/livelihood.jpg',
    partnership: '/images/field/partnership.jpg',
    rights: '/images/field/rights.jpg',
  },
  programs: {
    agricultureLivelihood: '/images/programs/agriculture-livelihood.jpg',
    climateChange: '/images/programs/climate-change.jpg',
    education: '/images/programs/education-program.jpg',
    health: '/images/programs/health-program.jpg',
    humanResource: '/images/programs/human-resource.jpg',
    humanRights: '/images/programs/human-rights.jpg',
    organizationalDevelopment: '/images/programs/organizational-development.jpg',
    socialEnterprise: '/images/programs/social-enterprise.jpg',
  },
  loans: {
    agriculture: '/images/loans/agri-development-loan.jpg',
    migrantHousehold: '/images/loans/household-migrant-loan.jpg',
    jobHolders: '/images/loans/job-holders-loan.jpg',
    ruralDevelopment: '/images/loans/rural-development-loan.jpg',
    smallEnterprise: '/images/loans/small-enterprise-loan.jpg',
    student: '/images/loans/student-loan.jpg',
    womenBusiness: '/images/loans/women-business-loan.jpg',
  },
  governance: {
    abulHashem: '/images/governance/abul-hashem.svg',
    afrozaBulbul: '/images/governance/afroza-bulbul.svg',
    aminBelal: '/images/governance/amin-belal.svg',
    hasinaAman: '/images/governance/hasina-aman.svg',
    manoarHossain: '/images/governance/manoar-hossain.svg',
    ohidulIslam: '/images/governance/ohidul-islam.svg',
    shamimUddinMia: '/images/governance/shamim-uddin-mia.svg',
  },
  projects: {
    adolescentProgram: '/images/projects/adolescent-program.svg',
    basicLiteracyProject64Districts: '/images/projects/basic-literacy-project-64-districts.svg',
    communityRadioJhenuk: '/images/projects/community-radio-radio-jhenuk.svg',
    culturalSports: '/images/projects/cultural-and-sports-program.svg',
    disabilityRehabilitation: '/images/projects/disability-rehabilitation.svg',
    disasterManagement: '/images/projects/disaster-management.svg',
    enrich: '/images/projects/enrich.svg',
    humanRightsGoodGovernance: '/images/projects/human-rights-and-good-governance.svg',
    improveCookStove: '/images/projects/improve-cook-stove.svg',
    lowCostHousingProject: '/images/projects/low-cost-housing-project.svg',
    lowCostHousing: '/images/projects/low-cost-housing.svg',
    microFinanceProgram: '/images/projects/micro-finance-program.svg',
    miniGrid: '/images/projects/mini-grid-project.svg',
    protectionWorkingChildren: '/images/projects/protection-of-working-children.svg',
    remittanceTransfer: '/images/projects/remittance-transfer-program.svg',
    safeWaterSanitation: '/images/projects/safe-drinking-water-sanitation.svg',
    secondChanceEducation: '/images/projects/second-chance-education.svg',
    socialAfforestation: '/images/projects/social-afforestation.svg',
    solarIrrigation: '/images/projects/solar-irrigation-pumping-system.svg',
    developmentCenter: '/images/projects/srizony-development-center.svg',
    hospitalProgram: '/images/projects/srizony-hospital-program.svg',
    offsetPrinters: '/images/projects/srizony-offset-printers-publication.svg',
    elderlyQualityLife: '/images/projects/uplifting-quality-of-life-elderly.svg',
    urbanPrimaryHealthCare: '/images/projects/urban-primary-health-care.svg',
  },
  news: {
    climateResilience: '/images/news/climate-resilience-update.svg',
    communityHealthNutrition: '/images/news/community-health-and-nutrition-update.svg',
    communityPartnership: '/images/news/community-partnership-update.svg',
    communityRightsGovernance: '/images/news/community-rights-and-governance-update.svg',
    educationSkills: '/images/news/education-and-skills-update.svg',
    livelihoodEnterprise: '/images/news/livelihood-and-enterprise-update.svg',
  },
  enterprise: {
    computerGarden: '/images/enterprise/srizony-computer-garden.svg',
    fillingStation: '/images/enterprise/srizony-filling-station.svg',
    hospital: '/images/enterprise/srizony-hospital.svg',
    internet: '/images/enterprise/srizony-internet.svg',
    motors: '/images/enterprise/srizony-motors.svg',
    polytechnic: '/images/enterprise/srizony-polytechnic.svg',
    printingPress: '/images/enterprise/srizony-printing-press.svg',
    university: '/images/enterprise/srizony-university.svg',
  },
  articleRelated: {
    adolescentProgram: '/images/article-related/adolescent-program.svg',
    basicLiteracyProject64Districts: '/images/article-related/basic-literacy-project-64-districts.svg',
    climateResilience: '/images/article-related/climate-resilience-update.svg',
    communityHealthNutrition: '/images/article-related/community-health-and-nutrition-update.svg',
    communityPartnership: '/images/article-related/community-partnership-update.svg',
    communityRadioJhenuk: '/images/article-related/community-radio-radio-jhenuk.svg',
    communityRightsGovernance: '/images/article-related/community-rights-and-governance-update.svg',
    culturalSports: '/images/article-related/cultural-and-sports-program.svg',
    disabilityRehabilitation: '/images/article-related/disability-rehabilitation.svg',
    disasterManagement: '/images/article-related/disaster-management.svg',
    educationSkills: '/images/article-related/education-and-skills-update.svg',
    enrich: '/images/article-related/enrich.svg',
    humanRightsGoodGovernance: '/images/article-related/human-rights-and-good-governance.svg',
    improveCookStove: '/images/article-related/improve-cook-stove.svg',
    livelihoodEnterprise: '/images/article-related/livelihood-and-enterprise-update.svg',
    lowCostHousingProject: '/images/article-related/low-cost-housing-project.svg',
    lowCostHousing: '/images/article-related/low-cost-housing.svg',
    microFinanceProgram: '/images/article-related/micro-finance-program.svg',
    miniGrid: '/images/article-related/mini-grid-project.svg',
    protectionWorkingChildren: '/images/article-related/protection-of-working-children.svg',
    remittanceTransfer: '/images/article-related/remittance-transfer-program.svg',
    safeWaterSanitation: '/images/article-related/safe-drinking-water-sanitation.svg',
    secondChanceEducation: '/images/article-related/second-chance-education.svg',
    socialAfforestation: '/images/article-related/social-afforestation.svg',
    solarIrrigation: '/images/article-related/solar-irrigation-pumping-system.svg',
    computerGarden: '/images/article-related/srizony-computer-garden.svg',
    developmentCenter: '/images/article-related/srizony-development-center.svg',
    fillingStation: '/images/article-related/srizony-filling-station.svg',
    hospitalProgram: '/images/article-related/srizony-hospital-program.svg',
    hospital: '/images/article-related/srizony-hospital.svg',
    internet: '/images/article-related/srizony-internet.svg',
    motors: '/images/article-related/srizony-motors.svg',
    offsetPrinters: '/images/article-related/srizony-offset-printers-publication.svg',
    polytechnic: '/images/article-related/srizony-polytechnic.svg',
    printingPress: '/images/article-related/srizony-printing-press.svg',
    university: '/images/article-related/srizony-university.svg',
    elderlyQualityLife: '/images/article-related/uplifting-quality-of-life-elderly.svg',
    urbanPrimaryHealthCare: '/images/article-related/urban-primary-health-care.svg',
  },
} as const

/** Images used by seeded content are served from public Unsplash image URLs, not local public/images assets. */
const openImageSources = {
  community: 'https://images.unsplash.com/photo-1766858669684-4e501b3b9f9f?auto=format&fit=crop&w=1800&q=85',
  education: 'https://images.unsplash.com/photo-1777725770744-e66b802dbf60?auto=format&fit=crop&w=1800&q=85',
  agriculture: 'https://images.unsplash.com/photo-1761961851508-43db0337480a?auto=format&fit=crop&w=1800&q=85',
  rights: 'https://images.unsplash.com/photo-1722932592507-59b3a3ac368d?auto=format&fit=crop&w=1800&q=85',
  village: 'https://images.unsplash.com/photo-1681672705104-c78e31a8d111?auto=format&fit=crop&w=1800&q=85',
  climate: 'https://images.unsplash.com/photo-1668940004859-c3b8249e8067?auto=format&fit=crop&w=1800&q=85',
  farming: 'https://images.unsplash.com/photo-1738233505102-1bd26c33679e?auto=format&fit=crop&w=1800&q=85',
  health: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1800&q=85',
  digital: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=85',
  campus: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1800&q=85',
  office: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85',
  water: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=1800&q=85',
  schoolgirls: 'https://images.unsplash.com/photo-1573894998033-c0cef4ed722b?auto=format&fit=crop&w=1800&q=85',
  womenInAgriculture: 'https://images.unsplash.com/photo-1774504798125-bd6eed7063fc?auto=format&fit=crop&w=1800&q=85',
  clinic: 'https://images.unsplash.com/photo-1774979161296-bb930552543a?auto=format&fit=crop&w=1800&q=85',
  communityAction: 'https://images.unsplash.com/photo-1722944759942-791464a16ee0?auto=format&fit=crop&w=1800&q=85',
  solar: 'https://images.unsplash.com/photo-1784623305001-c7aebfc7f226?auto=format&fit=crop&w=1800&q=85',
  riceFarmer: 'https://images.unsplash.com/photo-1558289282-647de9fdf608?auto=format&fit=crop&w=1800&q=85',
  waterHands: 'https://images.unsplash.com/photo-1574482620811-1aa16ffe3c82?auto=format&fit=crop&w=1800&q=85',
  sewing: 'https://images.unsplash.com/photo-1765658559220-6b51dbabe850?auto=format&fit=crop&w=1800&q=85',
  floodResilience: 'https://images.unsplash.com/photo-1759261158814-e5c651e30714?auto=format&fit=crop&w=1800&q=85',
  handwashing: 'https://images.unsplash.com/photo-1780504863172-22655ab910ae?auto=format&fit=crop&w=1800&q=85',
  elderly: 'https://images.unsplash.com/photo-1771699435693-52329f0d18ff?auto=format&fit=crop&w=1800&q=85',
  cleanCooking: 'https://images.unsplash.com/photo-1697378149850-0910bce142b7?auto=format&fit=crop&w=1800&q=85',
  sportsField: 'https://images.unsplash.com/photo-1760510088582-3ca0631ad84f?auto=format&fit=crop&w=1800&q=85',
  childrenCommunity: 'https://images.unsplash.com/photo-1780282148151-e53f763cbb30?auto=format&fit=crop&w=1800&q=85',
  mobileMoney: 'https://images.unsplash.com/photo-1681826291722-70bd7e9e6fc3?auto=format&fit=crop&w=1800&q=85',
  villageHome: 'https://images.unsplash.com/photo-1767154966831-9607c8322a5a?auto=format&fit=crop&w=1800&q=85',
  elderlyBangladesh: 'https://images.unsplash.com/photo-1758726948996-c2390f716d70?auto=format&fit=crop&w=1800&q=85',
} as const


const projectPhotoUrls: Record<string, string> = {
  'protection-of-working-children': openImageSources.childrenCommunity,
  'second-chance-education': openImageSources.education,
  'basic-literacy-project-64-districts': openImageSources.digital,
  'low-cost-housing': openImageSources.village,
  'enrich': openImageSources.community,
  'community-radio-radio-jhenuk': openImageSources.communityAction,
  'mini-grid-project': openImageSources.solar,
  'solar-irrigation-pumping-system': openImageSources.riceFarmer,
  'disability-rehabilitation': openImageSources.health,
  'urban-primary-health-care': openImageSources.clinic,
  'disaster-management': openImageSources.floodResilience,
  'safe-drinking-water-sanitation': openImageSources.handwashing,
  'cultural-and-sports-program': openImageSources.sportsField,
  'uplifting-quality-of-life-elderly': openImageSources.elderlyBangladesh,
  'improve-cook-stove': openImageSources.cleanCooking,
  'adolescent-program': openImageSources.schoolgirls,
  'social-afforestation': openImageSources.womenInAgriculture,
  'srizony-offset-printers-publication': openImageSources.office,
  'srizony-development-center': openImageSources.campus,
  'remittance-transfer-program': openImageSources.mobileMoney,
  'micro-finance-program': openImageSources.sewing,
  'srizony-hospital-program': openImageSources.waterHands,
  'human-rights-and-good-governance': openImageSources.rights,
  'low-cost-housing-project': openImageSources.villageHome,
  // Additional content collections use matching subjects while keeping each carousel/card set visually varied.
  'community-health-and-nutrition-update': openImageSources.clinic,
  'livelihood-and-enterprise-update': openImageSources.farming,
  'education-and-skills-update': openImageSources.childrenCommunity,
  'community-rights-and-governance-update': openImageSources.rights,
  'climate-resilience-update': openImageSources.climate,
  'community-partnership-update': openImageSources.agriculture,
  'srizony-hospital': openImageSources.health,
  'srizony-university': openImageSources.campus,
  'srizony-polytechnic': openImageSources.education,
  'srizony-printing-press': openImageSources.office,
  'srizony-filling-station': openImageSources.community,
  'srizony-internet': openImageSources.digital,
  'srizony-computer-garden': openImageSources.mobileMoney,
  'srizony-motors': openImageSources.riceFarmer,
}
// Landing-page enterprise and field-news cards: one distinct picture each (see data/landingImages.ts).
for (const [slug, key] of Object.entries(SLUG_IMAGE_KEYS)) projectPhotoUrls[slug] = poolUrl(key)

export function openImageUrlForPath(path: string): string {
  if (!path.startsWith('/images/') || /logo-sf\./i.test(path)) return path
  const key = path.toLowerCase()
  const fileSlug = key.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
  if (projectPhotoUrls[fileSlug]) return projectPhotoUrls[fileSlug]
  // Keep fallback media topic-related when no exact content slug is available.
  if (/hero-1\./.test(key)) return openImageSources.community
  if (/hero-2\./.test(key)) return openImageSources.womenInAgriculture
  if (/hero-3\./.test(key)) return openImageSources.clinic
  if (/project-2\./.test(key)) return openImageSources.village
  if (/project-3\./.test(key)) return openImageSources.farming
  if (/\/governance\//.test(key)) {
    const label = path.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') || 'Foundation member'
    return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(label)}&backgroundColor=e7f4ec&textColor=137b50`
  }
  if (/elderly|older-people/.test(key)) return openImageSources.elderly
  if (/cook-stove|cooking/.test(key)) return openImageSources.cleanCooking
  if (/urban-primary-health|clinic/.test(key)) return openImageSources.clinic
  if (/health|hospital|nutrition|medical|care/.test(key)) return openImageSources.health
  if (/school|literacy|adolescent|child|education/.test(key)) return openImageSources.schoolgirls
  if (/university|polytechnic|student|learning/.test(key)) return openImageSources.campus
  if (/right|governance|protection|disability|women/.test(key)) return openImageSources.rights
  if (/solar|mini-grid|energy/.test(key)) return openImageSources.solar
  if (/afforestation|women-in-agriculture/.test(key)) return openImageSources.womenInAgriculture
  if (/agri|farm|livelihood|irrigation|crop|loan|micro-finance/.test(key)) return /loan|micro-finance/.test(key) ? openImageSources.sewing : openImageSources.riceFarmer
  if (/climate|disaster|environment/.test(key)) return openImageSources.floodResilience
  if (/water|sanitation|handwash/.test(key)) return openImageSources.waterHands
  if (/internet|computer|digital|radio/.test(key)) return openImageSources.digital
  if (/printing|press|office|management|team|staff|leadership|organization/.test(key)) return openImageSources.office
  if (/business|enterprise|microfinance|micro-finance/.test(key)) return openImageSources.sewing
  if (/motor|filling/.test(key)) return openImageSources.community
  if (/village|housing|rural|footprint|project-1|project-2|project-3|community|partnership|general/.test(key)) return /housing|village|rural|footprint/.test(key) ? openImageSources.village : openImageSources.community
  if (/energy/.test(key)) return openImageSources.solar
  return openImageSources.community
}

function externalizeImageManifest<T>(value: T): T {
  if (typeof value === 'string') return openImageUrlForPath(value) as T
  if (Array.isArray(value)) return value.map((item) => externalizeImageManifest(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, externalizeImageManifest(child)])) as T
  }
  return value
}

const images = externalizeImageManifest(localImageManifest) as unknown as typeof localImageManifest

const byFileName: Record<string, string> = Object.values(images).flatMap(group =>
  typeof group === 'string' ? [[group.split('/').pop()!.replace(/\.[^.]+$/, ''), group]] :
  Object.values(group).map(src => [src.split('/').pop()!.replace(/\.[^.]+$/, ''), src] as [string, string])
).reduce<Record<string, string>>((acc, [key, value]) => { acc[key] = value; return acc }, {})

/** Resolve a content slug to the configured image. */
function imageForSlug(slug: string, kind: 'project' | 'news' | 'enterprise' | 'article-related' = 'project') {
  const specific = projectPhotoUrls[slug.toLowerCase()]
  if (specific) return specific
  const direct = byFileName[slug]
  if (direct && (kind === 'project' || kind === 'article-related')) return direct
  const group = kind === 'article-related' ? images.articleRelated : kind === 'news' ? images.news : kind === 'enterprise' ? images.enterprise : images.projects
  const normalized = slug.toLowerCase()
  const match = Object.entries(group).find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized.replace(/[^a-z0-9]/g, '')))?.[1]
  if (match) return match
  return openImageUrlForPath(`/images/${normalized}.jpg`)
}

// ---- system: themes ----
const themes = {
  forest: { label:{en:'Forest',bn:'ফরেস্ট'}, primary:'#137b50', secondary:'#e56a3f', accent:'#f4c94b', background:'#f7faf8', surface:'#ffffff', surfaceAlt:'#eef6f1', surfaceRaised:'#ffffff', border:'#dbe7e0', ink:'#17251e', muted:'#66756d', headerBg:'#ffffff', headerInk:'#22352b', footerBg:'#0f2419', footerInk:'#f2faf5', success:'#2e8b57', warning:'#b97816', danger:'#c54848', focus:'#239b68', darkBackground:'#0b1510', darkSurface:'#121b16', darkSurfaceAlt:'#19251f', darkSurfaceRaised:'#1d2b24', darkBorder:'#2b3b33', darkInk:'#eef6f1', darkMuted:'#aab8b0', darkHeaderBg:'#101912', darkHeaderInk:'#eff8f2', darkFooterBg:'#08120d', darkFooterInk:'#eff8f2', typography:{body:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",display:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",tracking:'-0.028em',radius:'16px'} },
  ocean: { label:{en:'Ocean',bn:'ওশান'}, primary:'#0b6675', secondary:'#e46f61', accent:'#54c1d0', background:'#f5fafb', surface:'#ffffff', surfaceAlt:'#ebf7f8', surfaceRaised:'#ffffff', border:'#d5e7ea', ink:'#102b31', muted:'#5e7378', headerBg:'#ffffff', headerInk:'#17363c', footerBg:'#082c34', footerInk:'#effbfc', success:'#2f907f', warning:'#b97722', danger:'#c84d45', focus:'#3f9eae', darkBackground:'#071316', darkSurface:'#0d2024', darkSurfaceAlt:'#112c31', darkSurfaceRaised:'#15353b', darkBorder:'#284149', darkInk:'#ecf8fa', darkMuted:'#a9c5ca', darkHeaderBg:'#0b1c20', darkHeaderInk:'#eef9fa', darkFooterBg:'#061013', darkFooterInk:'#effbfc', typography:{body:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",display:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",tracking:'-0.032em',radius:'18px'} },
  plum: { label:{en:'Plum',bn:'প্লাম'}, primary:'#68456f', secondary:'#d56a62', accent:'#dfbb70', background:'#faf7fb', surface:'#ffffff', surfaceAlt:'#f4edf7', surfaceRaised:'#ffffff', border:'#e5d9e8', ink:'#2b2030', muted:'#716778', headerBg:'#ffffff', headerInk:'#34263a', footerBg:'#2a1c2f', footerInk:'#fcf8fd', success:'#56896e', warning:'#ae771e', danger:'#c44d4d', focus:'#8a61a0', darkBackground:'#110b13', darkSurface:'#1c1420', darkSurfaceAlt:'#261a2a', darkSurfaceRaised:'#30203a', darkBorder:'#493650', darkInk:'#f8effa', darkMuted:'#c5b6c9', darkHeaderBg:'#18101a', darkHeaderInk:'#f9f1fa', darkFooterBg:'#0f0a11', darkFooterInk:'#f8eef9', typography:{body:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",display:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",tracking:'-0.03em',radius:'18px'} },
  sage: { label:{en:'Sage',bn:'সেজ'}, primary:'#5f7f67', secondary:'#b1784f', accent:'#d8bd6a', background:'#f7f8f3', surface:'#ffffff', surfaceAlt:'#eff3ec', surfaceRaised:'#ffffff', border:'#dbe3d7', ink:'#253128', muted:'#68756c', headerBg:'#ffffff', headerInk:'#334239', footerBg:'#253128', footerInk:'#f5f8f4', success:'#5f8f68', warning:'#ae7627', danger:'#bd5750', focus:'#789785', darkBackground:'#0e1610', darkSurface:'#151e17', darkSurfaceAlt:'#1e2a21', darkSurfaceRaised:'#28362b', darkBorder:'#3b4b3d', darkInk:'#eff5ef', darkMuted:'#aeb9b0', darkHeaderBg:'#131b15', darkHeaderInk:'#eef5ee', darkFooterBg:'#0c120d', darkFooterInk:'#eef5ee', typography:{body:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",display:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",tracking:'-0.026em',radius:'17px'} },
  terracotta: { label:{en:'Terracotta',bn:'টেরাকোটা'}, primary:'#a7553d', secondary:'#557c68', accent:'#d8a455', background:'#fbf7f4', surface:'#ffffff', surfaceAlt:'#f6eeea', surfaceRaised:'#ffffff', border:'#eaded7', ink:'#33231d', muted:'#786962', headerBg:'#ffffff', headerInk:'#4b3028', footerBg:'#3a2017', footerInk:'#fff7f2', success:'#4f8a69', warning:'#b3771e', danger:'#c55249', focus:'#be755f', darkBackground:'#170e0b', darkSurface:'#211613', darkSurfaceAlt:'#2c1c17', darkSurfaceRaised:'#38241d', darkBorder:'#4d352c', darkInk:'#fbf1eb', darkMuted:'#c9b5ad', darkHeaderBg:'#1b1210', darkHeaderInk:'#fcf2ec', darkFooterBg:'#120a08', darkFooterInk:'#fff5ef', typography:{body:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",display:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",tracking:'-0.028em',radius:'17px'} },
  midnight: { label:{en:'Midnight',bn:'মিডনাইট'}, primary:'#173d5b', secondary:'#b55f5f', accent:'#d7b45f', background:'#f4f7fa', surface:'#ffffff', surfaceAlt:'#edf3f7', surfaceRaised:'#ffffff', border:'#d8e1e8', ink:'#1d2b36', muted:'#65737c', headerBg:'#ffffff', headerInk:'#263b4b', footerBg:'#111f2b', footerInk:'#f3f8fc', success:'#5d966f', warning:'#a97622', danger:'#c34f4f', focus:'#4e7799', darkBackground:'#0b1117', darkSurface:'#111c24', darkSurfaceAlt:'#16252f', darkSurfaceRaised:'#1d303c', darkBorder:'#304452', darkInk:'#eef5fa', darkMuted:'#a8bbc7', darkHeaderBg:'#0d171f', darkHeaderInk:'#f0f6fa', darkFooterBg:'#081018', darkFooterInk:'#eff6fb', typography:{body:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",display:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",tracking:'-0.03em',radius:'18px'} },
  sand: { label:{en:'Sand',bn:'স্যান্ড'}, primary:'#9a6e35', secondary:'#5c7762', accent:'#d5b36a', background:'#fcfaf5', surface:'#ffffff', surfaceAlt:'#f6f0e4', surfaceRaised:'#ffffff', border:'#eadfca', ink:'#342b20', muted:'#736b5f', headerBg:'#ffffff', headerInk:'#4b4032', footerBg:'#352512', footerInk:'#fff8ea', success:'#648b66', warning:'#ae741b', danger:'#bd5449', focus:'#b18a4d', darkBackground:'#17130d', darkSurface:'#211c14', darkSurfaceAlt:'#2b2419', darkSurfaceRaised:'#382d1d', darkBorder:'#4c402d', darkInk:'#f8f0e2', darkMuted:'#c6b99f', darkHeaderBg:'#1d1911', darkHeaderInk:'#fbf2e3', darkFooterBg:'#100c08', darkFooterInk:'#fff7e9', typography:{body:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",display:"'Poppins','Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",tracking:'-0.025em',radius:'16px'} },
} as const

// ---- system: media ----
const media = {
  founder: images.hero.secondary,
  hero: [images.hero.primary,images.hero.feature,images.hero.secondary],
  gallery: [images.general.project1,images.general.project2,images.general.project3],
  officialVideoEmbedUrl: 'https://www.youtube.com/embed/9IFPYx95Jpg',
  officialVideoSourceUrl: 'https://www.youtube.com/watch?v=9IFPYx95Jpg',
  featureVideoEmbedUrl: 'https://www.youtube.com/embed/9IFPYx95Jpg',
  featureVideoSourceUrl: 'https://www.youtube.com/watch?v=9IFPYx95Jpg',
  reports: [],
}

// ---- system: home ----

const homeHero: HeroData = {
  ...HOME_HERO_COPY_DEFAULTS,
  slides: [
    {
      id: 'community-development',
      image: images.hero.primary,
      title: { en: 'Community-led development', bn: 'কমিউনিটি নেতৃত্বাধীন উন্নয়ন' },
      description: { en: 'Programs designed around local priorities and participation.', bn: 'স্থানীয় প্রয়োজন ও অংশগ্রহণকে কেন্দ্র করে কর্মসূচি।' },
      href: '/social-development',
    },
    {
      id: 'women-and-livelihoods',
      image: images.hero.secondary,
      title: { en: 'Women, livelihoods and opportunity', bn: 'নারী, জীবিকা ও সুযোগ' },
      description: { en: 'Financial inclusion and livelihood pathways that strengthen families.', bn: 'আর্থিক অন্তর্ভুক্তি ও জীবিকার মাধ্যমে পরিবারকে আরও সক্ষম করা।' },
      href: '/microfinance-program',
    },
    {
      id: 'health-and-education',
      image: images.hero.feature,
      title: { en: 'Health, education and dignity', bn: 'স্বাস্থ্য, শিক্ষা ও মর্যাদা' },
      description: { en: 'Expanding access to essential services and practical learning.', bn: 'প্রয়োজনীয় সেবা ও ব্যবহারিক শিক্ষার সুযোগ সম্প্রসারণ।' },
      href: '/social-development/health-program',
    },
  ],
  stats: [
    { id: 'years', icon: 'heart', value: { en: '1985', bn: '১৯৮৫' }, label: { en: 'Established', bn: 'প্রতিষ্ঠিত' } },
    { id: 'staff', icon: 'users', value: { en: '2,540', bn: '২,৫৪০' }, label: { en: 'Staff', bn: 'কর্মী' } },
    { id: 'branches', icon: 'building', value: { en: '80', bn: '৮০' }, label: { en: 'Branches', bn: 'শাখা' } },
    { id: 'villages', icon: 'location', value: { en: '1,898', bn: '১,৮৯৮' }, label: { en: 'Villages', bn: 'গ্রাম' } },
    { id: 'members', icon: 'users', value: { en: '69,753', bn: '৬৯,৭৫৩' }, label: { en: 'Members', bn: 'সদস্য' } },
  ],
}

// ---- content: entries ----

const img = (src: string, hoverSrc: string, title: Bilingual): MediaItem => ({ src, hoverSrc, alt: title })

const contentPhotoPool = [
  images.field.health,
  images.field.livelihood,
  images.field.education,
  images.field.rights,
  images.field.climate,
  images.field.partnership,
] as const

function photoFor(slug: string) {
  const rules: Array<[string,string]> = [
    ['health',images.field.health],['hospital',images.field.health],['nutrition',images.field.health],
    ['education',images.field.education],['literacy',images.field.education],['skills',images.field.education],
    ['rights',images.field.rights],['governance',images.field.rights],['children',images.field.rights],['disability',images.field.rights],
    ['climate',images.field.climate],['solar',images.field.climate],['cook-stove',images.field.climate],['afforestation',images.field.climate],['disaster',images.field.climate],
    ['agri',images.field.livelihood],['livelihood',images.field.livelihood],['enterprise',images.field.livelihood],['housing',images.general.community],
    ['radio',images.field.partnership],['community',images.field.partnership],['remittance',images.field.livelihood],
  ]
  const key=slug.toLowerCase()
  const found=rules.find(([needle])=>key.includes(needle))
  return found?.[1] ?? contentPhotoPool[slug.length % contentPhotoPool.length]
}


const projectImage = (slug: string, title: Bilingual): MediaItem => {
  const isNews = slug.endsWith('-update') || slug.includes('resilience') || slug.includes('partnership')
  const isEnterprise = ['hospital','university','polytechnic','printing','filling','internet','computer','motors'].some(k => slug.includes(k))
  return { src: imageForSlug(slug, isNews ? 'news' : isEnterprise ? 'enterprise' : 'project'), alt: title }
}
const relatedImage = (slug: string, title: Bilingual): MediaItem => ({src:imageForSlug(slug,'article-related'),alt:{en:`${title.en} related field image`,bn:`${title.bn} সম্পর্কিত মাঠপর্যায়ের ছবি`}})

const projectEntries: ContentEntry[] = [
  ['Protection of Working Children','কর্মজীবী শিশু সুরক্ষা','protection-of-working-children','Supports children exposed to hazardous or exploitative work through protection, access to learning and community-based support.','ঝুঁকিপূর্ণ বা শোষণমূলক কাজে যুক্ত শিশুদের সুরক্ষা, শিক্ষায় প্রবেশাধিকার ও কমিউনিটি সহায়তার মাধ্যমে সমর্থন করে।','The program focuses on children’s safety, education and social inclusion. Current activities, locations and outcomes should be confirmed through approved project records.','এই কর্মসূচি শিশুদের নিরাপত্তা, শিক্ষা ও সামাজিক অন্তর্ভুক্তির ওপর গুরুত্ব দেয়। চলমান কার্যক্রম, এলাকা ও ফলাফল অনুমোদিত প্রকল্প নথি থেকে নিশ্চিত করতে হবে।'],
  ['Second Chance Education','সেকেন্ড চান্স শিক্ষা','second-chance-education','Creates pathways back to learning for children and young people who have missed or interrupted formal schooling.','প্রাতিষ্ঠানিক শিক্ষা থেকে ঝরে পড়া বা বিরতি নেওয়া শিশু ও তরুণদের পুনরায় শেখার সুযোগ তৈরি করে।','Flexible learning, foundational skills and continued educational support can help learners re-enter education and strengthen their future options. The latest delivery details should be confirmed with the program team.','নমনীয় শিক্ষা, মৌলিক দক্ষতা এবং ধারাবাহিক সহায়তা শিক্ষার্থীদের পুনরায় শিক্ষায় যুক্ত হতে ও ভবিষ্যৎ সুযোগ বাড়াতে সাহায্য করতে পারে। সর্বশেষ কার্যক্রমের বিবরণ কর্মসূচি দলের কাছ থেকে নিশ্চিত করতে হবে।'],
  ['Basic Literacy Project — 64 Districts','বেসিক লিটারেসি প্রকল্প — ৬৪ জেলা','basic-literacy-project-64-districts','Promotes foundational literacy and practical learning for people who have limited access to education.','শিক্ষার সীমিত সুযোগ পাওয়া মানুষের মৌলিক সাক্ষরতা ও ব্যবহারিক শেখার সুযোগ বাড়ায়।','The project is designed around foundational reading, writing and learning skills. Geographic coverage and current implementation status should be verified in the approved project records.','প্রকল্পটি পড়া, লেখা ও মৌলিক শেখার দক্ষতার ওপর ভিত্তি করে পরিকল্পিত। ভৌগোলিক আওতা ও বর্তমান বাস্তবায়নের অবস্থা অনুমোদিত প্রকল্প নথি থেকে যাচাই করতে হবে।'],
  ['Low-Cost Housing','স্বল্পমূল্যের আবাসন','low-cost-housing','Focuses on safer and more affordable housing options for households facing housing insecurity.','আবাসন অনিশ্চয়তায় থাকা পরিবারের জন্য নিরাপদ ও সাশ্রয়ী আবাসনের সুযোগের ওপর গুরুত্ব দেয়।','Housing support may include appropriate construction options, household-level assistance and community infrastructure. Availability and eligibility must be confirmed with the foundation.','আবাসন সহায়তার মধ্যে উপযুক্ত নির্মাণ বিকল্প, পরিবারভিত্তিক সহায়তা ও কমিউনিটি অবকাঠামো অন্তর্ভুক্ত হতে পারে। প্রাপ্যতা ও যোগ্যতা ফাউন্ডেশনের সঙ্গে নিশ্চিত করতে হবে।'],
  ['ENRICH','এনরিচ','enrich','Uses an integrated community-development approach to connect household livelihoods with essential social services.','পরিবারের জীবিকা ও প্রয়োজনীয় সামাজিক সেবাকে যুক্ত করতে সমন্বিত কমিউনিটি উন্নয়ন পদ্ধতি ব্যবহার করে।','The approach brings together local priorities, livelihood strengthening and access to services. Current activities and verified outcomes should be drawn from the latest program documentation.','এই পদ্ধতিতে স্থানীয় অগ্রাধিকার, জীবিকা শক্তিশালীকরণ ও সেবায় প্রবেশাধিকারকে একত্র করা হয়। চলমান কার্যক্রম ও যাচাইকৃত ফলাফল সর্বশেষ কর্মসূচির নথি থেকে নিতে হবে।'],
  ['Community Radio — Radio Jhenuk','কমিউনিটি রেডিও — রেডিও ঝিনুক','community-radio-radio-jhenuk','Provides a local communication channel for information, awareness and community voices.','তথ্য, সচেতনতা ও কমিউনিটির কণ্ঠ তুলে ধরার জন্য স্থানীয় যোগাযোগমাধ্যম হিসেবে কাজ করে।','Community radio can share practical information on health, education, rights, agriculture and local development. Broadcast schedules and active programming should be checked with the station.','কমিউনিটি রেডিও স্বাস্থ্য, শিক্ষা, অধিকার, কৃষি ও স্থানীয় উন্নয়ন বিষয়ে ব্যবহারিক তথ্য প্রচার করতে পারে। সম্প্রচার সূচি ও চলমান অনুষ্ঠান স্টেশনের সঙ্গে যাচাই করতে হবে।'],
  ['Mini-grid Project','মিনি-গ্রিড প্রকল্প','mini-grid-project','Explores local energy infrastructure to improve access to dependable electricity in underserved areas.','সেবা-বঞ্চিত এলাকায় নির্ভরযোগ্য বিদ্যুতের সুযোগ বাড়াতে স্থানীয় জ্বালানি অবকাঠামোর ওপর গুরুত্ব দেয়।','Mini-grid systems can support homes, community services and local economic activity. Site coverage, technology and operating status should be confirmed through project documentation.','মিনি-গ্রিড ব্যবস্থা বাড়ি, কমিউনিটি সেবা ও স্থানীয় অর্থনৈতিক কর্মকাণ্ডে সহায়তা করতে পারে। প্রকল্পের এলাকা, প্রযুক্তি ও পরিচালন অবস্থা নথি থেকে নিশ্চিত করতে হবে।'],
  ['Solar Irrigation Pumping System','সোলার ইরিগেশন পাম্পিং সিস্টেম','solar-irrigation-pumping-system','Promotes solar-powered irrigation as an alternative energy option for agricultural water management.','কৃষিতে পানি ব্যবস্থাপনার বিকল্প শক্তি হিসেবে সৌরচালিত সেচকে উৎসাহিত করে।','Solar irrigation may help reduce dependence on conventional fuels and support more resilient farming. Installed capacity, locations and measured results should be confirmed before publication.','সৌর সেচ প্রচলিত জ্বালানির ওপর নির্ভরতা কমাতে এবং কৃষিকে আরও সহনশীল করতে সহায়তা করতে পারে। স্থাপিত সক্ষমতা, এলাকা ও পরিমাপ করা ফলাফল প্রকাশের আগে নিশ্চিত করতে হবে।'],
  ['Disability Rehabilitation','প্রতিবন্ধী পুনর্বাসন','disability-rehabilitation','Supports rehabilitation, participation and inclusion for people with disabilities.','প্রতিবন্ধী মানুষের পুনর্বাসন, অংশগ্রহণ ও অন্তর্ভুক্তিকে সহায়তা করে।','Services may involve referrals, rehabilitation support, assistive devices and connections to appropriate community services. Confirm the current service list and referral process with the program team.','সেবার মধ্যে রেফারাল, পুনর্বাসন সহায়তা, সহায়ক উপকরণ এবং উপযুক্ত কমিউনিটি সেবার সঙ্গে সংযোগ থাকতে পারে। বর্তমান সেবার তালিকা ও রেফারাল প্রক্রিয়া কর্মসূচি দলের সঙ্গে নিশ্চিত করতে হবে।'],
  ['Urban Primary Health Care','নগর প্রাথমিক স্বাস্থ্যসেবা','urban-primary-health-care','Focuses on improving access to essential primary healthcare for urban and underserved communities.','নগর ও সেবা-বঞ্চিত কমিউনিটির জন্য প্রয়োজনীয় প্রাথমিক স্বাস্থ্যসেবার সুযোগ বাড়ানোর ওপর গুরুত্ব দেয়।','Primary healthcare may include prevention, health awareness, maternal and child health, and referrals. Service locations, opening times and current availability should be verified locally.','প্রাথমিক স্বাস্থ্যসেবায় প্রতিরোধ, স্বাস্থ্য সচেতনতা, মাতৃ ও শিশুস্বাস্থ্য এবং রেফারাল অন্তর্ভুক্ত হতে পারে। সেবাকেন্দ্র, সময়সূচি ও বর্তমান প্রাপ্যতা স্থানীয়ভাবে যাচাই করতে হবে।'],
  ['Disaster Management','দুর্যোগ ব্যবস্থাপনা','disaster-management','Strengthens community preparedness, response and recovery planning for disaster-related risks.','দুর্যোগজনিত ঝুঁকি মোকাবিলায় কমিউনিটির প্রস্তুতি, সাড়া ও পুনরুদ্ধার পরিকল্পনা শক্তিশালী করে।','Activities may cover risk awareness, preparedness, emergency coordination and recovery support. Specific interventions and outcomes should be documented before they are reported as completed.','কার্যক্রমে ঝুঁকি বিষয়ে সচেতনতা, প্রস্তুতি, জরুরি সমন্বয় ও পুনরুদ্ধার সহায়তা থাকতে পারে। নির্দিষ্ট উদ্যোগ ও ফলাফল সম্পন্ন হিসেবে প্রকাশের আগে নথিভুক্ত করতে হবে।'],
  ['Safe Drinking Water & Sanitation','নিরাপদ পানি ও স্যানিটেশন','safe-drinking-water-sanitation','Promotes safe drinking water, sanitation and hygiene practices for healthier communities.','সুস্থ কমিউনিটি গড়তে নিরাপদ পানীয় জল, স্যানিটেশন ও স্বাস্থ্যবিধির চর্চাকে উৎসাহিত করে।','Water, sanitation and hygiene support can include awareness, access improvements and safer everyday practices. Available services and local coverage should be confirmed with the responsible team.','পানি, স্যানিটেশন ও স্বাস্থ্যবিধি সহায়তায় সচেতনতা, সুবিধার উন্নয়ন এবং নিরাপদ দৈনন্দিন অভ্যাস অন্তর্ভুক্ত হতে পারে। সেবা ও স্থানীয় আওতা দায়িত্বপ্রাপ্ত দলের সঙ্গে নিশ্চিত করতে হবে।'],
].map(([en,bn,slug,excerptEn,excerptBn,bodyEn,bodyBn],i) => ({
  slug, title:{en,bn}, excerpt:{en:excerptEn,bn:excerptBn}, category:'project' as const,
  image:projectImage(slug,{en,bn}),
  body:[{en:bodyEn,bn:bodyBn}],
  related:['/projects','/contact'],
}))

const additionalProjectEntries: ContentEntry[] = [
  ['Cultural and Sports Program','সাংস্কৃতিক ও ক্রীড়া কর্মসূচি','cultural-and-sports-program','Encourages participation, cooperation and community connection through cultural and sporting activities.','সাংস্কৃতিক ও ক্রীড়া কার্যক্রমের মাধ্যমে অংশগ্রহণ, সহযোগিতা ও কমিউনিটির সংযোগকে উৎসাহিত করে।','The program area recognises culture and sport as ways to bring people together and support community participation. Current events and results should be confirmed through approved records.','এই কর্মসূচিতে সংস্কৃতি ও খেলাধুলাকে মানুষকে একত্র করা এবং কমিউনিটির অংশগ্রহণ বাড়ানোর উপায় হিসেবে দেখা হয়। চলমান অনুষ্ঠান ও ফলাফল অনুমোদিত নথি থেকে নিশ্চিত করতে হবে।'],
  ['Uplifting the Quality of Life of Elderly People','বয়স্ক মানুষের জীবনমান উন্নয়ন কর্মসূচি','uplifting-quality-of-life-elderly','Highlights support for older people, their wellbeing, dignity and connection with community life.','বয়স্ক মানুষের সহায়তা, সুস্থতা, মর্যাদা ও কমিউনিটি জীবনের সঙ্গে সংযোগের ওপর গুরুত্ব দেয়।','Older people may need accessible services, social connection and practical household support. Details of current activities and eligibility should be confirmed with the foundation.','বয়স্ক মানুষের সহজলভ্য সেবা, সামাজিক সংযোগ ও ব্যবহারিক পারিবারিক সহায়তা প্রয়োজন হতে পারে। চলমান কার্যক্রম ও যোগ্যতার বিবরণ ফাউন্ডেশনের সঙ্গে নিশ্চিত করতে হবে।'],
  ['Improve Cook Stove','উন্নত চুলা কর্মসূচি','improve-cook-stove','Promotes improved household cooking options that can support cleaner kitchens and more efficient fuel use.','পরিচ্ছন্ন রান্নাঘর ও জ্বালানির দক্ষ ব্যবহারকে সহায়তা করতে উন্নত গৃহস্থালি রান্নার বিকল্পকে উৎসাহিত করে।','Improved cookstoves can reduce smoke exposure and fuel demand when properly selected and used. The types distributed and outcomes should be verified in program records.','সঠিকভাবে নির্বাচন ও ব্যবহার করা হলে উন্নত চুলা ধোঁয়ার সংস্পর্শ ও জ্বালানির চাহিদা কমাতে পারে। বিতরণ করা চুলার ধরন ও ফলাফল কর্মসূচির নথি থেকে যাচাই করতে হবে।'],
  ['Adolescent Program','কিশোর-কিশোরী কর্মসূচি','adolescent-program','Supports adolescent wellbeing, life skills, safe participation and access to age-appropriate information.','কিশোর-কিশোরীদের সুস্থতা, জীবনদক্ষতা, নিরাপদ অংশগ্রহণ ও বয়সোপযোগী তথ্যে প্রবেশাধিকারকে সহায়তা করে।','Program topics may include life skills, health awareness, safety, rights and positive community participation. Current activities should be confirmed with the program team.','কর্মসূচির বিষয়গুলোর মধ্যে জীবনদক্ষতা, স্বাস্থ্য সচেতনতা, নিরাপত্তা, অধিকার ও ইতিবাচক কমিউনিটি অংশগ্রহণ থাকতে পারে। চলমান কার্যক্রম কর্মসূচি দলের সঙ্গে নিশ্চিত করতে হবে।'],
  ['Social Afforestation','সামাজিক বনায়ন','social-afforestation','Promotes tree planting and community stewardship to support greener settlements and local environmental resilience.','সবুজ বসতি ও স্থানীয় পরিবেশগত সহনশীলতা বাড়াতে বৃক্ষরোপণ ও কমিউনিটির যত্নকে উৎসাহিত করে।','Social forestry works best when communities participate in planting, maintenance and long-term care. Species, locations and survival rates should be reported only when verified.','কমিউনিটি বৃক্ষরোপণ, রক্ষণাবেক্ষণ ও দীর্ঘমেয়াদি যত্নে অংশ নিলে সামাজিক বনায়ন কার্যকর হয়। প্রজাতি, এলাকা ও গাছের টিকে থাকার হার যাচাই ছাড়া প্রকাশ করা উচিত নয়।'],
  ['Srizony Offset Printers & Publication','সৃজনী অফসেট প্রিন্টার্স ও প্রকাশনা','srizony-offset-printers-publication','Provides a publishing and print-production service associated with the foundation’s enterprise portfolio.','ফাউন্ডেশনের উদ্যোগ পোর্টফোলিওর সঙ্গে যুক্ত প্রকাশনা ও মুদ্রণসেবা প্রদান করে।','The unit may support print and publication needs for institutions and customers. Current services, specifications and order enquiries should be confirmed directly with the unit.','এই ইউনিট প্রতিষ্ঠান ও গ্রাহকদের মুদ্রণ ও প্রকাশনার প্রয়োজন মেটাতে সহায়তা করতে পারে। বর্তমান সেবা, স্পেসিফিকেশন ও অর্ডার-সংক্রান্ত তথ্য সরাসরি ইউনিট থেকে নিশ্চিত করতে হবে।'],
  ['Srizony Development Center','সৃজনী ডেভেলপমেন্ট সেন্টার','srizony-development-center','Provides a dedicated platform for development-related activities and support services.','উন্নয়ন-সম্পর্কিত কার্যক্রম ও সহায়তা সেবার জন্য একটি নির্দিষ্ট প্ল্যাটফর্ম হিসেবে কাজ করে।','The center’s current remit, services and availability should be described using approved operational information from the responsible team.','কেন্দ্রটির বর্তমান দায়িত্ব, সেবা ও প্রাপ্যতা দায়িত্বপ্রাপ্ত দলের অনুমোদিত কার্যক্রম-সংক্রান্ত তথ্য অনুযায়ী বর্ণনা করা উচিত।'],
  ['Remittance Transfer Program','রেমিট্যান্স ট্রান্সফার কর্মসূচি','remittance-transfer-program','Relates to money-transfer services and financial access for households receiving remittances.','রেমিট্যান্স গ্রহণকারী পরিবারের অর্থ স্থানান্তর সেবা ও আর্থিক অন্তর্ভুক্তির সঙ্গে সম্পর্কিত।','Transfer availability, fees, identification requirements and processing times depend on the authorised service arrangements and must be confirmed before use.','অর্থ স্থানান্তরের প্রাপ্যতা, ফি, পরিচয়পত্রের শর্ত ও প্রক্রিয়াকরণ সময় অনুমোদিত সেবাব্যবস্থার ওপর নির্ভর করে এবং ব্যবহারের আগে নিশ্চিত করতে হবে।'],
  ['Micro Finance Program','ক্ষুদ্রঋণ কর্মসূচি','micro-finance-program','Provides a framework for savings and loan services designed to support household needs and livelihoods.','পরিবারের প্রয়োজন ও জীবিকাকে সহায়তা করার জন্য সঞ্চয় ও ঋণসেবার কাঠামো প্রদান করে।','Product availability, eligibility, charges and repayment schedules vary by product and current policy. Applicants should contact an authorised branch for the latest terms.','পণ্যভেদে ও বর্তমান নীতিমালা অনুযায়ী সেবার প্রাপ্যতা, যোগ্যতা, চার্জ ও কিস্তির সূচি ভিন্ন হতে পারে। সর্বশেষ শর্তের জন্য আবেদনকারীদের অনুমোদিত শাখায় যোগাযোগ করা উচিত।'],
  ['Srizony Hospital Program','সৃজনী হাসপাতাল কর্মসূচি','srizony-hospital-program','Represents the foundation’s health-service and social-enterprise area related to hospital care.','হাসপাতালভিত্তিক সেবা-সম্পর্কিত ফাউন্ডেশনের স্বাস্থ্যসেবা ও সামাজিক উদ্যোগের ক্ষেত্রকে তুলে ধরে।','For current departments, available services, visiting hours and patient support, use the hospital’s approved information or contact its administration directly.','বর্তমান বিভাগ, সেবার প্রাপ্যতা, সময়সূচি ও রোগী সহায়তার জন্য হাসপাতালের অনুমোদিত তথ্য ব্যবহার করুন অথবা সরাসরি প্রশাসনের সঙ্গে যোগাযোগ করুন।'],
  ['Human Rights and Good Governance','মানবাধিকার ও সুশাসন','human-rights-and-good-governance','Promotes rights awareness, accountability, inclusion and fair access to services.','অধিকার সচেতনতা, জবাবদিহিতা, অন্তর্ভুক্তি ও সেবায় ন্যায্য প্রবেশাধিকারকে উৎসাহিত করে।','This work area may include rights education, safeguarding, access to justice and accountability practices. Current services and case support should be confirmed through official channels.','এই কার্যক্রমের ক্ষেত্রের মধ্যে অধিকার শিক্ষা, সুরক্ষা, ন্যায়বিচারে প্রবেশাধিকার ও জবাবদিহিতার চর্চা থাকতে পারে। বর্তমান সেবা ও কেস সহায়তা অফিসিয়াল মাধ্যমে নিশ্চিত করতে হবে।'],
  ['Low-Cost Housing Project','স্বল্পমূল্যের আবাসন প্রকল্প','low-cost-housing-project','Focuses on housing options and practical support for households facing affordability or safety challenges.','আবাসনের ব্যয় বা নিরাপত্তাজনিত চ্যালেঞ্জে থাকা পরিবারের জন্য আবাসন বিকল্প ও ব্যবহারিক সহায়তার ওপর গুরুত্ব দেয়।','Project eligibility, technical standards, local availability and support arrangements should be confirmed with the responsible program team.','প্রকল্পের যোগ্যতা, কারিগরি মান, স্থানীয় প্রাপ্যতা ও সহায়তার ব্যবস্থা দায়িত্বপ্রাপ্ত কর্মসূচি দলের সঙ্গে নিশ্চিত করতে হবে।'],
].map(([en,bn,slug,excerptEn,excerptBn,bodyEn,bodyBn],i)=>({
  slug,title:{en,bn},excerpt:{en:excerptEn,bn:excerptBn},category:'project' as const,
  image:projectImage(slug,{en,bn}), body:[{en:bodyEn,bn:bodyBn}], related:['/projects','/contact'],
}))

const newsEntries: ContentEntry[] = [
  ['Health and Nutrition Update','স্বাস্থ্য ও পুষ্টি আপডেট','community-health-and-nutrition-update','News and field notes about community health, nutrition awareness and access to essential services.','কমিউনিটি স্বাস্থ্য, পুষ্টি সচেতনতা ও প্রয়োজনীয় সেবায় প্রবেশাধিকার নিয়ে সংবাদ ও মাঠপর্যায়ের তথ্য।','Community health and nutrition are important to everyday wellbeing. This section shares approved information about health awareness, nutrition and access to essential care.','কমিউনিটি স্বাস্থ্য ও পুষ্টি দৈনন্দিন সুস্থতার গুরুত্বপূর্ণ অংশ। এই অংশে স্বাস্থ্য সচেতনতা, পুষ্টি ও প্রয়োজনীয় সেবায় প্রবেশাধিকার সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'],
  ['Livelihood and Enterprise Update','জীবিকা ও উদ্যোগ আপডেট','livelihood-and-enterprise-update','Updates related to livelihood support, small enterprises, skills and financial inclusion.','জীবিকা সহায়তা, ক্ষুদ্র উদ্যোগ, দক্ষতা ও আর্থিক অন্তর্ভুক্তি-সম্পর্কিত আপডেট।','Livelihood support, enterprise development and practical skills can help households strengthen economic security. This section shares approved information about these program areas.','জীবিকা সহায়তা, উদ্যোগ উন্নয়ন ও ব্যবহারিক দক্ষতা পরিবারগুলোর অর্থনৈতিক নিরাপত্তা বাড়াতে সহায়তা করতে পারে। এই অংশে এসব কর্মসূচি সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'],
  ['Education and Skills Update','শিক্ষা ও দক্ষতা আপডেট','education-and-skills-update','News about learning access, literacy, vocational skills and educational support.','শিক্ষার সুযোগ, সাক্ষরতা, কারিগরি দক্ষতা ও শিক্ষা সহায়তা নিয়ে সংবাদ।','Education and practical skills help children, young people and adults build knowledge and confidence. This section brings together approved information about literacy, learning and vocational opportunities.','শিক্ষা ও ব্যবহারিক দক্ষতা শিশু, তরুণ ও প্রাপ্তবয়স্কদের জ্ঞান ও আত্মবিশ্বাস গড়ে তুলতে সাহায্য করে। এই অংশে সাক্ষরতা, শেখা ও কারিগরি সুযোগ সম্পর্কে অনুমোদিত তথ্য একত্র করা হয়।'],
  ['Rights and Governance Update','অধিকার ও সুশাসন আপডেট','community-rights-and-governance-update','Updates on rights awareness, safeguarding, community participation and accountable local services.','অধিকার সচেতনতা, সুরক্ষা, কমিউনিটির অংশগ্রহণ ও জবাবদিহিমূলক স্থানীয় সেবা নিয়ে আপডেট।','Rights awareness, safeguarding and good governance support safer, more inclusive communities. This section shares approved information about rights education and community participation.','অধিকার সচেতনতা, সুরক্ষা ও সুশাসন আরও নিরাপদ ও অন্তর্ভুক্তিমূলক কমিউনিটি গড়ে তুলতে সহায়তা করে। এই অংশে অধিকার শিক্ষা ও কমিউনিটির অংশগ্রহণ সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'],
  ['Climate Resilience Update','জলবায়ু সহনশীলতা আপডেট','climate-resilience-update','News on climate adaptation, sustainable agriculture, environmental care and disaster preparedness.','জলবায়ু অভিযোজন, টেকসই কৃষি, পরিবেশের যত্ন ও দুর্যোগ প্রস্তুতি নিয়ে সংবাদ।','Climate resilience and environmental care are closely linked to sustainable livelihoods. This section shares approved information about adaptation, clean energy, agriculture and disaster preparedness.','জলবায়ু সহনশীলতা ও পরিবেশের যত্ন টেকসই জীবিকার সঙ্গে ঘনিষ্ঠভাবে যুক্ত। এই অংশে অভিযোজন, পরিচ্ছন্ন জ্বালানি, কৃষি ও দুর্যোগ প্রস্তুতি সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'],
  ['Community Partnership Update','কমিউনিটি অংশীদারিত্ব আপডেট','community-partnership-update','Updates about collaboration with community groups, institutions and development partners.','কমিউনিটি গ্রুপ, প্রতিষ্ঠান ও উন্নয়ন অংশীদারদের সঙ্গে সহযোগিতা নিয়ে আপডেট।','Partnerships connect communities, institutions and development partners around shared priorities. This section features approved information about collaboration and joint initiatives.','অংশীদারিত্ব কমিউনিটি, প্রতিষ্ঠান ও উন্নয়ন সহযোগীদের অভিন্ন অগ্রাধিকারে যুক্ত করে। এই অংশে সহযোগিতা ও যৌথ উদ্যোগ সম্পর্কে অনুমোদিত তথ্য তুলে ধরা হয়।'],
].map(([en,bn,slug,excerptEn,excerptBn,bodyEn,bodyBn],i) => ({
  slug,title:{en,bn},excerpt:{en:excerptEn,bn:excerptBn},date:`2026-0${Math.min(6,i+1)}-${String(10+i).padStart(2,'0')}`,category:'news' as const,
  image:projectImage(slug,{en,bn}), body:[{en:bodyEn,bn:bodyBn}], related:['/news','/contact'],
}))

const noticeEntries: ContentEntry[] = [
  {slug:'holiday-notice-2024-09-29',title:{en:'Holiday Notice',bn:'ছুটির নোটিশ'},excerpt:{en:'Holiday notice published by the foundation.',bn:'ফাউন্ডেশন কর্তৃক প্রকাশিত ছুটির নোটিশ।'},date:'2024-09-29',category:'notice',image:img(images.general.project1,images.general.project2,{en:'Holiday notice',bn:'ছুটির নোটিশ'}),body:[{en:'Please use the official notice desk or contact the foundation for the full notice document.',bn:'পূর্ণ নোটিশ নথির জন্য অফিসিয়াল নোটিশ ডেস্কে যোগাযোগ করুন বা ফাউন্ডেশনের সঙ্গে কথা বলুন।'}]},
  {slug:'general-notice-2024-04-01',title:{en:'General Notice',bn:'সাধারণ নোটিশ'},excerpt:{en:'General institutional notice and update.',bn:'প্রাতিষ্ঠানিক সাধারণ নোটিশ ও আপডেট।'},date:'2024-04-01',category:'notice',image:img(images.general.project2,images.general.project3,{en:'General notice',bn:'সাধারণ নোটিশ'}),body:[{en:'Please contact the foundation for the full official notice document.',bn:'পূর্ণ অফিসিয়াল নোটিশ নথির জন্য ফাউন্ডেশনের সঙ্গে যোগাযোগ করুন।'}]},
]

const careerEntries: ContentEntry[] = []

const enterpriseEntries: ContentEntry[] = [
  ['Srizony Hospital','সৃজনী হাসপাতাল','srizony-hospital','Healthcare services connected with the foundation’s social mission.','ফাউন্ডেশনের সামাজিক লক্ষ্যসংশ্লিষ্ট স্বাস্থ্যসেবা।','For current departments, services and patient information, contact the hospital through its official channels.','বর্তমান বিভাগ, সেবা ও রোগী-সংক্রান্ত তথ্যের জন্য অফিসিয়াল মাধ্যমে হাসপাতালের সঙ্গে যোগাযোগ করুন।','heart'],
  ['Srizony University','সৃজনী ইউনিভার্সিটি','srizony-university','Higher education and learning opportunities.','উচ্চশিক্ষা ও শেখার সুযোগ।','For approved programs, admissions, fees and academic schedules, consult the institution’s official information.','অনুমোদিত প্রোগ্রাম, ভর্তি, ফি ও একাডেমিক সময়সূচির জন্য প্রতিষ্ঠানের অফিসিয়াল তথ্য দেখুন।','book'],
  ['Srizony Polytechnic','সৃজনী পলিটেকনিক','srizony-polytechnic','Technical education and practical skills development.','কারিগরি শিক্ষা ও ব্যবহারিক দক্ষতা উন্নয়ন।','For current courses, eligibility and admission dates, contact the institution directly.','বর্তমান কোর্স, যোগ্যতা ও ভর্তি-তারিখের জন্য সরাসরি প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন।','briefcase'],
  ['Srizony Printing Press','সৃজনী প্রিন্টিং প্রেস','srizony-printing-press','Printing and publication services for institutional and community needs.','প্রাতিষ্ঠানিক ও কমিউনিটির প্রয়োজনের জন্য মুদ্রণ ও প্রকাশনা সেবা।','Request current print specifications, quotations and delivery times from the unit.','বর্তমান মুদ্রণ স্পেসিফিকেশন, মূল্যপ্রস্তাব ও ডেলিভারির সময় জানতে ইউনিটের সঙ্গে যোগাযোগ করুন।','building'],
  ['Srizony Filling Station','সৃজনী ফিলিং স্টেশন','srizony-filling-station','A service enterprise within the foundation’s enterprise portfolio.','ফাউন্ডেশনের উদ্যোগ পোর্টফোলিওর অন্তর্ভুক্ত একটি সেবামূলক উদ্যোগ।','Confirm location, operating hours and available services directly before visiting.','যাওয়ার আগে অবস্থান, সময়সূচি ও উপলব্ধ সেবা সরাসরি নিশ্চিত করুন।','building'],
  ['Srizony Internet','সৃজনী ইন্টারনেট','srizony-internet','Connectivity and digital access services.','ইন্টারনেট সংযোগ ও ডিজিটাল অ্যাক্সেস সেবা।','For coverage, available packages and service enquiries, use the unit’s approved contact channels.','কভারেজ, উপলব্ধ প্যাকেজ ও সেবা-সংক্রান্ত অনুসন্ধানের জন্য ইউনিটের অনুমোদিত যোগাযোগমাধ্যম ব্যবহার করুন।','users'],
  ['Srizony Computer Garden','সৃজনী কম্পিউটার গার্ডেন','srizony-computer-garden','Computing and digital-learning services.','কম্পিউটিং ও ডিজিটাল-শিক্ষা সেবা।','Confirm current services, training options and availability with the unit.','বর্তমান সেবা, প্রশিক্ষণের সুযোগ ও প্রাপ্যতা ইউনিটের সঙ্গে নিশ্চিত করুন।','book'],
  ['Srizony Motors','সৃজনী মোটরস','srizony-motors','A mobility and service-related enterprise.','পরিবহন ও সেবা-সম্পর্কিত একটি উদ্যোগ।','For current inventory, operating hours and service details, contact the enterprise directly.','বর্তমান পণ্য, সময়সূচি ও সেবার বিবরণের জন্য সরাসরি উদ্যোগটির সঙ্গে যোগাযোগ করুন।','briefcase'],
].map(([en,bn,slug,excerptEn,excerptBn,bodyEn,bodyBn,icon],i)=>({
  slug,title:{en,bn},excerpt:{en:excerptEn,bn:excerptBn},category:'enterprise' as const,
  image:projectImage(slug,{en,bn}), body:[{en:bodyEn,bn:bodyBn},{en:'For the latest details, please contact the relevant enterprise unit.',bn:'সর্বশেষ তথ্যের জন্য সংশ্লিষ্ট উদ্যোগ ইউনিটের সঙ্গে যোগাযোগ করুন।'}],
  tags:[{en:'Enterprise',bn:'উদ্যোগ'}], related:['/enterprise-development','/contact'],
}))

const contentEntries: ContentEntry[] = [...projectEntries,...additionalProjectEntries,...newsEntries,...noticeEntries,...careerEntries,...enterpriseEntries]

// The hero carousel showcases every seeded project with its title and topic-specific image.
homeHero.slides = HERO_FEATURED.map((featured) => {
  const entry = [...projectEntries, ...additionalProjectEntries].find((item) => item.slug === featured.slug)!
  return { id: `project-${featured.slug}`, image: poolUrl(featured.image), title: featured.title, description: entry.excerpt, href: `/projects/${featured.slug}` }
})

function entryToPage(entry: ContentEntry, allRelated = true): PageData {
  return {
    slug:`/${entry.category === 'project' ? 'projects' : entry.category === 'news' ? 'news' : entry.category === 'notice' ? 'notice' : entry.category === 'career' ? 'carrer-job' : 'enterprise'}/${entry.slug}`,
    title:entry.title,
    subtitle:entry.excerpt,
    heroImage:entry.image.src,
    sections:[
      // Slug pages intentionally omit article-media galleries and embedded media; the story remains text-first.
      {type:'richText',eyebrow:{en:entry.category==='project'?'Project Detail':entry.category==='news'?'News Detail':entry.category==='notice'?'Notice Detail':entry.category==='career'?'Career Opportunity':'Enterprise Detail',bn:entry.category==='project'?'প্রকল্প বিস্তারিত':entry.category==='news'?'সংবাদ বিস্তারিত':entry.category==='notice'?'নোটিশ বিস্তারিত':entry.category==='career'?'ক্যারিয়ার সুযোগ':'উদ্যোগ বিস্তারিত'},heading:entry.title,body:[{en:`Updated ${entry.date||'2026-08-23'}`,bn:`হালনাগাদ ${entry.date||'২০২৬-০৮-২৩'}`},...entry.body],image:entry.image},
      ...(allRelated ? [{type:'cta' as const,heading:{en:'Continue exploring',bn:'আরও দেখুন'},body:{en:'Explore related content or contact Srizony Foundation for official information.',bn:'সম্পর্কিত বিষয় দেখুন অথবা অফিসিয়াল তথ্যের জন্য সৃজনী ফাউন্ডেশনের সঙ্গে যোগাযোগ করুন।'},primary:{label:{en:'Contact Us',bn:'যোগাযোগ করুন'},href:'/contact'},secondary:{label:{en:'Donate',bn:'দান করুন'},href:'/donate'}}] : []),
    ]
  }
}

// ---- system: site/navigation/UI/pages ----

const ui = {
  en: {
    language: 'বাংলা', theme: 'Theme', menu: 'Menu', donate: 'Donate Now', readMore: 'Read More', learnMore: 'Learn More', explore: 'Explore', allPrograms: 'All Programs', latestNews: 'Latest News', viewAll: 'View All', previous: 'Previous', next: 'Next', play: 'Play Video', source: 'Source', submitDonation: 'Continue Donation', amount: 'Donation Amount', custom: 'Custom Amount', name: 'Full Name', email: 'Email Address', phone: 'Phone Number', message: 'Message', send: 'Send Message', home: 'Home', projects: 'Projects', news: 'News', notice: 'Notice', contact: 'Contact', career: 'Career', donateTitle: 'Help Create Lasting Change', donateBody: 'Your support helps expand access to health, education, livelihoods and dignity for vulnerable communities.', quickLinks: 'Quick Links', programs: 'Programs', address: 'Head Office', follow: 'Follow Us', footerNote: 'Srizony Foundation — Empowering communities since 1985.'
  },
  bn: {
    language: 'EN', theme: 'থিম', menu: 'মেনু', donate: 'এখনই দান করুন', readMore: 'আরও পড়ুন', learnMore: 'বিস্তারিত', explore: 'ঘুরে দেখুন', allPrograms: 'সব কর্মসূচি', latestNews: 'সর্বশেষ সংবাদ', viewAll: 'সব দেখুন', previous: 'আগের', next: 'পরের', play: 'ভিডিও চালান', source: 'উৎস', submitDonation: 'দানে এগিয়ে যান', amount: 'দানের পরিমাণ', custom: 'নিজস্ব পরিমাণ', name: 'পূর্ণ নাম', email: 'ইমেইল', phone: 'ফোন নম্বর', message: 'বার্তা', send: 'বার্তা পাঠান', home: 'হোম', projects: 'প্রকল্প', news: 'সংবাদ', notice: 'নোটিশ', contact: 'যোগাযোগ', career: 'ক্যারিয়ার', donateTitle: 'পরিবর্তনের অংশ হোন', donateBody: 'আপনার সহায়তা স্বাস্থ্য, শিক্ষা, জীবিকা ও মর্যাদার সুযোগ আরও বিস্তৃত করতে সহায়তা করে।', quickLinks: 'দ্রুত লিংক', programs: 'কর্মসূচি', address: 'প্রধান কার্যালয়', follow: 'অনুসরণ করুন', footerNote: 'সৃজনী ফাউন্ডেশন — ১৯৮৫ সাল থেকে মানুষের পাশে।'
  }
} as const


const contactInfo = {
  email: 'info@srizonyfoundation.org.bd',
  primaryPhone: '+8802477747270',
  phones: ['+8802477747270', '+880451632646', '01926888584'],
  address: { en:'111 Pabahati Road, Pabahati, Jhenaidah-7300, Bangladesh', bn:'১১১ পাভাহাটি রোড, পাভাহাটি, ঝিনাইদহ-৭৩০০, বাংলাদেশ' },
  maps: {
    headOffice: 'https://www.google.com/maps/search/?api=1&query=111%20Pabahati%20Road%2C%20Pabahati%2C%20Jhenaidah-7300%2C%20Bangladesh',
  },
  socials: { linkedin:'https://bd.linkedin.com/company/srizonyfoundation' },
  footprint: [
    'Jhenaidah','Kushtia','Pabna','Chuadanga','Meherpur','Jashore','Satkhira','Khulna','Narail','Magura','Faridpur','Rajbari','Manikganj','Dhaka'
  ].map(en=>({ name:{en,bn:en==='Dhaka'?'ঢাকা':en==='Jhenaidah'?'ঝিনাইদহ':en==='Kushtia'?'কুষ্টিয়া':en==='Pabna'?'পাবনা':en==='Chuadanga'?'চুয়াডাঙ্গা':en==='Meherpur'?'মেহেরপুর':en==='Jashore'?'যশোর':en==='Satkhira'?'সাতক্ষীরা':en==='Khulna'?'খুলনা':en==='Narail'?'নড়াইল':en==='Magura'?'মাগুরা':en==='Faridpur'?'ফরিদপুর':en==='Rajbari'?'রাজবাড়ী':en==='Manikganj'?'মানিকগঞ্জ':en}, address:{en:`Operational footprint — ${en}`,bn:`কার্যক্রমের আওতা — ${en==='Dhaka'?'ঢাকা':en}`}, mapQuery:`${en}, Bangladesh`, kind:'footprint' as const})),
}

const primaryNav: NavItem[] = [
  {
    label: { en: 'Home', bn: 'হোম' },
    href: '/',
    children: [
      { label: { en: 'Projects', bn: 'প্রকল্পসমূহ' }, href: '/projects' },
      { label: { en: 'Career / Jobs', bn: 'ক্যারিয়ার / চাকরি' }, href: '/carrer-job' },
      { label: { en: 'Notice', bn: 'নোটিশ' }, href: '/notice' },
      { label: { en: 'Contact', bn: 'যোগাযোগ' }, href: '/contact' },
    ],
  },
]

const whoWeAreItems: NavItem[] = [
      {
        label: { en: 'About Us', bn: 'আমাদের সম্পর্কে' },
        href: '/about-us',
        children: [
          { label: { en: 'Founders Footprint', bn: 'প্রতিষ্ঠাতার অবদান' }, href: '/about-us/founders-footprint' },
          { label: { en: 'Awards & Recognition', bn: 'পুরস্কার ও স্বীকৃতি' }, href: '/about-us/awards-recognition' },
          { label: { en: 'Executive Committee', bn: 'নির্বাহী কমিটি' }, href: '/about-us/executive-committee' },
          { label: { en: 'Operational Structure', bn: 'অপারেশনাল কাঠামো' }, href: '/about-us/operational-structure' },
          { label: { en: 'Partners & Networks', bn: 'অংশীদার ও নেটওয়ার্ক' }, href: '/about-us/partners-networks' },
          { label: { en: 'Governing Body', bn: 'গভর্নিং বডি' }, href: '/about-us/governing-body' },
        ],
      },
      { label: { en: 'At A Glance', bn: 'এক নজরে' }, href: '/at-a-glance' },
      { label: { en: 'Impact on SDG', bn: 'এসডিজিতে প্রভাব' }, href: '/impact-on-sdg' },
      { label: { en: 'Good Governance', bn: 'সুশাসন' }, href: '/good-governance' },
      { label: { en: 'Management Staff', bn: 'ব্যবস্থাপনা কর্মকর্তা' }, href: '/management-staff' },
      { label: { en: 'Documents & Resources', bn: 'ডকুমেন্ট ও ডাউনলোড' }, href: '/resources' },
    ];

const whatWeDoItems: NavItem[] = [
      {
        label: { en: 'Social Development', bn: 'সামাজিক উন্নয়ন' },
        href: '/social-development',
        children: [
          { label: { en: 'Health Program', bn: 'স্বাস্থ্য কর্মসূচি' }, href: '/social-development/health-program' },
          { label: { en: 'Education Program', bn: 'শিক্ষা কর্মসূচি' }, href: '/social-development/education-program' },
          { label: { en: 'Human Rights', bn: 'মানবাধিকার' }, href: '/social-development/human-rights' },
          { label: { en: 'Human Resource', bn: 'মানবসম্পদ' }, href: '/social-development/human-resource' },
          { label: { en: 'Climate Change', bn: 'জলবায়ু পরিবর্তন' }, href: '/social-development/climate-change' },
          { label: { en: 'Agriculture & Livelihood', bn: 'কৃষি ও জীবিকা' }, href: '/social-development/agriculture-livelihood' },
        ],
      },
      {
        label: { en: 'Organizational Development', bn: 'প্রাতিষ্ঠানিক উন্নয়ন' },
        href: '/organizational-development',
        children: [
          { label: { en: 'Women Business Loan', bn: 'নারী ব্যবসা ঋণ' }, href: '/organizational-development/women-business-loan' },
          { label: { en: 'Small Enterprise Loan', bn: 'ক্ষুদ্র উদ্যোক্তা ঋণ' }, href: '/organizational-development/small-enterprise-loan' },
          { label: { en: 'Agri Development Loan', bn: 'কৃষি উন্নয়ন ঋণ' }, href: '/organizational-development/agri-development-loan' },
          { label: { en: 'Household Migrant Loan', bn: 'অভিবাসী পরিবার ঋণ' }, href: '/organizational-development/household-migrant-loan' },
          { label: { en: 'Rural Development Loan', bn: 'গ্রামীণ উন্নয়ন ঋণ' }, href: '/organizational-development/rural-development-loan' },
          { label: { en: 'Job Holders Loan', bn: 'চাকরিজীবী ঋণ' }, href: '/organizational-development/job-holders-loan' },
          { label: { en: 'Student Loan', bn: 'শিক্ষার্থী ঋণ' }, href: '/organizational-development/student-loan' },
        ],
      },
      {
        label: { en: 'Enterprise Development', bn: 'এন্টারপ্রাইজ উন্নয়ন' },
        href: '/enterprise-development',
        children: [
          { label: { en: 'Srizony Hospital', bn: 'সৃজনী হাসপাতাল' }, href: '/enterprise-development/srizony-hospital' },
          { label: { en: 'Srizony University', bn: 'সৃজনী ইউনিভার্সিটি' }, href: '/enterprise-development/srizony-university' },
          { label: { en: 'Srizony Polytechnic', bn: 'সৃজনী পলিটেকনিক' }, href: '/enterprise-development/srizony-polytechnic' },
          { label: { en: 'Srizony Printing Press', bn: 'সৃজনী প্রিন্টিং প্রেস' }, href: '/enterprise-development/srizony-printing-press' },
          { label: { en: 'Srizony Filling Station', bn: 'সৃজনী ফিলিং স্টেশন' }, href: '/enterprise-development/srizony-filling-station' },
          { label: { en: 'Srizony Internet', bn: 'সৃজনী ইন্টারনেট' }, href: '/enterprise-development/srizony-internet' },
          { label: { en: 'Srizony Computer Garden', bn: 'সৃজনী কম্পিউটার গার্ডেন' }, href: '/enterprise-development/srizony-computer-garden' },
          { label: { en: 'Srizony Motors', bn: 'সৃজনী মোটরস' }, href: '/enterprise-development/srizony-motors' },
        ],
      },
      { label: { en: 'Microfinance Program', bn: 'ক্ষুদ্রঋণ কর্মসূচি' }, href: '/microfinance-program' },
      { label: { en: 'Success Stories', bn: 'সাফল্যের গল্প' }, href: '/success-stories' },
      { label: { en: 'News', bn: 'সংবাদ' }, href: '/news' },
    ];

// navGroups is retained only as an empty API compatibility field. The CMS and
// public site now use one Home-rooted navigation tree with folder menu items.
const navGroups: NavGroup[] = [];

primaryNav[0].children = [
  { label: { en: 'Who We Are', bn: 'আমরা যারা' }, href: '', menuType: 'folder', children: whoWeAreItems },
  { label: { en: 'What We Do', bn: 'আমাদের কার্যক্রম' }, href: '', menuType: 'folder', children: whatWeDoItems },
  ...(primaryNav[0].children ?? []),
]

const imageMedia = (src: string, alt: Bilingual): MediaItem => ({ src, alt })

const loanItems = [
  ['Women Business Loans','নারী উদ্যোক্তা ঋণ','We provide women business loans to support and grow female-led enterprises.','নারী নেতৃত্বাধীন উদ্যোগের উন্নয়ন ও সম্প্রসারণে সহায়তা করি।','/women-business-loan'],
  ['Small Enterprise Loans','ক্ষুদ্র উদ্যোক্তা ঋণ','Growth-focused finance for small and emerging enterprises.','ক্ষুদ্র ও উদীয়মান ব্যবসার জন্য প্রবৃদ্ধিমুখী অর্থায়ন।','/small-enterprise-loan'],
  ['Agri Development Loans','কৃষি উন্নয়ন ঋণ','Finance for farm productivity, equipment and sustainable practices.','কৃষি উৎপাদনশীলতা, সরঞ্জাম ও টেকসই চাষে সহায়তামূলক ঋণ।','/agri-development-loan'],
  ['Household Migrant Loans','অভিবাসী পরিবার ঋণ','Support for relocation and household settlement expenses.','অভিবাসন ও পরিবার পুনর্বাসনের ব্যয় মোকাবিলায় সহায়তা।','/household-migrant-loan'],
  ['Rural Development Loans','গ্রামীণ উন্নয়ন ঋণ','Finance that supports local community growth and infrastructure.','স্থানীয় কমিউনিটি উন্নয়ন ও অবকাঠামোকে সহায়তা করা অর্থায়ন।','/rural-development-loan'],
  ['Job Holders Loan','চাকরিজীবী ঋণ','Flexible support for career and personal financial needs.','চাকরি ও ব্যক্তিগত আর্থিক প্রয়োজনের জন্য নমনীয় সহায়তা।','/job-holders-loan'],
  ['Student Loan','শিক্ষার্থী ঋণ','Education-focused finance to widen learning opportunities.','শিক্ষার সুযোগ বাড়াতে শিক্ষা-কেন্দ্রিক অর্থায়ন।','/student-loan'],
]

const pages: Record<string, PageData> = {
  '/': {
    slug:'/',
    title:{en:'Srizony Foundation',bn:'সৃজনী ফাউন্ডেশন'},
    subtitle:{en:'',bn:''},
    heroImage:images.hero.feature,
    heroTone:'green',
    sections:[
      {
        type:'carousel',
        homeComponent:'hero',
        presentation:'scroller',
        eyebrow:{en:'Srizony Foundation',bn:'সৃজনী ফাউন্ডেশন'},
        heading:{en:'Landing Page Hero',bn:'ল্যান্ডিং পেজের প্রধান স্লাইড'},
        body:{en:'Manage the homepage hero image sequence here.',bn:'হোমপেজের প্রধান ছবিগুলোর ধারাবাহিকতা এখানে পরিচালনা করুন।'},
        items:homeHero.slides.map((slide)=>({
          title:slide.title,
          body:slide.description,
          image:imageMedia(slide.image,slide.title),
          href:slide.href,
        })),
      },
      {
        type:'stats',
        homeComponent:'growth',
        eyebrow:{en:'Since 1985',bn:'১৯৮৫ সাল থেকে'},
        heading:{en:'Growing together',bn:'একসাথে এগিয়ে চলা'},
        items:[
          {value:'69753',label:{en:'Members',bn:'সদস্য'}},
          {value:'2540',label:{en:'Staff',bn:'কর্মী'}},
          {value:'1898',label:{en:'Villages',bn:'গ্রাম'}},
          {value:'80',label:{en:'Branch offices',bn:'শাখা অফিস'}},
        ],
        buttonConfig:{visible:true,mode:'primary',label:{en:'About us',bn:'আমাদের সম্পর্কে'},href:'/about-us',action:'route'},
      },
      {
        type:'cards',
        homeComponent:'missionVisionValues',
        eyebrow:{en:'Who We Are',bn:'আমরা যারা'},
        heading:{en:'Mission, Vision & Values',bn:'মিশন, ভিশন ও মূল্যবোধ'},
        columns:3,
        items:[
          {title:{en:'Our Mission',bn:'আমাদের মিশন'},body:{en:'Create an enabling environment for poverty reduction, socio-economic development and human rights.',bn:'দারিদ্র্য বিমোচন, আর্থ-সামাজিক উন্নয়ন ও মানবাধিকার প্রতিষ্ঠায় সহায়ক পরিবেশ তৈরি করা।'},icon:'heart',illustration:'mission'},
          {title:{en:'Our Vision',bn:'আমাদের ভিশন'},body:{en:'A Bangladesh where every person, especially the poor and marginalised, lives with dignity, opportunity and rights.',bn:'এমন একটি বাংলাদেশ, যেখানে প্রত্যেক মানুষ, বিশেষ করে দরিদ্র ও প্রান্তিক জনগোষ্ঠী, মর্যাদা, সুযোগ ও অধিকারসহ বাঁচতে পারে।'},icon:'users',illustration:'vision'},
          {title:{en:'Our Values',bn:'আমাদের মূল্যবোধ'},body:{en:'Accountability and fairness: abiding by rules and policies in everything we do.',bn:'জবাবদিহিতা ও ন্যায়পরায়ণতা: প্রতিটি কাজে নীতি ও নিয়ম মেনে চলা।'},icon:'shield',illustration:'values'},
        ],
      },
      {
        type:'richText',
        homeComponent:'locations',
        eyebrow:{en:'National Footprint',bn:'জাতীয় বিস্তৃতি'},
        heading:{en:'Our offices across Bangladesh',bn:'সারা বাংলাদেশে আমাদের কার্যালয়'},
        body:[{en:'Select a pin or branch to view its location and contact details.',bn:'শাখার অবস্থান ও যোগাযোগের তথ্য দেখতে পিন বা শাখা নির্বাচন করুন।'}],
      },
      {
        type:'richText',
        heading:{en:'Legacy of Srizony Foundation',bn:'সৃজনী ফাউন্ডেশনের উত্তরাধিকার'},
        body:[
          {en:'Srizony Foundation was established in Jhenaidah in 1985 and has grown into a national socio-economic development organization serving disadvantaged people.',bn:'সৃজনী ফাউন্ডেশন ১৯৮৫ সালে ঝিনাইদহে প্রতিষ্ঠিত হয় এবং সুবিধাবঞ্চিত মানুষের জন্য কাজ করতে করতে একটি জাতীয় আর্থ-সামাজিক উন্নয়ন প্রতিষ্ঠানে পরিণত হয়েছে।'},
          {en:'The organization combines community development, rights-based approaches, financial inclusion and social enterprise.',bn:'প্রতিষ্ঠানটি কমিউনিটি উন্নয়ন, অধিকারভিত্তিক পদ্ধতি, আর্থিক অন্তর্ভুক্তি ও সামাজিক উদ্যোগকে একত্রে এগিয়ে নেয়।'}
        ],
        image:imageMedia(poolUrl(LEGACY_IMAGE),{en:'Srizony Foundation community',bn:'সৃজনী ফাউন্ডেশনের কমিউনিটি'})
      },
      {
        type:'timeline',
        variant:'journey',
        heading:{en:'Our Journey',bn:'আমাদের পথচলা'},
        items:[
          {year:'1985',title:{en:'Foundation',bn:'প্রতিষ্ঠা'},body:{en:'Initial program startup focusing on grassroots community support and basic empowerment.',bn:'তৃণমূল কমিউনিটির সহায়তা ও মৌলিক ক্ষমতায়নকে কেন্দ্র করে প্রাথমিক কর্মসূচির সূচনা।'},details:[{en:'Community building',bn:'কমিউনিটি গঠন'},{en:'Resource allocation',bn:'সম্পদ বরাদ্দ'},{en:'Local expansion',bn:'স্থানীয় সম্প্রসারণ'}]},
          {year:'1992',title:{en:'Human Rights Expansion',bn:'মানবাধিকার সম্প্রসারণ'},body:{en:'Human rights work expanded. Rights-focused interventions became part of program areas.',bn:'মানবাধিকার কার্যক্রম সম্প্রসারিত হয়। অধিকারভিত্তিক উদ্যোগ কর্মসূচির অংশ হয়ে ওঠে।'},details:[{en:'Advocacy integration',bn:'অ্যাডভোকেসি সংযুক্তি'},{en:'Legal literacy training',bn:'আইনি সাক্ষরতা প্রশিক্ষণ'},{en:'Policy reform engagement',bn:'নীতি সংস্কারে অংশগ্রহণ'}]},
          {year:'2013',title:{en:'Urban Health Services',bn:'নগর স্বাস্থ্যসেবা'},body:{en:'Urban primary healthcare activities expanded through strategic corporate and civic partnerships.',bn:'কৌশলগত কর্পোরেট ও নাগরিক অংশীদারিত্বের মাধ্যমে নগর প্রাথমিক স্বাস্থ্যসেবা সম্প্রসারিত হয়।'},details:[{en:'Primary care expansion',bn:'প্রাথমিক সেবা সম্প্রসারণ'},{en:'Public-private alliances',bn:'সরকারি-বেসরকারি জোট'},{en:'Clinic network rollout',bn:'ক্লিনিক নেটওয়ার্ক বিস্তার'}]},
          {year:'Today',title:{en:'Integrated Development',bn:'সমন্বিত উন্নয়ন'},body:{en:'Microfinance, health, education, rights, climate resilience, and enterprise programs work together seamlessly.',bn:'ক্ষুদ্রঋণ, স্বাস্থ্য, শিক্ষা, অধিকার, জলবায়ু সহনশীলতা ও উদ্যোগ কর্মসূচি নির্বিঘ্নে একসঙ্গে কাজ করছে।'},details:[{en:'Microfinance matrix',bn:'ক্ষুদ্রঋণ কাঠামো'},{en:'Climate resilient strategies',bn:'জলবায়ু সহনশীল কৌশল'},{en:'Cross-sector cohesion',bn:'আন্তঃখাত সমন্বয়'}]},
        ],
      },
      {
        type:'diagram',
        heading:{en:'Impact on SDG',bn:'এসডিজিতে প্রভাব'},
        variant:'sdg'
      },
      {
        type:'cards',
        variant:'impact',
        heading:{en:'What We Do',bn:'আমরা যা করি'},
        columns:3,
        items:[
          {title:{en:'Poverty Reduction',bn:'দারিদ্র্য হ্রাস'},body:{en:'Financial inclusion and livelihood support help households build income and resilience.',bn:'আর্থিক অন্তর্ভুক্তি ও জীবিকা সহায়তা পরিবারগুলোকে আয় ও স্থিতিস্থাপকতা গড়ে তুলতে সহায়তা করে।'},icon:'coins',href:'/microfinance-program'},
          {title:{en:'Health',bn:'স্বাস্থ্য'},body:{en:'Community-focused health services improve access to essential care and wellbeing.',bn:'কমিউনিটি-কেন্দ্রিক স্বাস্থ্যসেবা প্রয়োজনীয় চিকিৎসা ও সুস্থতার সুযোগ বাড়ায়।'},icon:'heart',href:'/social-development/health-program'},
          {title:{en:'Education',bn:'শিক্ষা'},body:{en:'Learning and skills initiatives expand opportunities for children, youth and adults.',bn:'শিক্ষা ও দক্ষতা উন্নয়ন কার্যক্রম শিশু, তরুণ ও প্রাপ্তবয়স্কদের সুযোগ বাড়ায়।'},icon:'book',href:'/social-development/education-program'},
          {title:{en:'Human Rights',bn:'মানবাধিকার'},body:{en:'Rights-based initiatives strengthen dignity, voice, inclusion and access to justice.',bn:'অধিকারভিত্তিক উদ্যোগ মর্যাদা, অংশগ্রহণ, অন্তর্ভুক্তি ও ন্যায়ের সুযোগকে শক্তিশালী করে।'},icon:'scale',href:'/social-development/human-rights'},
          {title:{en:'Climate & Livelihood',bn:'জলবায়ু ও জীবিকা'},body:{en:'Climate resilience and livelihood programs help communities adapt and prosper.',bn:'জলবায়ু সহনশীলতা ও জীবিকা কার্যক্রম কমিউনিটিকে অভিযোজন ও সমৃদ্ধিতে সহায়তা করে।'},icon:'leaf',href:'/social-development/climate-change'},
          {title:{en:'Community',bn:'কমিউনিটি'},body:{en:'Local participation and community systems put people at the centre of development.',bn:'স্থানীয় অংশগ্রহণ ও কমিউনিটি ব্যবস্থা মানুষকে উন্নয়নের কেন্দ্রবিন্দুতে রাখে।'},icon:'users',href:'/organizational-development'},
        ]
      },
      {
        type:'cards',
        homeComponent:'developmentAreas',
        eyebrow:{en:'What We Do',bn:'আমাদের কার্যক্রম'},
        heading:{en:'Integrated Development Areas',bn:'সমন্বিত উন্নয়ন ক্ষেত্র'},
        columns:3,
        items:[
          {title:{en:'Health & Nutrition',bn:'স্বাস্থ্য ও পুষ্টি'},body:{en:'Primary healthcare and nutrition for communities.',bn:'কমিউনিটির জন্য প্রাথমিক স্বাস্থ্যসেবা ও পুষ্টি।'},icon:'heart',href:'/social-development/health-program'},
          {title:{en:'Social Development',bn:'সামাজিক উন্নয়ন'},body:{en:'Rights, inclusion and community leadership.',bn:'অধিকার, অন্তর্ভুক্তি ও কমিউনিটি নেতৃত্ব।'},icon:'users',href:'/social-development'},
          {title:{en:'Microfinance & Loans',bn:'ক্ষুদ্রঋণ ও ঋণ সেবা'},body:{en:'Savings and loans built around livelihoods.',bn:'জীবিকাকেন্দ্রিক সঞ্চয় ও ঋণসেবা।'},icon:'coins',href:'/microfinance-program'},
          {title:{en:'Agriculture & Livelihood',bn:'কৃষি ও জীবিকা'},body:{en:'Climate-aware farming and rural income.',bn:'জলবায়ু-সচেতন কৃষি ও গ্রামীণ আয়।'},icon:'leaf',href:'/social-development/agriculture-livelihood'},
          {title:{en:'Enterprise Development',bn:'এন্টারপ্রাইজ উন্নয়ন'},body:{en:'Social enterprises linking people to markets.',bn:'মানুষকে বাজারের সঙ্গে যুক্ত করা সামাজিক উদ্যোগ।'},icon:'briefcase',href:'/enterprise-development'},
          {title:{en:'Education & Skills',bn:'শিক্ষা ও দক্ষতা'},body:{en:'Learning and practical skills for young people.',bn:'তরুণদের জন্য শিক্ষা ও ব্যবহারিক দক্ষতা।'},icon:'book',href:'/social-development/education-program'},
        ]
      },
      {
        type:'cards',
        heading:{en:'Srizony Enterprises',bn:'সৃজনী উদ্যোগসমূহ'},
        columns:4,
        items:enterpriseEntries.map((entry,i)=>({
          title:entry.title,
          body:entry.excerpt,
          icon:['heart','book','briefcase','building'][i%4] as IconName,
          href:`/enterprise-development/${entry.slug}`,
          image:entry.image,
        })),
      },
      {
        type:'carousel',
        homeComponent:'news',
        presentation:'scroller',
        collectionKind:'news',
        dataSource:'published-news',
        eyebrow:{en:'From Our Field',bn:'মাঠপর্যায় থেকে'},
        heading:{en:'News from the Field',bn:'মাঠপর্যায়ের সংবাদ'},
        body:{en:'Read the latest news, activities and updates from Srizony Foundation.',bn:'সৃজনী ফাউন্ডেশনের সর্বশেষ সংবাদ, কার্যক্রম ও আপডেট পড়ুন।'},
        items:newsEntries.slice(0,6).map(entry=>({
          tag:{en:entry.date||'Update',bn:entry.date||'আপডেট'},
          title:entry.title,
          body:entry.excerpt,
          image:entry.image,
          href:`/news/${entry.slug}`,
        })),
      },
      {
        type:'carousel',
        homeComponent:'successStories',
        presentation:'collection',
        collectionKind:'success-stories',
        dataSource:'published-success-stories',
        eyebrow:{en:'Real People, Real Change',bn:'মানুষের জীবনে বাস্তব পরিবর্তন'},
        heading:{en:'Success Stories of Srizony',bn:'সৃজনীর সাফল্যের গল্পসমূহ'},
        body:{en:'Stories of people and communities whose lives have changed.',bn:'মানুষ ও কমিউনিটির জীবনে ইতিবাচক পরিবর্তনের সাফল্যের গল্প।'},
        items:[],
        buttonConfig:{visible:true,mode:'primary',label:{en:'View all success stories',bn:'সব সাফল্যের গল্প দেখুন'},href:'/success-stories',action:'route'},
      },
      {
        type:'cta',
        homeComponent:'donate',
        heading:{en:'Support Srizony',bn:'সৃজনীকে সহায়তা করুন'},
        body:{en:'Your support helps communities access opportunity, essential services and a better future.',bn:'আপনার সহায়তা কমিউনিটির জন্য সুযোগ, প্রয়োজনীয় সেবা ও উন্নত ভবিষ্যৎ গড়তে সাহায্য করে।'},
        primary:{label:{en:'Donate Now',bn:'দান করুন'},href:'/donate'},
      }
    ]
  },
  '/awards-recognition': {slug:'/awards-recognition',title:{en:'Awards & Recognition',bn:'পুরস্কার ও স্বীকৃতি'},subtitle:{en:'Recognition of long-term community impact',bn:'দীর্ঘমেয়াদি কমিউনিটি প্রভাবের স্বীকৃতি'},heroImage:images.general.project2,sections:[{type:'timeline',heading:{en:'Recognition timeline',bn:'স্বীকৃতির ধারাবাহিকতা'},items:[{year:'01',title:{en:'Community Impact',bn:'কমিউনিটি প্রভাব'},body:{en:'Verified awards and institutional milestones will be featured here as official details become available.',bn:'অফিসিয়াল তথ্য পাওয়া গেলে যাচাইকৃত পুরস্কার ও প্রাতিষ্ঠানিক মাইলস্টোন এখানে প্রকাশ করা হবে।'}},{year:'02',title:{en:'Partnerships',bn:'অংশীদারিত্ব'},body:{en:'Each published recognition should include the awarding organization, date and context so visitors can understand the achievement.',bn:'প্রতিটি প্রকাশিত স্বীকৃতির সঙ্গে প্রদানকারী প্রতিষ্ঠান, তারিখ ও প্রেক্ষাপট উল্লেখ করা হবে, যাতে দর্শনার্থীরা অর্জনটি বুঝতে পারেন।'}}]},{type:'gallery',heading:{en:'Recognition & impact visuals',bn:'স্বীকৃতি ও প্রভাবের ভিজ্যুয়াল'},columns:3,items:[imageMedia(images.general.project1,{en:'Recognition visual',bn:'স্বীকৃতির ভিজ্যুয়াল'}),imageMedia(images.general.project2,{en:'Community impact visual',bn:'কমিউনিটি প্রভাবের ভিজ্যুয়াল'}),imageMedia(images.general.project3,{en:'Field impact visual',bn:'মাঠপর্যায়ের প্রভাবের ভিজ্যুয়াল'})]}]},
  '/about-us': { slug:'/about-us', title:{en:'About Us',bn:'আমাদের সম্পর্কে'}, subtitle:{en:'Legacy of Srizony Foundation',bn:'সৃজনী ফাউন্ডেশনের উত্তরাধিকার'}, heroImage:images.general.project1, sections:[
    {type:'stats',items:[{value:'1985',label:{en:'Established',bn:'প্রতিষ্ঠিত'}},{value:'16',label:{en:'Districts',bn:'জেলা'}},{value:'2,540',label:{en:'Staff',bn:'কর্মী'}},{value:'80',label:{en:'Branch offices',bn:'শাখা অফিস'}}]},
    {type:'richText',heading:{en:'Legacy of Srizony Foundation',bn:'সৃজনী ফাউন্ডেশনের উত্তরাধিকার'},body:[{en:'Srizony Foundation was established in Jhenaidah in 1985 and has grown into a national socio-economic development organization serving disadvantaged people.',bn:'সৃজনী ফাউন্ডেশন ১৯৮৫ সালে ঝিনাইদহে প্রতিষ্ঠিত হয় এবং সুবিধাবঞ্চিত মানুষের জন্য কাজ করতে করতে একটি জাতীয় আর্থ-সামাজিক উন্নয়ন প্রতিষ্ঠানে পরিণত হয়েছে।'},{en:'The organization combines community development, rights-based approaches, financial inclusion and social enterprise.',bn:'প্রতিষ্ঠানটি কমিউনিটি উন্নয়ন, অধিকারভিত্তিক পদ্ধতি, আর্থিক অন্তর্ভুক্তি ও সামাজিক উদ্যোগকে একত্রে এগিয়ে নেয়।'}],image:imageMedia(images.hero.secondary,{en:'Srizony community',bn:'সৃজনী কমিউনিটি'})},
    {type:'cards',heading:{en:'Mission, Goal & Values',bn:'লক্ষ্য, মিশন ও মূল্যবোধ'},columns:3,items:[{title:{en:'Goal',bn:'লক্ষ্য'},body:{en:'Improve the living standard of targeted poor people.',bn:'নির্ধারিত দরিদ্র মানুষের জীবনমান উন্নত করা।'},icon:'heart'},{title:{en:'Mission',bn:'মিশন'},body:{en:'Create an enabling environment for poverty reduction, socio-economic development and human rights.',bn:'দারিদ্র্য বিমোচন, আর্থ-সামাজিক উন্নয়ন ও মানবাধিকার প্রতিষ্ঠায় সহায়ক পরিবেশ তৈরি করা।'},icon:'users'},{title:{en:'Accountability',bn:'জবাবদিহিতা'},body:{en:'Demonstrate accountability and fairness by abiding by rules and policies.',bn:'নীতি ও নিয়ম মেনে জবাবদিহিতা ও ন্যায়পরায়ণতার চর্চা করা।'},icon:'shield'}]},
    {type:'timeline',heading:{en:'Our Journey',bn:'আমাদের পথচলা'},items:[{year:'1985',title:{en:'Foundation established',bn:'ফাউন্ডেশন প্রতিষ্ঠা'},body:{en:'Started from Jhenaidah with a focus on vulnerable communities.',bn:'ঝিনাইদহ থেকে সুবিধাবঞ্চিত মানুষের জন্য কাজ শুরু।'}},{year:'1992',title:{en:'Human rights work expanded',bn:'মানবাধিকার কার্যক্রম বিস্তৃত'},body:{en:'Rights-focused interventions became part of program areas.',bn:'অধিকারভিত্তিক কার্যক্রম প্রতিষ্ঠানের কর্মসূচিতে যুক্ত হয়।'}},{year:'2013',title:{en:'Urban health services',bn:'নগর স্বাস্থ্যসেবা'},body:{en:'Urban primary healthcare activities expanded through partnerships.',bn:'অংশীদারিত্বের মাধ্যমে নগর প্রাথমিক স্বাস্থ্যসেবা কার্যক্রম বিস্তৃত হয়।'}},{year:'Today',title:{en:'Integrated development',bn:'সমন্বিত উন্নয়ন'},body:{en:'Microfinance, health, education, rights, climate and enterprise programs work together.',bn:'ক্ষুদ্রঋণ, স্বাস্থ্য, শিক্ষা, অধিকার, জলবায়ু ও সামাজিক উদ্যোগ একসঙ্গে এগিয়ে চলেছে।'}}]}
  ]},
  '/founders-footprint': {slug:'/founders-footprint',title:{en:'Founders Footprint',bn:'প্রতিষ্ঠাতার অবদান'},subtitle:{en:'Prof. Dr. Harun Or Rashid',bn:'প্রফেসর ড. হারুন অর রশীদ'},heroImage:images.hero.secondary,sections:[{type:'richText',heading:{en:'About the Founder',bn:'প্রতিষ্ঠাতা সম্পর্কে'},body:[{en:'Prof. Dr. Harun Or Rashid has helped shape Srizony Foundation’s development approach, with an emphasis on responding to the needs of marginalized communities through grassroots work.',bn:'প্রান্তিক মানুষের প্রয়োজনের প্রতি সাড়া দিয়ে তৃণমূলভিত্তিক উন্নয়নের মাধ্যমে সুযোগ তৈরির লক্ষ্যে এম. হারুন অর রশীদ সৃজনী ফাউন্ডেশন প্রতিষ্ঠা করেন।'},{en:'The foundation’s community-centred philosophy continues to shape its work in education, health, rights and livelihoods.',bn:'শিক্ষা, স্বাস্থ্য, অধিকার ও জীবিকা উন্নয়নে প্রতিষ্ঠানের কমিউনিটি-কেন্দ্রিক দর্শন এখনও পথ দেখায়।'}],image:imageMedia(images.hero.secondary,{en:'Founder feature image',bn:'প্রতিষ্ঠাতার ফিচার ছবি'})},{type:'cards',heading:{en:'Founder’s Legacy',bn:'প্রতিষ্ঠাতার উত্তরাধিকার'},columns:3,items:[{title:{en:'Grassroots first',bn:'তৃণমূলকে অগ্রাধিকার'},body:{en:'Programs are designed around people’s real needs and participation.',bn:'মানুষের বাস্তব প্রয়োজন ও অংশগ্রহণকে কেন্দ্র করে কর্মসূচি তৈরি করা হয়।'},icon:'users'},{title:{en:'Women’s empowerment',bn:'নারীর ক্ষমতায়ন'},body:{en:'Economic and social opportunities for women remain central to the organization’s mission.',bn:'নারীর অর্থনৈতিক ও সামাজিক সুযোগ সৃষ্টি প্রতিষ্ঠানের মিশনের কেন্দ্রীয় অংশ।'},icon:'heart'},{title:{en:'Long-term change',bn:'দীর্ঘমেয়াদি পরিবর্তন'},body:{en:'Sustainable systems and local capacity are preferred over short-term interventions.',bn:'স্বল্পমেয়াদি উদ্যোগের চেয়ে টেকসই ব্যবস্থা ও স্থানীয় সক্ষমতাকে অগ্রাধিকার দেওয়া হয়।'},icon:'leaf'}]},{type:'contact',heading:{en:'Our Operational Footprint',bn:'আমাদের কার্যক্রমের বিস্তৃতি'},address:contactInfo.address,phones:contactInfo.phones,emails:[contactInfo.email],mapLabel:{en:'Open head office in Google Maps',bn:'প্রধান কার্যালয় গুগল ম্যাপে খুলুন'},locations:[{name:{en:'Head Office — Jhenaidah',bn:'প্রধান কার্যালয় — ঝিনাইদহ'},address:contactInfo.address,mapQuery:'111 Pabahati Road, Pabahati, Jhenaidah-7300, Bangladesh',kind:'site'},...contactInfo.footprint]}]},
  '/at-a-glance': {
    slug:'/at-a-glance',title:{en:'At A Glance',bn:'এক নজরে'},
    subtitle:{en:'Organization, people, programs and portfolio',bn:'প্রতিষ্ঠান, মানুষ, কর্মসূচি ও কার্যক্রমের সারসংক্ষেপ'},
    sections:[
      {type:'stats',items:[
        {value:'80',label:{en:'Branch offices',bn:'শাখা অফিস'}},{value:'1,898',label:{en:'Villages',bn:'গ্রাম'}},
        {value:'64',label:{en:'Upazila / Thana',bn:'উপজেলা / থানা'}},{value:'16',label:{en:'Districts',bn:'জেলা'}},
        {value:'2,540',label:{en:'Staff',bn:'কর্মী'}},{value:'69,753',label:{en:'Members',bn:'সদস্য'}},
        {value:'44,249',label:{en:'Active borrowers',bn:'সক্রিয় ঋণগ্রহীতা'}},{value:'7,432',label:{en:'Active groups',bn:'সক্রিয় গ্রুপ'}}
      ]},
      {type:'table',heading:{en:'Staff Strength',bn:'কর্মী সংখ্যা'},headers:[{en:'Staff type',bn:'কর্মীর ধরন'},{en:'Male',bn:'পুরুষ'},{en:'Female',bn:'নারী'},{en:'Total',bn:'মোট'}],rows:[
        [{en:'Administrative staff',bn:'প্রশাসনিক কর্মী'},{en:'62',bn:'৬২'},{en:'41',bn:'৪১'},{en:'103',bn:'১০৩'}],
        [{en:'Operation staff',bn:'অপারেশন কর্মী'},{en:'1,710',bn:'১,৭১০'},{en:'411',bn:'৪১১'},{en:'2,121',bn:'২,১২১'}],
        [{en:'Service staff',bn:'সেবা কর্মী'},{en:'83',bn:'৮৩'},{en:'107',bn:'১০৭'},{en:'190',bn:'১৯০'}],
        [{en:'Volunteers',bn:'স্বেচ্ছাসেবী'},{en:'87',bn:'৮৭'},{en:'39',bn:'৩৯'},{en:'126',bn:'১২৬'}],
        [{en:'Total',bn:'মোট'},{en:'1,942',bn:'১,৯৪২'},{en:'598',bn:'৫৯৮'},{en:'2,540',bn:'২,৫৪০'}]
      ]},
      {type:'cards',heading:{en:'Microfinance Portfolio',bn:'ক্ষুদ্রঋণ পোর্টফোলিও'},columns:4,items:[
        {title:{en:'General Savers',bn:'সাধারণ সঞ্চয়কারী'},body:{en:'69,174 active general savers.',bn:'৬৯,১৭৪ জন সক্রিয় সাধারণ সঞ্চয়কারী।'},icon:'coins'},
        {title:{en:'Primary Loan',bn:'প্রাথমিক ঋণ'},body:{en:'57,895 members in the published portfolio.',bn:'প্রকাশিত পোর্টফোলিওতে ৫৭,৮৯৫ জন সদস্য।'},icon:'coins'},
        {title:{en:'SME Loan',bn:'এসএমই ঋণ'},body:{en:'4,883 members in the published portfolio.',bn:'প্রকাশিত পোর্টফোলিওতে ৪,৮৮৩ জন সদস্য।'},icon:'briefcase'},
        {title:{en:'Long-term Savers',bn:'দীর্ঘমেয়াদি সঞ্চয়কারী'},body:{en:'33,552 long-term saver accounts on active borrowers.',bn:'সক্রিয় ঋণগ্রহীতাদের মধ্যে ৩৩,৫৫২টি দীর্ঘমেয়াদি সঞ্চয় হিসাব।'},icon:'building'}
      ]},
      {type:'cards',heading:{en:'Ongoing Projects',bn:'চলমান প্রকল্প'},columns:3,items:[
        ['Protection of Working Children (PWC)','কর্মজীবী শিশু সুরক্ষা (পিডব্লিউসি)'],['Second Chance Education (SCE)','সেকেন্ড চান্স শিক্ষা (এসসিই)'],['Basic Literacy Project — 64 Districts','বেসিক লিটারেসি প্রকল্প — ৬৪ জেলা'],
        ['Low-Cost Housing Project','স্বল্পমূল্যের আবাসন প্রকল্প'],['ENRICH','এনরিচ'],['Cultural & Sports Program','সাংস্কৃতিক ও ক্রীড়া কর্মসূচি'],
        ['Community Radio — Radio Jhenuk','কমিউনিটি রেডিও — রেডিও ঝিনুক'],['Mini-grid Project','মিনি-গ্রিড প্রকল্প'],['Solar Irrigation Pumping System','সোলার ইরিগেশন পাম্পিং সিস্টেম'],
        ['Improve Cook Stove','উন্নত চুলা কর্মসূচি'],['Disability Rehabilitation','প্রতিবন্ধী পুনর্বাসন'],['Srizony Hospital Program','সৃজনী হাসপাতাল কর্মসূচি'],
        ['Human Rights & Good Governance','মানবাধিকার ও সুশাসন'],['Adolescent Program','কিশোর-কিশোরী কর্মসূচি'],['Social Afforestation','সামাজিক বনায়ন'],
        ['Urban Primary Health Care','নগর প্রাথমিক স্বাস্থ্যসেবা'],['Disaster Management','দুর্যোগ ব্যবস্থাপনা'],['Safe Drinking Water & Sanitation','নিরাপদ পানি ও স্যানিটেশন']
      ].map((x,i)=>{
        const match = [...projectEntries,...additionalProjectEntries].find(entry=>entry.title.en.toLowerCase() === x[0].toLowerCase())
        return {title:{en:x[0],bn:x[1]},body:match?.excerpt || {en:'Explore the program overview and contact the foundation for current activities and eligibility.',bn:'কর্মসূচির সারসংক্ষেপ দেখুন এবং চলমান কার্যক্রম ও যোগ্যতার জন্য ফাউন্ডেশনের সঙ্গে যোগাযোগ করুন।'},icon:['building','users','shield'][i%3] as IconName,href:match?`/projects/${match.slug}`:'/projects',image:match?.image}
      })},
      {type:'cards',heading:{en:'Present Donor & Partner Agencies',bn:'বর্তমান দাতা ও অংশীদার সংস্থা'},columns:3,items:[
        ['Asian Development Bank (ADB)','এশিয়ান ডেভেলপমেন্ট ব্যাংক (এডিবি)'],['UNDP','ইউএনডিপি'],['UNFPA','ইউএনএফপিএ'],['World Bank & Government of Bangladesh','বিশ্বব্যাংক ও বাংলাদেশ সরকার'],
        ['European Union & Ministry of Land','ইউরোপীয় ইউনিয়ন ও ভূমি মন্ত্রণালয়'],['Bangladesh Bank','বাংলাদেশ ব্যাংক'],['IDCOL','আইডকল'],['PKSF','পিকেএসএফ'],['Credit and Development Forum (CDF)','ক্রেডিট অ্যান্ড ডেভেলপমেন্ট ফোরাম (সিডিএফ)'],
        ['Schneider Electric Foundation','শ্নাইডার ইলেকট্রিক ফাউন্ডেশন'],['Japan Bank for International Cooperation','জাপান ব্যাংক ফর ইন্টারন্যাশনাল কো-অপারেশন'],['National Disabled Development Foundation','জাতীয় প্রতিবন্ধী উন্নয়ন ফাউন্ডেশন']
      ].map((x,i)=>({title:{en:x[0],bn:x[1]},body:{en:'Published partner agency listed by Srizony Foundation.',bn:'সৃজনী ফাউন্ডেশনের প্রকাশিত অংশীদার সংস্থার তালিকায় অন্তর্ভুক্ত।'},icon:['building','users','shield'][i%3] as IconName}))},
      {type:'gallery',heading:{en:'Operational Footprint',bn:'কার্যক্রমের বিস্তৃতি'},columns:3,items:[
        imageMedia(images.hero.primary,{en:'Community field activity',bn:'কমিউনিটি মাঠ কার্যক্রম'}),
        imageMedia(images.general.project2,{en:'Livelihood and enterprise activity',bn:'জীবিকা ও উদ্যোগ কার্যক্রম'}),
        imageMedia(images.general.project3,{en:'Health and development activity',bn:'স্বাস্থ্য ও উন্নয়ন কার্যক্রম'})
      ]}
    ]
  },
  '/impact-on-sdg': {slug:'/impact-on-sdg',title:{en:'Our Program Impact on SDG',bn:'এসডিজিতে আমাদের কর্মসূচির প্রভাব'},subtitle:{en:'Connecting community action to the Sustainable Development Goals',bn:'কমিউনিটি উদ্যোগকে টেকসই উন্নয়ন লক্ষ্যের সঙ্গে যুক্ত করা'},sections:[{type:'diagram',heading:{en:'Our Contribution to SDGs',bn:'এসডিজিতে আমাদের অবদান'},body:{en:'Our programs contribute to poverty reduction, food security, health, education, gender equality, WASH, clean energy and climate resilience.',bn:'আমাদের কর্মসূচি দারিদ্র্য বিমোচন, খাদ্য নিরাপত্তা, স্বাস্থ্য, শিক্ষা, জেন্ডার সমতা, পানি-স্যানিটেশন, পরিচ্ছন্ন জ্বালানি ও জলবায়ু সহনশীলতায় অবদান রাখে।'},variant:'sdg'}]},
  '/partners-networks': {slug:'/partners-networks',title:{en:'Partners & Networks',bn:'অংশীদার ও নেটওয়ার্ক'},subtitle:{en:'Collaboration that expands impact',bn:'অংশীদারিত্বের মাধ্যমে প্রভাব বিস্তার'},sections:[{type:'richText',heading:{en:'Partners & Networks',bn:'অংশীদার ও নেটওয়ার্ক'},body:[{en:'Official partner and network information is published through the CMS. Partner logos and verified programme photographs are shown only when approved assets are available.',bn:'অফিসিয়াল অংশীদার ও নেটওয়ার্কের তথ্য CMS-এর মাধ্যমে প্রকাশ করা হয়। অনুমোদিত লোগো ও যাচাইকৃত কর্মসূচির ছবি পাওয়া গেলেই সেগুলো প্রকাশ করা হয়।'}]},{type:'cards',heading:{en:'Partnership Focus',bn:'অংশীদারিত্বের ক্ষেত্র'},columns:3,items:[{title:{en:'Development Partners',bn:'উন্নয়ন অংশীদার'},body:{en:'Working with development institutions on health, education, climate and livelihoods.',bn:'স্বাস্থ্য, শিক্ষা, জলবায়ু ও জীবিকা উন্নয়নে উন্নয়ন সংস্থার সঙ্গে কাজ।'},icon:'building'},{title:{en:'Government & Public Systems',bn:'সরকারি ও পাবলিক ব্যবস্থা'},body:{en:'Connecting community programs with relevant public services.',bn:'কমিউনিটি কর্মসূচিকে সরকারি সেবার সঙ্গে সংযুক্ত করা।'},icon:'shield'},{title:{en:'Civil Society',bn:'সুশীল সমাজ'},body:{en:'Networks that amplify rights, inclusion and local leadership.',bn:'অধিকার, অন্তর্ভুক্তি ও স্থানীয় নেতৃত্বকে শক্তিশালী করা নেটওয়ার্ক।'},icon:'users'}]}]},
  '/governing-body': {slug:'/governing-body',title:{en:'Governing Body',bn:'গভর্নিং বডি'},subtitle:{en:'Leadership, oversight and institutional accountability',bn:'নেতৃত্ব, তদারকি ও প্রাতিষ্ঠানিক জবাবদিহিতা'},sections:[
    {type:'richText',heading:{en:'Governing Body of Srizony Foundation',bn:'সৃজনী ফাউন্ডেশনের গভর্নিং বডি'},body:[{en:'The published governing-body page identifies seven members: Chairman, Vice-Chairman, General Secretary, Treasurer and three Executive Members.',bn:'প্রকাশিত গভর্নিং বডি পেজে সাত সদস্য দেখানো হয়েছে: চেয়ারম্যান, ভাইস-চেয়ারম্যান, সাধারণ সম্পাদক, কোষাধ্যক্ষ এবং তিনজন নির্বাহী সদস্য।'},{en:'Published management information also states that the General Committee consists of 18 members, the Advisory Committee has 7 members, the Executive Committee has 7 members, and…',bn:'প্রকাশিত ব্যবস্থাপনা তথ্যে বলা হয়েছে যে সাধারণ কমিটিতে ১৮ জন, উপদেষ্টা কমিটিতে ৭ জন, নির্বাহী কমিটিতে ৭ জন সদস্য এবং নির্বাহী অফিস নির্বাহী পরিচালকের নেতৃত্বে পরিচালিত হয়।'}],image:imageMedia(images.governance.aminBelal,{en:'Governance profile visual',bn:'গভর্নেন্স প্রোফাইল ভিজ্যুয়াল'})},
    {type:'cards',heading:{en:'Governing Body Members',bn:'গভর্নিং বডির সদস্যবৃন্দ'},columns:3,items:[
      {title:{en:'MD. Amin Belal — Chairman',bn:'মো. আমিন বেলাল — চেয়ারম্যান'},body:{en:'A distinguished leader with decades of experience in social welfare, community development and support for vulnerable populations.',bn:'সমাজকল্যাণ, কমিউনিটি উন্নয়ন ও ঝুঁকিপূর্ণ মানুষের সহায়তায় দীর্ঘ অভিজ্ঞতাসম্পন্ন একজন নেতা।'},image:imageMedia(images.governance.aminBelal,{en:'MD. Amin Belal profile visual',bn:'মো. আমিন বেলালের প্রোফাইল ভিজ্যুয়াল'}),tag:{en:'Chairman',bn:'চেয়ারম্যান'}},
      {title:{en:'MD. Abul Hashem — Vice-Chairman',bn:'মো. আবুল হাসেম — ভাইস-চেয়ারম্যান'},body:{en:'Experienced in community outreach and social initiatives, with a role in aligning projects with the foundation’s mission and sustainability.',bn:'কমিউনিটি আউটরিচ ও সামাজিক উদ্যোগে অভিজ্ঞ; প্রতিষ্ঠানের মিশন ও টেকসই বাস্তবায়নের সঙ্গে প্রকল্পসমূহকে সমন্বয় করতে ভূমিকা রাখেন।'},image:imageMedia(images.governance.abulHashem,{en:'MD. Abul Hashem profile visual',bn:'মো. আবুল হাসেমের প্রোফাইল ভিজ্যুয়াল'}),tag:{en:'Vice-Chairman',bn:'ভাইস-চেয়ারম্যান'}},
      {title:{en:'MD. Ohidul Islam — General Secretary',bn:'মো. ওহিদুল ইসলাম — সাধারণ সম্পাদক'},body:{en:'Brings administration, coordination and communication experience to organizational operations and stakeholder relationships.',bn:'প্রশাসন, সমন্বয় ও যোগাযোগের অভিজ্ঞতার মাধ্যমে সাংগঠনিক কার্যক্রম ও অংশীজন সম্পর্ককে সমর্থন করেন।'},image:imageMedia(images.governance.ohidulIslam,{en:'MD. Ohidul Islam profile visual',bn:'মো. ওহিদুল ইসলামের প্রোফাইল ভিজ্যুয়াল'}),tag:{en:'General Secretary',bn:'সাধারণ সম্পাদক'}},
      {title:{en:'Manoar Hossain — Treasurer',bn:'মনোয়ার হোসেন — কোষাধ্যক্ষ'},body:{en:'Oversees budgeting, financial planning and resource allocation with an emphasis on transparency and effective use of funds.',bn:'স্বচ্ছতা ও তহবিলের কার্যকর ব্যবহারে গুরুত্ব দিয়ে বাজেট, আর্থিক পরিকল্পনা ও সম্পদ বণ্টন তদারকি করেন।'},image:imageMedia(images.governance.manoarHossain,{en:'Manoar Hossain profile visual',bn:'মনোয়ার হোসেনের প্রোফাইল ভিজ্যুয়াল'}),tag:{en:'Treasurer',bn:'কোষাধ্যক্ষ'}},
      {title:{en:'MD. Shamim Uddin Mia — Executive Member',bn:'মো. শামীম উদ্দিন মিয়া — নির্বাহী সদস্য'},body:{en:'Focuses on educational development, literacy and skills for underserved populations.',bn:'সুবিধাবঞ্চিত মানুষের শিক্ষা, সাক্ষরতা ও দক্ষতা উন্নয়নে গুরুত্ব দেন।'},image:imageMedia(images.governance.shamimUddinMia,{en:'MD. Shamim Uddin Mia profile visual',bn:'মো. শামীম উদ্দিন মিয়ার প্রোফাইল ভিজ্যুয়াল'}),tag:{en:'Executive Member',bn:'নির্বাহী সদস্য'}},
      {title:{en:'Mrs. Afroza Bulbul — Executive Member',bn:'মিসেস আফরোজা বুলবুল — নির্বাহী সদস্য'},body:{en:'Guides environmental and sustainability-oriented initiatives and supports the foundation’s commitment to sustainable development.',bn:'পরিবেশ ও টেকসই উদ্যোগে দিকনির্দেশনা দেন এবং টেকসই উন্নয়নের প্রতি প্রতিষ্ঠানের অঙ্গীকারকে এগিয়ে নেন।'},image:imageMedia(images.governance.afrozaBulbul,{en:'Mrs. Afroza Bulbul profile visual',bn:'মিসেস আফরোজা বুলবুলের প্রোফাইল ভিজ্যুয়াল'}),tag:{en:'Executive Member',bn:'নির্বাহী সদস্য'}},
      {title:{en:'MST. Hasina Aman — Executive Member',bn:'মোছা. হাসিনা আমান — নির্বাহী সদস্য'},body:{en:'A healthcare professional whose published bio highlights public-health advocacy and wellness initiatives for disadvantaged communities.',bn:'একজন স্বাস্থ্যসেবা পেশাজীবী; প্রকাশিত জীবনীতে সুবিধাবঞ্চিত মানুষের জনস্বাস্থ্য ও সুস্থতা কার্যক্রমে তার ভূমিকার কথা উল্লেখ আছে।'},image:imageMedia(images.governance.hasinaAman,{en:'MST. Hasina Aman profile visual',bn:'মোছা. হাসিনা আমানের প্রোফাইল ভিজ্যুয়াল'}),tag:{en:'Executive Member',bn:'নির্বাহী সদস্য'}}
    ]},
    {type:'diagram',heading:{en:'Governance Structure',bn:'শাসন কাঠামো'},body:{en:'General Committee, Advisory Committee, Executive Committee and Executive Office form the published management structure.',bn:'সাধারণ কমিটি, উপদেষ্টা কমিটি, নির্বাহী কমিটি ও নির্বাহী অফিস প্রকাশিত ব্যবস্থাপনা কাঠামোর অংশ।'},variant:'governance'},
    {type:'stats',items:[{value:'18',label:{en:'General Committee members',bn:'সাধারণ কমিটির সদস্য'}},{value:'7',label:{en:'Advisory Committee members',bn:'উপদেষ্টা কমিটির সদস্য'}},{value:'7',label:{en:'Executive Committee members',bn:'নির্বাহী কমিটির সদস্য'}},{value:'1',label:{en:'Executive Director-led office',bn:'নির্বাহী পরিচালক নেতৃত্বাধীন অফিস'}}]}
  ]},
  '/senior-management': {slug:'/senior-management',title:{en:'Senior Management',bn:'সিনিয়র ম্যানেজমেন্ট'},sections:[{type:'cards',heading:{en:'Leadership Team',bn:'নেতৃত্ব দল'},columns:3,items:Array.from({length:6},(_,i)=>({title:{en:['Executive Director','Director — Programs','Director — Finance','Head — Microfinance','Head — HR & Admin','Head — Monitoring & Learning'][i],bn:['নির্বাহী পরিচালক','পরিচালক — প্রোগ্রাম','পরিচালক — ফাইন্যান্স','প্রধান — ক্ষুদ্রঋণ','প্রধান — মানবসম্পদ ও প্রশাসন','প্রধান — মনিটরিং ও লার্নিং'][i]},body:{en:'Leadership role supporting integrated development, systems and people.',bn:'সমন্বিত উন্নয়ন, ব্যবস্থা ও জনবল ব্যবস্থাপনায় দায়িত্বশীল নেতৃত্বের ভূমিকা।'},icon:['users','briefcase','coins','building','heart','scale'][i] as IconName}))}]},
  '/operational-structure': {slug:'/operational-structure',title:{en:'Operational Structure',bn:'অপারেশনাল কাঠামো'},sections:[{type:'diagram',heading:{en:'How the organization works',bn:'প্রতিষ্ঠান কীভাবে কাজ করে'},variant:'governance'},{type:'timeline',heading:{en:'Operating cycle',bn:'কার্যক্রমের চক্র'},items:[{year:'01',title:{en:'Listen',bn:'শোনা'},body:{en:'Community needs, data and feedback inform program design.',bn:'কমিউনিটির প্রয়োজন, তথ্য ও মতামত কর্মসূচি নকশায় প্রভাব ফেলে।'}},{year:'02',title:{en:'Plan',bn:'পরিকল্পনা'},body:{en:'Teams translate priorities into programs, budgets and partnerships.',bn:'অগ্রাধিকারকে কর্মসূচি, বাজেট ও অংশীদারিত্বে রূপ দেওয়া হয়।'}},{year:'03',title:{en:'Deliver',bn:'বাস্তবায়ন'},body:{en:'Local teams deliver services through branches and projects.',bn:'স্থানীয় দল শাখা ও প্রকল্পের মাধ্যমে সেবা দেয়।'}},{year:'04',title:{en:'Learn',bn:'শেখা'},body:{en:'Monitoring, evaluation and participant feedback improve the next cycle.',bn:'পর্যবেক্ষণ, মূল্যায়ন ও অংশগ্রহণকারীর মতামত পরবর্তী ধাপকে উন্নত করে।'}}]}]},
  '/executive-committee': {slug:'/executive-committee',title:{en:'Executive Committee',bn:'নির্বাহী কমিটি'},subtitle:{en:'The Executive Committee provides governance, strategic direction and oversight for the foundation’s mission and programs.',bn:'নির্বাহী কমিটি ফাউন্ডেশনের লক্ষ্য ও কর্মসূচির জন্য সুশাসন, কৌশলগত দিকনির্দেশনা এবং তদারকি নিশ্চিত করে।'},sections:[{type:'richText',heading:{en:'Governance and Responsibilities',bn:'সুশাসন ও দায়িত্ব'},body:[{en:'The Executive Committee guides institutional priorities, reviews plans and performance, promotes accountability, and supports the leadership team in delivering community-focused development programs. Member names and designations should be maintained by the CMS from officially approved records.',bn:'নির্বাহী কমিটি প্রাতিষ্ঠানিক অগ্রাধিকার নির্ধারণ, পরিকল্পনা ও কার্যক্রম পর্যালোচনা, জবাবদিহিতা জোরদার এবং কমিউনিটিকেন্দ্রিক উন্নয়ন কর্মসূচি বাস্তবায়নে নেতৃত্ব দলকে সহায়তা করে। সদস্যদের নাম ও পদবি অনুমোদিত অফিসিয়াল নথি অনুযায়ী CMS-এ সংরক্ষণ করতে হবে।'}]},{type:'cards',heading:{en:'Committee Responsibilities',bn:'কমিটির দায়িত্ব'},columns:3,items:[{title:{en:'Strategic Direction',bn:'কৌশলগত দিকনির্দেশনা'},body:{en:'Set priorities and review organizational plans against the foundation’s mission and community needs.',bn:'ফাউন্ডেশনের লক্ষ্য ও কমিউনিটির প্রয়োজন অনুযায়ী অগ্রাধিকার নির্ধারণ এবং প্রাতিষ্ঠানিক পরিকল্পনা পর্যালোচনা।'},icon:'arrow'},{title:{en:'Governance & Accountability',bn:'সুশাসন ও জবাবদিহিতা'},body:{en:'Promote transparent decisions, sound oversight and responsible use of organizational resources.',bn:'স্বচ্ছ সিদ্ধান্ত, কার্যকর তদারকি এবং প্রাতিষ্ঠানিক সম্পদের দায়িত্বশীল ব্যবহার নিশ্চিত করা।'},icon:'shield'},{title:{en:'Program Oversight',bn:'কর্মসূচি তদারকি'},body:{en:'Review progress, evidence and risks to help programs remain effective, inclusive and sustainable.',bn:'কর্মসূচির অগ্রগতি, প্রমাণ ও ঝুঁকি পর্যালোচনা করে কার্যকারিতা, অন্তর্ভুক্তি ও স্থায়িত্বে সহায়তা করা।'},icon:'users'}]}]},
  '/good-governance': {slug:'/good-governance',title:{en:'Human Rights & Good Governance',bn:'মানবাধিকার ও সুশাসন'},subtitle:{en:'Rights, accountability and dignity for all',bn:'সবার জন্য অধিকার, জবাবদিহিতা ও মর্যাদা'},heroImage:images.general.project2,sections:[{type:'richText',heading:{en:'Human Rights Work',bn:'মানবাধিকার কার্যক্রম'},body:[{en:'Srizony Foundation has implemented human rights-related activities since 1992 in its program intervention areas.',bn:'সৃজনী ফাউন্ডেশন ১৯৯২ সাল থেকে কর্মএলাকায় মানবাধিকার-সম্পর্কিত কার্যক্রম বাস্তবায়ন করে আসছে।'},{en:'The organization has undertaken initiatives including prevention of women and child trafficking, legal aid, gender development, disability development, adolescent development, children’s groups and rights-awareness training.',bn:'নারী ও শিশু পাচার প্রতিরোধ, আইনি সহায়তা, জেন্ডার উন্নয়ন, প্রতিবন্ধী উন্নয়ন, কিশোর-কিশোরী উন্নয়ন, শিশু গ্রুপ গঠন ও অধিকার প্রশিক্ষণসহ বিভিন্ন উদ্যোগ বাস্তবায়ন করা হয়েছে।'}],image:imageMedia(images.general.project2,{en:'Human rights program',bn:'মানবাধিকার কর্মসূচি'})},{type:'cards',heading:{en:'Good Governance Principles',bn:'সুশাসনের নীতিমালা'},columns:3,items:[{title:{en:'Participation',bn:'অংশগ্রহণ'},body:{en:'People are involved in decisions affecting their lives.',bn:'মানুষ তার জীবনকে প্রভাবিত করা সিদ্ধান্তে অংশ নেয়।'},icon:'users'},{title:{en:'Accountability',bn:'জবাবদিহিতা'},body:{en:'Processes and decisions are transparent and accountable.',bn:'প্রক্রিয়া ও সিদ্ধান্ত স্বচ্ছ ও জবাবদিহিমূলক।'},icon:'shield'},{title:{en:'Justice',bn:'ন্যায়বিচার'},body:{en:'Rights-based support helps address discrimination and injustice.',bn:'অধিকারভিত্তিক সহায়তা বৈষম্য ও অবিচার মোকাবিলায় সহায়তা করে।'},icon:'scale'}]},{type:'diagram',heading:{en:'Governance in practice',bn:'বাস্তবে সুশাসন'},variant:'impact'}]},
  '/social-development': {slug:'/social-development',title:{en:'Social Development',bn:'সামাজিক উন্নয়ন'},subtitle:{en:'Integrated services for healthier, capable communities',bn:'স্বাস্থ্যবান ও সক্ষম কমিউনিটির জন্য সমন্বিত সেবা'},heroImage:images.general.project3,sections:[{type:'cards',heading:{en:'Program Areas',bn:'কর্মসূচির ক্ষেত্র'},columns:4,items:[['Health Program','স্বাস্থ্য কর্মসূচি','Primary healthcare, nutrition and maternal health.','প্রাথমিক স্বাস্থ্যসেবা, পুষ্টি ও মাতৃস্বাস্থ্য।','/health-program','heart',images.programs.health],['Education Program','শিক্ষা কর্মসূচি','Inclusive education and skills for life and work.','অন্তর্ভুক্তিমূলক শিক্ষা ও জীবন-জীবিকার দক্ষতা।','/education-program','book',images.programs.education],['Human Rights','মানবাধিকার','Legal aid, protection and rights awareness.','আইনি সহায়তা, সুরক্ষা ও অধিকার সচেতনতা।','/human-rights','scale',images.programs.humanRights],['Human Resource','মানবসম্পদ','Training, leadership and people development.','প্রশিক্ষণ, নেতৃত্ব ও মানবসম্পদ উন্নয়ন।','/human-resource','users',images.programs.humanResource],['Climate Change','জলবায়ু পরিবর্তন','Resilience, adaptation and environmental action.','সহনশীলতা, অভিযোজন ও পরিবেশগত উদ্যোগ।','/climate-change','leaf',images.programs.climateChange],['Agriculture & Livelihood','কৃষি ও জীবিকা','Productivity, enterprise and livelihood strengthening.','উৎপাদনশীলতা, উদ্যোগ ও জীবিকা শক্তিশালীকরণ।','/agriculture-livelihood','sun',images.programs.agricultureLivelihood],['Organizational Development','প্রাতিষ্ঠানিক উন্নয়ন','Capacity building for local institutions.','স্থানীয় প্রতিষ্ঠানের সক্ষমতা বৃদ্ধি।','/organizational-development','building',images.programs.organizationalDevelopment],['Social Enterprise','সামাজিক উদ্যোগ','Sustainable enterprise models supporting social impact.','সামাজিক প্রভাবকে সহায়তাকারী টেকসই উদ্যোগ।','/social-enterprise','briefcase',images.programs.socialEnterprise]].map(x=>({title:{en:x[0],bn:x[1]},body:{en:x[2],bn:x[3]},href:x[4],icon:x[5] as IconName,image:imageMedia(x[6],{en:`${x[0]} visual`,bn:`${x[1]} ভিজ্যুয়াল`})}))},{type:'carousel',presentation:'scroller',eyebrow:{en:'Latest News',bn:'সর্বশেষ সংবাদ'},heading:{en:'News from the field',bn:'মাঠপর্যায়ের সংবাদ'},body:{en:'Field Stories are part of our news stream. Open any story to read the full update.',bn:'মাঠের গল্প আমাদের সংবাদধারারই অংশ। যেকোনো সংবাদ খুলে সম্পূর্ণ আপডেট পড়ুন।'},items:newsEntries.slice(0,6).map(entry=>({tag:{en:entry.date||'Update',bn:entry.date||'আপডেট'},title:entry.title,body:entry.excerpt,image:entry.image,href:`/news/${entry.slug}`}))}]},
  '/health-program': {slug:'/health-program',title:{en:'Health Program',bn:'স্বাস্থ্য কর্মসূচি'},subtitle:{en:'Urban primary health, nutrition and prevention',bn:'নগর প্রাথমিক স্বাস্থ্য, পুষ্টি ও প্রতিরোধ'},heroImage:images.hero.feature,sections:[{type:'richText',heading:{en:'Urban Health Support Program',bn:'নগর স্বাস্থ্য সহায়তা কর্মসূচি'},body:[{en:'Health and nutrition are major components of Srizony Foundation’s work.',bn:'স্বাস্থ্য ও পুষ্টি সৃজনী ফাউন্ডেশনের কাজের গুরুত্বপূর্ণ অংশ। যারা মানসম্মত চিকিৎসা সুবিধা থেকে বঞ্চিত, তাদের জন্য প্রতিষ্ঠান স্বাস্থ্যসেবা ও সহায়তা প্রদান করে।'},{en:'The program has included urban primary healthcare activities in Barisal division and Kushtia municipality areas through partnerships and public systems.',bn:'অংশীদারিত্ব ও সরকারি ব্যবস্থার মাধ্যমে বরিশাল বিভাগ ও কুষ্টিয়া পৌর এলাকায় নগর প্রাথমিক স্বাস্থ্যসেবা কার্যক্রম পরিচালিত হয়েছে।'}],image:imageMedia(images.hero.feature,{en:'Health service',bn:'স্বাস্থ্যসেবা'})},{type:'cards',heading:{en:'Service Components',bn:'সেবার উপাদান'},columns:4,items:[
    ['Antenatal Care','গর্ভকালীন সেবা'],['Postnatal Care','প্রসবোত্তর সেবা'],['Neonatal Care','নবজাতক সেবা'],['Normal Delivery','স্বাভাবিক প্রসব'],
    ['Caesarean Delivery','সিজারিয়ান প্রসব'],['Family Planning','পরিবার পরিকল্পনা'],['Maternal Nutrition','মাতৃ পুষ্টি'],['Child Nutrition','শিশু পুষ্টি'],
    ['Adolescent Reproductive Health','কিশোর-কিশোরী প্রজনন স্বাস্থ্য'],['Diagnostic Care','রোগ নির্ণয় সেবা'],['Emergency Transport','জরুরি পরিবহন'],
    ['Health Education','স্বাস্থ্য শিক্ষা'],['Violence Against Women','নারীর প্রতি সহিংসতা প্রতিরোধ'],['Income Generation','আয়বর্ধক কার্যক্রম'],
    ['Basic First Aid','প্রাথমিক চিকিৎসা'],['Counselling','কাউন্সেলিং']
  ].map((x,i)=>({title:{en:x[0],bn:x[1]},body:{en:'Service component included in the integrated health program.',bn:'সমন্বিত স্বাস্থ্য কর্মসূচির অন্তর্ভুক্ত সেবার একটি উপাদান।'},icon:['heart','users','shield','building'][i%4] as IconName}))},{type:'video',heading:{en:'Health in the community',bn:'কমিউনিটিতে স্বাস্থ্যসেবা'},body:{en:'Watch a real Srizony Foundation feature video on YouTube.',bn:'ইউটিউবে সৃজনী ফাউন্ডেশন সম্পর্কিত বাস্তব ভিডিও দেখুন।'},poster:images.hero.feature,embedUrl:media.featureVideoEmbedUrl,sourceUrl:media.featureVideoSourceUrl}]},
  '/education-program': {slug:'/education-program',title:{en:'Education Program',bn:'শিক্ষা কর্মসূচি'},sections:[{type:'cards',heading:{en:'Learning Pathways',bn:'শিক্ষার সুযোগ'},columns:3,items:[{title:{en:'Basic Literacy',bn:'মৌলিক সাক্ষরতা'},body:{en:'Learning opportunities for children and adults in underserved communities.',bn:'অনগ্রসর কমিউনিটির শিশু ও প্রাপ্তবয়স্কদের জন্য শিক্ষার সুযোগ।'},icon:'book'},{title:{en:'Second Chance Education',bn:'দ্বিতীয় সুযোগের শিক্ষা'},body:{en:'Flexible pathways for learners who missed mainstream schooling.',bn:'মূলধারার পড়াশোনা থেকে বাদ পড়া শিক্ষার্থীদের জন্য নমনীয় পথ।'},icon:'heart'},{title:{en:'Skills & Vocational Learning',bn:'দক্ষতা ও কারিগরি শিক্ষা'},body:{en:'Practical skills linked to livelihoods and local market needs.',bn:'জীবিকা ও স্থানীয় বাজারের প্রয়োজনের সঙ্গে যুক্ত ব্যবহারিক দক্ষতা।'},icon:'briefcase'}]},{type:'gallery',heading:{en:'Learning in Action',bn:'কার্যকর শিক্ষা'},columns:3,items:[imageMedia(images.general.project1,{en:'Learning session',bn:'শিক্ষা সেশন'}),imageMedia(images.general.project2,{en:'Community training',bn:'কমিউনিটি প্রশিক্ষণ'}),imageMedia(images.general.project3,{en:'Skills activity',bn:'দক্ষতা কার্যক্রম'})]}]},
  '/human-rights': {slug:'/human-rights',title:{en:'Human Rights',bn:'মানবাধিকার'},sections:[{type:'richText',heading:{en:'Rights, protection and access to justice',bn:'অধিকার, সুরক্ষা ও ন্যায়বিচারে প্রবেশাধিকার'},body:[{en:'The Legal Aid program provides legal aid to victims of torture and violence, illegal divorce, dowry, early marriage, polygamy and social injustices.',bn:'আইনি সহায়তা কর্মসূচির মাধ্যমে নির্যাতন ও সহিংসতার শিকার, অবৈধ তালাক, যৌতুক, বাল্যবিবাহ, বহুবিবাহ ও সামাজিক অবিচারের শিকার ব্যক্তিদের সহায়তা দেওয়া হয়।'},{en:'Srizony Foundation has also worked on child rights, disability development, women’s empowerment and community dispute resolution.',bn:'সৃজনী ফাউন্ডেশন শিশু অধিকার, প্রতিবন্ধী উন্নয়ন, নারীর ক্ষমতায়ন এবং কমিউনিটি বিরোধ নিষ্পত্তির কাজও করেছে।'}],image:imageMedia(images.general.project2,{en:'Rights awareness session',bn:'অধিকার সচেতনতা সেশন'})},{type:'cards',heading:{en:'Key Interventions',bn:'প্রধান উদ্যোগ'},columns:3,items:[{title:{en:'Legal Aid',bn:'আইনি সহায়তা'},body:{en:'Counselling and support for vulnerable rights-holders.',bn:'ঝুঁকিপূর্ণ অধিকারধারীদের কাউন্সেলিং ও সহায়তা।'},icon:'scale'},{title:{en:'Child Rights',bn:'শিশু অধিকার'},body:{en:'Safe spaces, participation and child-focused development.',bn:'নিরাপদ পরিবেশ, অংশগ্রহণ ও শিশু-কেন্দ্রিক উন্নয়ন।'},icon:'heart'},{title:{en:'Disability Inclusion',bn:'প্রতিবন্ধী অন্তর্ভুক্তি'},body:{en:'Rehabilitation, assistive support and community inclusion.',bn:'পুনর্বাসন, সহায়ক সেবা ও কমিউনিটিতে অন্তর্ভুক্তি।'},icon:'users'}]}]},
  '/human-resource': {slug:'/human-resource',title:{en:'Human Resource',bn:'মানবসম্পদ'},sections:[{type:'cards',heading:{en:'People Development',bn:'মানবসম্পদ উন্নয়ন'},columns:3,items:[{title:{en:'Training',bn:'প্রশিক্ষণ'},body:{en:'Role-based learning and continuous capacity development.',bn:'দায়িত্বভিত্তিক শেখা ও ধারাবাহিক সক্ষমতা উন্নয়ন।'},icon:'book'},{title:{en:'Leadership',bn:'নেতৃত্ব'},body:{en:'Leaders who can manage people, programs and change responsibly.',bn:'দায়িত্বশীলভাবে মানুষ, কর্মসূচি ও পরিবর্তন পরিচালনায় সক্ষম নেতৃত্ব।'},icon:'users'},{title:{en:'Wellbeing',bn:'কল্যাণ'},body:{en:'A respectful, safe and inclusive workplace culture.',bn:'সম্মানজনক, নিরাপদ ও অন্তর্ভুক্তিমূলক কর্মপরিবেশ।'},icon:'heart'}]}]},
  '/climate-change': {slug:'/climate-change',title:{en:'Climate Change',bn:'জলবায়ু পরিবর্তন'},sections:[{type:'richText',heading:{en:'Building resilience where climate risk is highest',bn:'যেখানে জলবায়ু ঝুঁকি বেশি, সেখানে সহনশীলতা তৈরি'},body:[{en:'Climate action combines awareness, adaptation, sustainable agriculture, social forestry, renewable energy and resilient livelihoods.',bn:'জলবায়ু কার্যক্রমে সচেতনতা, অভিযোজন, টেকসই কৃষি, সামাজিক বনায়ন, নবায়নযোগ্য জ্বালানি ও সহনশীল জীবিকার সমন্বয় করা হয়।'}],image:imageMedia(images.general.project3,{en:'Climate and environment',bn:'জলবায়ু ও পরিবেশ'})},{type:'cards',heading:{en:'Climate Responses',bn:'জলবায়ু মোকাবিলার উদ্যোগ'},columns:3,items:[{title:{en:'Solar Energy',bn:'সৌর জ্বালানি'},body:{en:'Clean energy access for rural communities and productive use.',bn:'গ্রামীণ মানুষের জন্য পরিচ্ছন্ন জ্বালানি ও উৎপাদনশীল ব্যবহার।'},icon:'sun'},{title:{en:'Resilient Livelihoods',bn:'সহনশীল জীবিকা'},body:{en:'Agriculture and income options adapted to climate risk.',bn:'জলবায়ু ঝুঁকির সঙ্গে মানানসই কৃষি ও আয়ধারার বিকল্প।'},icon:'leaf'},{title:{en:'Environmental Awareness',bn:'পরিবেশ সচেতনতা'},body:{en:'Community education on responsible natural resource use.',bn:'প্রাকৃতিক সম্পদের দায়িত্বশীল ব্যবহার নিয়ে কমিউনিটি শিক্ষা।'},icon:'droplets'}]}]},
  '/agriculture-livelihood': {slug:'/agriculture-livelihood',title:{en:'Agriculture & Livelihood',bn:'কৃষি ও জীবিকা'},sections:[{type:'cards',heading:{en:'Livelihood Pathways',bn:'জীবিকার পথ'},columns:3,items:[{title:{en:'Farm Productivity',bn:'কৃষি উৎপাদনশীলতা'},body:{en:'Training and finance that help producers improve output and resilience.',bn:'উৎপাদন ও সহনশীলতা বাড়াতে প্রশিক্ষণ ও অর্থায়ন।'},icon:'sun'},{title:{en:'Enterprise',bn:'উদ্যোগ'},body:{en:'Small business and value-chain opportunities for households.',bn:'পরিবারের জন্য ছোট ব্যবসা ও ভ্যালু-চেইন সুযোগ।'},icon:'briefcase'},{title:{en:'Livestock & Poultry',bn:'প্রাণিসম্পদ ও পোল্ট্রি'},body:{en:'Productive assets that strengthen household income.',bn:'পরিবারের আয়কে শক্তিশালী করা উৎপাদনশীল সম্পদ।'},icon:'leaf'}]},{type:'gallery',heading:{en:'Livelihood in Action',bn:'জীবিকার কার্যক্রম'},columns:3,items:[imageMedia(images.hero.primary,{en:'Agriculture activity',bn:'কৃষি কার্যক্রম'}),imageMedia(images.general.project2,{en:'Livelihood support',bn:'জীবিকা সহায়তা'}),imageMedia(images.general.project1,{en:'Community enterprise',bn:'কমিউনিটি উদ্যোগ'})]}]},
  '/organizational-development': {slug:'/organizational-development',title:{en:'Organizational Development',bn:'প্রাতিষ্ঠানিক উন্নয়ন'},sections:[{type:'diagram',heading:{en:'From people to systems',bn:'মানুষ থেকে ব্যবস্থায়'},body:{en:'Capacity development strengthens teams, processes, data, accountability and local institutions.',bn:'সক্ষমতা উন্নয়ন দল, প্রক্রিয়া, তথ্য, জবাবদিহিতা ও স্থানীয় প্রতিষ্ঠানকে শক্তিশালী করে।'},variant:'impact'},{type:'cards',heading:{en:'Capability Areas',bn:'সক্ষমতার ক্ষেত্র'},columns:3,items:[{title:{en:'Systems & Process',bn:'ব্যবস্থা ও প্রক্রিয়া'},body:{en:'Clear workflows and standards that improve delivery.',bn:'স্পষ্ট কর্মপ্রবাহ ও মানদণ্ড যা সেবা উন্নত করে।'},icon:'building'},{title:{en:'Monitoring & Learning',bn:'পর্যবেক্ষণ ও শেখা'},body:{en:'Evidence and feedback inform better decisions.',bn:'তথ্য ও মতামত উন্নত সিদ্ধান্তে সহায়তা করে।'},icon:'scale'},{title:{en:'Local Institutions',bn:'স্থানীয় প্রতিষ্ঠান'},body:{en:'Community-based structures become stronger and more accountable.',bn:'কমিউনিটি-ভিত্তিক কাঠামো আরও শক্তিশালী ও জবাবদিহিমূলক হয়।'},icon:'users'}]}]},
  '/microfinance-program': {slug:'/microfinance-program',title:{en:'Microfinance Program',bn:'ক্ষুদ্রঋণ কর্মসূচি'},subtitle:{en:'Savings, groups, responsible finance and long-term financial inclusion',bn:'সঞ্চয়, গ্রুপ, দায়িত্বশীল অর্থায়ন ও দীর্ঘমেয়াদি আর্থিক অন্তর্ভুক্তি'},heroImage:images.programs.socialEnterprise,sections:[
    {type:'richText',eyebrow:{en:'Microfinance is more than a loan',bn:'ক্ষুদ্রঋণ শুধু ঋণ নয়'},heading:{en:'A structured financial-inclusion program built around savings, groups and responsible credit.',bn:'সঞ্চয়, গ্রুপ ও দায়িত্বশীল ঋণকে কেন্দ্র করে গড়ে ওঠা একটি আর্থিক অন্তর্ভুক্তিমূলক কর্মসূচি।'},body:[
      {en:'Srizony Foundation describes its microfinance program through branch operations, member groups, savings, active borrowers, loan portfolio and recovery performance.',bn:'সৃজনী ফাউন্ডেশন তার ক্ষুদ্রঋণ কর্মসূচিকে শাখা কার্যক্রম, সদস্য গ্রুপ, সঞ্চয়, সক্রিয় ঋণগ্রহীতা, ঋণ পোর্টফোলিও ও আদায় কার্যক্রমের মাধ্যমে পরিচালনা করে।'},
      {en:'This page is about the overall microfinance system. Individual loan products are presented separately under Get Loan.',bn:'এই পেজটি সামগ্রিক ক্ষুদ্রঋণ ব্যবস্থাকে ব্যাখ্যা করে। পৃথক ঋণ পণ্যগুলো Get Loan-এর অধীনে আলাদাভাবে দেখানো হয়েছে।'}
    ],image:imageMedia(images.programs.socialEnterprise,{en:'Microfinance program activity',bn:'ক্ষুদ্রঋণ কর্মসূচির কার্যক্রম'})},
    {type:'stats',items:[{value:'80',label:{en:'Total branches',bn:'মোট শাখা'}},{value:'76',label:{en:'Microfinance branches',bn:'ক্ষুদ্রঋণ শাখা'}},{value:'3',label:{en:'SME branches',bn:'এসএমই শাখা'}},{value:'1',label:{en:'ENRICH branch',bn:'এনরিচ শাখা'}},{value:'1,898',label:{en:'Villages',bn:'গ্রাম'}},{value:'69,753',label:{en:'Members',bn:'সদস্য'}},{value:'44,249',label:{en:'Active borrowers',bn:'সক্রিয় ঋণগ্রহীতা'}},{value:'99.63%',label:{en:'Cumulative recovery',bn:'ক্রমপুঞ্জীভূত আদায় হার'}}]},
    {type:'cards',heading:{en:'Microfinance Components',bn:'ক্ষুদ্রঋণের প্রধান উপাদান'},columns:3,items:[
      {title:{en:'Savings & Capital Building',bn:'সঞ্চয় ও মূলধন গঠন'},body:{en:'Regular savings, long-term savings and capital-building accounts help members create financial buffers.',bn:'নিয়মিত সঞ্চয়, দীর্ঘমেয়াদি সঞ্চয় ও মূলধন গঠনের হিসাব সদস্যদের আর্থিক সুরক্ষা তৈরি করতে সহায়তা করে।'},image:imageMedia(images.field.livelihood,{en:'Savings and livelihood activity',bn:'সঞ্চয় ও জীবিকা কার্যক্রম'}),href:'/at-a-glance'},
      {title:{en:'Groups & Collection Centres',bn:'গ্রুপ ও সংগ্রহ কেন্দ্র'},body:{en:'Member groups provide a recurring structure for meetings, savings, repayments and community accountability.',bn:'সদস্য গ্রুপ সভা, সঞ্চয়, কিস্তি ও কমিউনিটি জবাবদিহিতার ধারাবাহিক কাঠামো তৈরি করে।'},image:imageMedia(images.field.partnership,{en:'Community group meeting',bn:'কমিউনিটি গ্রুপ সভা'}),href:'/projects'},
      {title:{en:'Responsible Credit',bn:'দায়িত্বশীল ঋণ'},body:{en:'Loan products sit inside the wider microfinance program and are matched to different household and enterprise needs.',bn:'বিভিন্ন পরিবার ও উদ্যোগের প্রয়োজন অনুযায়ী ঋণ পণ্যগুলো বৃহত্তর ক্ষুদ্রঋণ কর্মসূচির ভেতরে পরিচালিত হয়।'},image:imageMedia(images.field.health,{en:'Community financial support',bn:'কমিউনিটি আর্থিক সহায়তা'}),href:'/organizational-development'}
    ]},
    {type:'table',heading:{en:'Published Microfinance Portfolio',bn:'প্রকাশিত ক্ষুদ্রঋণ পোর্টফোলিও'},headers:[{en:'Indicator',bn:'সূচক'},{en:'Published value',bn:'প্রকাশিত মান'}],rows:[
      [{en:'Total members',bn:'মোট সদস্য'},{en:'69,753',bn:'৬৯,৭৫৩'}],[{en:'General savers',bn:'সাধারণ সঞ্চয়কারী'},{en:'69,174',bn:'৬৯,১৭৪'}],[{en:'Primary loan members',bn:'প্রাথমিক ঋণ সদস্য'},{en:'57,895',bn:'৫৭,৮৯৫'}],[{en:'SME loan members',bn:'এসএমই ঋণ সদস্য'},{en:'4,883',bn:'৪,৮৮৩'}],[{en:'Active borrowers',bn:'সক্রিয় ঋণগ্রহীতা'},{en:'44,249',bn:'৪৪,২৪৯'}],[{en:'Cumulative recovery rate',bn:'ক্রমপুঞ্জীভূত আদায় হার'},{en:'99.63%',bn:'৯৯.৬৩%'}]
    ]},
    {type:'table',heading:{en:'Microfinance participation & service conditions',bn:'ক্ষুদ্রঋণ অংশগ্রহণ ও সেবা শর্ত'},headers:[{en:'Area',bn:'ক্ষেত্র'},{en:'General information',bn:'সাধারণ তথ্য'}],rows:[
      [{en:'Membership',bn:'সদস্যপদ'},{en:'Clients participate through local groups or branches and follow the foundation’s membership and record-keeping process.',bn:'ক্লায়েন্ট স্থানীয় গ্রুপ বা শাখার মাধ্যমে অংশগ্রহণ করেন এবং ফাউন্ডেশনের সদস্যপদ ও রেকর্ড সংরক্ষণ প্রক্রিয়া অনুসরণ করেন।'}],
      [{en:'Savings',bn:'সঞ্চয়'},{en:'The published portfolio includes general, long-term and capital build-up savings accounts.',bn:'প্রকাশিত পোর্টফোলিওতে সাধারণ, দীর্ঘমেয়াদি ও মূলধন গঠন সঞ্চয়ের হিসাব রয়েছে।'}],
      [{en:'Credit assessment',bn:'ঋণ মূল্যায়ন'},{en:'Eligibility, amount and repayment schedule are assessed under the applicable product and current institutional policy.',bn:'যোগ্যতা, পরিমাণ ও কিস্তি পরিকল্পনা প্রযোজ্য পণ্য এবং বর্তমান প্রাতিষ্ঠানিক নীতিমালা অনুযায়ী মূল্যায়ন করা হয়।'}],
      [{en:'Fees & service charge',bn:'ফি ও সার্ভিস চার্জ'},{en:'Applicable fees or service charges follow the current approved schedule; confirm them with the relevant branch before applying.',bn:'প্রযোজ্য ফি বা সার্ভিস চার্জ বর্তমান অনুমোদিত সূচি অনুযায়ী; আবেদন করার আগে সংশ্লিষ্ট শাখা থেকে নিশ্চিত করুন।'}],
      [{en:'Repayment discipline',bn:'কিস্তি শৃঙ্খলা'},{en:'Members are expected to follow the agreed repayment and savings schedule and maintain accurate records.',bn:'সদস্যদের নির্ধারিত কিস্তি ও সঞ্চয় পরিকল্পনা অনুসরণ এবং সঠিক রেকর্ড বজায় রাখা প্রত্যাশিত।'}]
    ]},
    {type:'richText',heading:{en:'Microfinance terms & conditions',bn:'ক্ষুদ্রঋণ শর্তাবলি'},body:[
      {en:'Participation is subject to product eligibility, local verification and the foundation’s current operating policies.',bn:'অংশগ্রহণ পণ্যভিত্তিক যোগ্যতা, স্থানীয় যাচাই এবং ফাউন্ডেশনের বর্তমান পরিচালন নীতিমালার অধীন।'},
      {en:'Published portfolio figures may change over time.',bn:'প্রকাশিত পোর্টফোলিওর পরিসংখ্যান সময়ের সঙ্গে পরিবর্তিত হতে পারে।'}
    ]} ,
    {type:'cta',heading:{en:'Looking for a specific loan product?',bn:'নির্দিষ্ট ঋণ পণ্য খুঁজছেন?'},body:{en:'Browse the dedicated loan products to see the purpose and program details for each offering.',bn:'প্রতিটি ঋণ পণ্যের উদ্দেশ্য ও বিস্তারিত দেখতে Get Loan-এর আলাদা পেজগুলো দেখুন।'},primary:{label:{en:'Browse Loan Products',bn:'ঋণ পণ্য দেখুন'},href:'/organizational-development'}}
  ]},
  '/loans': {slug:'/loans',title:{en:'Get Loan',bn:'ঋণ নিন'},subtitle:{en:'Dedicated loan products for different household, enterprise, agriculture and education needs',bn:'পরিবার, উদ্যোগ, কৃষি ও শিক্ষার বিভিন্ন প্রয়োজনের জন্য পৃথক ঋণ পণ্য'},heroImage:images.loans.smallEnterprise,sections:[
    {type:'richText',eyebrow:{en:'Loan Products',bn:'ঋণ পণ্য'},heading:{en:'Choose the product that matches your purpose.',bn:'আপনার প্রয়োজনের সঙ্গে মিল রেখে ঋণ পণ্য বেছে নিন।'},body:[{en:'The foundation publishes a range of loan offerings under its microfinance activities, including women business, small enterprise, agricultural development, household migrant, ru…',bn:'ফাউন্ডেশন তার ক্ষুদ্রঋণ কার্যক্রমের অধীনে নারী উদ্যোক্তা, ক্ষুদ্র উদ্যোগ, কৃষি উন্নয়ন, অভিবাসী পরিবার, গ্রামীণ উন্নয়ন, চাকরিজীবী ও শিক্ষার্থী ঋণসহ বিভিন্ন ঋণ পণ্য প্রকাশ করে।'},{en:'This page is the loan catalogue. The microfinance page explains the wider financial-inclusion system, member structure, savings and portfolio.',bn:'এই পেজটি ঋণ পণ্যের ক্যাটালগ। ক্ষুদ্রঋণ পেজে সামগ্রিক আর্থিক অন্তর্ভুক্তি ব্যবস্থা, সদস্য কাঠামো, সঞ্চয় ও পোর্টফোলিও ব্যাখ্যা করা হয়েছে।'}],image:imageMedia(images.loans.smallEnterprise,{en:'Loan products',bn:'ঋণ পণ্য'})},
    {type:'cards',heading:{en:'Loan Products',bn:'ঋণ পণ্যসমূহ'},columns:3,items:[
      ...loanItems.map((x,i)=>({title:{en:x[0],bn:x[1]},body:{en:x[2],bn:x[3]},href:x[4],illustration:['women-business','small-enterprise','agriculture','migrant-household','rural-development','career','education'][i] as any}))
    ]},
    {type:'cards',heading:{en:'Loan Details',bn:'ঋণের বিস্তারিত'},columns:3,items:[
      {title:{en:'Purpose',bn:'উদ্দেশ্য'},body:{en:'Each product is designed around a stated household, enterprise, agriculture, migration, employment or education need.',bn:'প্রতিটি পণ্য পরিবার, উদ্যোগ, কৃষি, অভিবাসন, কর্মসংস্থান বা শিক্ষার নির্দিষ্ট প্রয়োজনকে কেন্দ্র করে তৈরি।'},icon:'check'},
      {title:{en:'Eligibility',bn:'যোগ্যতা'},body:{en:'Eligibility depends on the selected product, applicant profile, local verification and current institutional policy.',bn:'যোগ্যতা নির্বাচিত পণ্য, আবেদনকারীর প্রোফাইল, স্থানীয় যাচাই ও বর্তমান প্রাতিষ্ঠানিক নীতিমালার ওপর নির্ভর করে।'},icon:'users'},
      {title:{en:'Repayment',bn:'পরিশোধ'},body:{en:'Repayment frequency and duration are confirmed during approval and may vary by product.',bn:'অনুমোদনের সময় কিস্তির ঘনত্ব ও মেয়াদ নিশ্চিত করা হয় এবং পণ্যভেদে পরিবর্তিত হতে পারে।'},icon:'building'}
    ]},
    {type:'table',heading:{en:'General loan terms & conditions',bn:'সাধারণ ঋণের শর্তাবলি'},headers:[{en:'Term',bn:'শর্ত'},{en:'Policy',bn:'নীতি'}],rows:[
      [{en:'Loan amount',bn:'ঋণের পরিমাণ'},{en:'Approved limits depend on product purpose, repayment capacity and the current approved schedule. Confirm the latest amount with the branch.',bn:'অনুমোদিত সীমা পণ্যের উদ্দেশ্য, পরিশোধ সক্ষমতা ও বর্তমান অনুমোদিত সূচির ওপর নির্ভর করে। সর্বশেষ পরিমাণ শাখা থেকে নিশ্চিত করুন।'}],
      [{en:'Service charge / fees',bn:'সার্ভিস চার্জ / ফি'},{en:'Applicable charges follow the current approved schedule and should be confirmed before application.',bn:'প্রযোজ্য চার্জ বর্তমান অনুমোদিত সূচি অনুযায়ী; আবেদন করার আগে নিশ্চিত করতে হবে।'}],
      [{en:'Repayment',bn:'পরিশোধ'},{en:'Repayment frequency and duration are set for the selected product and communicated during approval or disbursement.',bn:'পরিশোধের ঘনত্ব ও মেয়াদ নির্বাচিত পণ্য অনুযায়ী নির্ধারিত এবং অনুমোদন বা বিতরণের সময় জানানো হয়।'}],
      [{en:'Membership / savings',bn:'সদস্যপদ / সঞ্চয়'},{en:'Where applicable, the loan is linked to the microfinance membership and savings process.',bn:'প্রযোজ্য ক্ষেত্রে ঋণটি ক্ষুদ্রঋণ সদস্যপদ ও সঞ্চয় প্রক্রিয়ার সঙ্গে যুক্ত।'}],
      [{en:'Documents',bn:'কাগজপত্র'},{en:'Identity, address and product-specific supporting documents may be required; the branch provides the final checklist.',bn:'পরিচয়, ঠিকানা ও পণ্যভিত্তিক সহায়ক কাগজপত্র প্রয়োজন হতে পারে; চূড়ান্ত তালিকা শাখা দেবে।'}],
      [{en:'Guarantor / security',bn:'গ্যারান্টর / নিরাপত্তা'},{en:'Any guarantor or security requirement depends on the product and current policy; confirm with the relevant office.',bn:'গ্যারান্টর বা নিরাপত্তার প্রয়োজন পণ্য ও বর্তমান নীতিমালার ওপর নির্ভর করে; সংশ্লিষ্ট অফিস থেকে নিশ্চিত করুন।'}]
    ]},
    {type:'richText',heading:{en:'Before you apply',bn:'আবেদনের আগে'},body:[
      {en:'Choose the product whose purpose matches your need.',bn:'আপনার প্রয়োজনের সঙ্গে মেলে এমন পণ্য বেছে নিন।'}
    ]}
  ]},
  '/enterprise-development': {slug:'/enterprise-development',title:{en:'Enterprise Development',bn:'এন্টারপ্রাইজ উন্নয়ন'},sections:[{type:'cards',heading:{en:'Srizony Enterprises',bn:'সৃজনী উদ্যোগসমূহ'},columns:4,items:enterpriseEntries.map((entry,i)=>({title:entry.title,body:entry.excerpt,icon:['heart','book','briefcase','building'][i%4] as IconName,href:`/enterprise-development/${entry.slug}`,image:entry.image}))},{type:'gallery',heading:{en:'Enterprise Story',bn:'উদ্যোগের গল্প'},columns:3,items:[imageMedia(images.general.project1,{en:'Enterprise activity',bn:'উদ্যোগ কার্যক্রম'}),imageMedia(images.general.project2,{en:'Service delivery',bn:'সেবা কার্যক্রম'}),imageMedia(images.general.project3,{en:'Skills and employment',bn:'দক্ষতা ও কর্মসংস্থান'})]}]},
  '/projects': {slug:'/projects',title:{en:'Projects',bn:'প্রকল্পসমূহ'},subtitle:{en:'Programs and initiatives across Bangladesh',bn:'বাংলাদেশজুড়ে বিভিন্ন কর্মসূচি ও উদ্যোগ'},heroImage:images.general.project3,sections:[{type:'carousel',presentation:'collection',collectionKind:'projects',eyebrow:{en:'Project Portfolio',bn:'প্রকল্প পোর্টফোলিও'},heading:{en:'Programs that create measurable community impact',bn:'কমিউনিটিতে পরিমাপযোগ্য প্রভাব তৈরি করা প্রকল্পসমূহ'},items:[...projectEntries,...additionalProjectEntries].map(entry=>({title:entry.title,body:entry.excerpt,image:entry.image,href:`/projects/${entry.slug}`}))},{type:'cta',heading:{en:'Need a project partnership?',bn:'প্রকল্প অংশীদারিত্ব করতে চান?'},body:{en:'Connect with our team to discuss collaboration, implementation and community impact.',bn:'সহযোগিতা, বাস্তবায়ন ও কমিউনিটি প্রভাব নিয়ে আলোচনা করতে আমাদের দলের সঙ্গে যোগাযোগ করুন।'},primary:{label:{en:'Contact Us',bn:'যোগাযোগ করুন'},href:'/contact'},secondary:{label:{en:'Donate',bn:'দান করুন'},href:'/donate'}}]},
  '/news': {slug:'/news',title:{en:'Latest News',bn:'সর্বশেষ সংবাদ'},heroImage:images.general.project2,sections:[{type:'carousel',presentation:'collection',collectionKind:'news',eyebrow:{en:'Latest Updates',bn:'সর্বশেষ আপডেট'},heading:{en:'Stories, announcements and field updates',bn:'গল্প, ঘোষণা ও মাঠপর্যায়ের আপডেট'},items:newsEntries.map(entry=>({tag:{en:entry.date||'Update',bn:entry.date||'আপডেট'},title:entry.title,body:entry.excerpt,image:entry.image,href:`/news/${entry.slug}`}))},{type:'cta',heading:{en:'Have a story to share?',bn:'আপনার কোনো গল্প আছে?'},body:{en:'Send verified organizational news or partnership updates to the communications team.',bn:'যাচাইকৃত সাংগঠনিক সংবাদ বা অংশীদারিত্বের আপডেট যোগাযোগ টিমকে পাঠান।'},primary:{label:{en:'Email Us',bn:'ইমেইল করুন'},href:'mailto:info@srizonyfoundation.org.bd'}}]},
  '/success-stories': {slug:'/success-stories',title:{en:'Success Stories of Srizony',bn:'সৃজনীর সাফল্যের গল্পসমূহ'},subtitle:{en:'Stories of people and communities whose lives have changed.',bn:'মানুষ ও কমিউনিটির জীবনে ইতিবাচক পরিবর্তনের সাফল্যের গল্প।'},sections:[{type:'contentFeed',visible:true,heading:{en:'Success Stories of Srizony',bn:'সৃজনীর সাফল্যের গল্পসমূহ'},components:['success-story'],items:[],columns:3}]},
  '/notice': {slug:'/notice',title:{en:'Notice',bn:'নোটিশ'},sections:[{type:'noticeList',heading:{en:'Notices & Circulars',bn:'নোটিশ ও বিজ্ঞপ্তি'},items:noticeEntries.map(entry=>({date:entry.date||'',title:entry.title,body:entry.excerpt,href:`/notice/${entry.slug}`}))}]},
  '/carrer-job': {slug:'/carrer-job',title:{en:'Career / Job Circular',bn:'ক্যারিয়ার / চাকরি বিজ্ঞপ্তি'},subtitle:{en:'Build your career with a purpose-driven organization',bn:'উদ্দেশ্যভিত্তিক প্রতিষ্ঠানের সঙ্গে আপনার ক্যারিয়ার গড়ুন'},heroImage:images.hero.feature,sections:[{type:'noticeList',heading:{en:'Open Opportunities',bn:'চলমান সুযোগ'},items:careerEntries.map(entry=>({date:entry.date||'',title:entry.title,body:entry.excerpt,href:`/carrer-job/${entry.slug}`}))},{type:'cta',heading:{en:'No published vacancies right now?',bn:'এই মুহূর্তে কোনো প্রকাশিত শূন্যপদ নেই?'},body:{en:'Current vacancies are published through the CMS only after the official circular and application instructions are approved.',bn:'অফিসিয়াল বিজ্ঞপ্তি ও আবেদন নির্দেশনা অনুমোদনের পরই বর্তমান শূন্যপদ CMS-এর মাধ্যমে প্রকাশ করা হয়।'},primary:{label:{en:'Contact Us',bn:'যোগাযোগ করুন'},href:'/contact'}}]},
  '/contact': {slug:'/contact',title:{en:'Contact',bn:'যোগাযোগ'},sections:[{type:'contact',heading:{en:'Location & Other Inquiries',bn:'ঠিকানা ও অন্যান্য অনুসন্ধান'},address:contactInfo.address,phones:contactInfo.phones,emails:[contactInfo.email],mapLabel:{en:'Open location in Google Maps',bn:'গুগল ম্যাপে অবস্থান দেখুন'},locations:[{name:{en:'Head Office — Srizony Bhaban',bn:'প্রধান কার্যালয় — সৃজনী ভবন'},address:contactInfo.address,mapQuery:'111 Pabahati Road, Pabahati, Jhenaidah-7300, Bangladesh',kind:'site'},...contactInfo.footprint]},{type:'cta',heading:{en:'Send us a message',bn:'আমাদের বার্তা পাঠান'},body:{en:'For partnerships, programs, careers or support, use the contact details above.',bn:'অংশীদারিত্ব, কর্মসূচি, ক্যারিয়ার বা সহায়তার জন্য উপরের যোগাযোগ তথ্য ব্যবহার করুন।'},primary:{label:{en:'Email Us',bn:'ইমেইল করুন'},href:'mailto:info@srizonyfoundation.org.bd'}}]},
  '/donate': {slug:'/donate',title:{en:'Donate',bn:'দান করুন'},subtitle:{en:'Help Create Lasting Change',bn:'স্থায়ী পরিবর্তনের অংশ হোন'},heroImage:images.general.project3,sections:[{type:'donation',heading:{en:'Your support matters',bn:'আপনার সহায়তা গুরুত্বপূর্ণ'},body:{en:'Choose an amount and pay securely by card, bKash, Nagad, Rocket, mobile banking or internet banking. Anonymous donations are welcome.',bn:'পরিমাণ নির্বাচন করে কার্ড, বিকাশ, নগদ, রকেট, মোবাইল ব্যাংকিং বা ইন্টারনেট ব্যাংকিংয়ে নিরাপদে দান করুন। বেনামে দান করা যায়।'}},{type:'cards',heading:{en:'What your support helps fund',bn:'আপনার সহায়তা কোথায় কাজে লাগে'},columns:3,items:[{title:{en:'Health',bn:'স্বাস্থ্য'},body:{en:'Primary healthcare, nutrition and prevention.',bn:'প্রাথমিক স্বাস্থ্যসেবা, পুষ্টি ও প্রতিরোধ।'},icon:'heart'},{title:{en:'Education',bn:'শিক্ষা'},body:{en:'Learning and skills for children, youth and adults.',bn:'শিশু, যুব ও প্রাপ্তবয়স্কদের শিক্ষা ও দক্ষতা।'},icon:'book'},{title:{en:'Livelihoods',bn:'জীবিকা'},body:{en:'Finance and skills that strengthen household income.',bn:'পরিবারের আয় শক্তিশালী করা অর্থায়ন ও দক্ষতা।'},icon:'coins'}]}]}
}

// Fill small, repeatable program/enterprise routes from the same data structure.
const autoPages: Record<string, PageData> = {}
const autoPrograms: [string,string,string,string,IconName][] = [
  ['/women-business-loan','Women Business Loans','নারী উদ্যোক্তা ঋণ','Support female-led enterprises with finance, mentoring and confidence-building.', 'coins'],
  ['/agri-development-loan','Agri Development Loan','কৃষি উন্নয়ন ঋণ','Improve farm productivity through appropriate finance and practices.', 'sun'],
  ['/rural-development-loan','Rural Development Loan','গ্রামীণ উন্নয়ন ঋণ','Finance community and household development in rural areas.', 'building'],
  ['/small-enterprise-loan','Small Enterprise Loan','ক্ষুদ্র উদ্যোক্তা ঋণ','Help small businesses invest, grow and create local jobs.', 'briefcase'],
  ['/household-migrant-loan','Household Migrant Loan','অভিবাসী পরিবার ঋণ','Support relocation and settlement expenses for migrant households.', 'users'],
  ['/job-holders-loan','Job Holders Loan','চাকরিজীবী ঋণ','Flexible financial support for personal and career needs.', 'coins'],
  ['/student-loan','Student Loan','শিক্ষার্থী ঋণ','Support education expenses and learning opportunities.', 'book'],
]
const autoLoanImages: Record<string,string> = { '/women-business-loan':images.loans.womenBusiness,'/agri-development-loan':images.loans.agriculture,'/rural-development-loan':images.loans.ruralDevelopment,'/small-enterprise-loan':images.loans.smallEnterprise,'/household-migrant-loan':images.loans.migrantHousehold,'/job-holders-loan':images.loans.jobHolders,'/student-loan':images.loans.student }
for (const [slug,en,bn,body,icon] of autoPrograms) autoPages[slug]={slug,title:{en,bn},subtitle:{en:'Program information, eligibility guidance and contact details.',bn:'কর্মসূচির তথ্য, যোগ্যতার নির্দেশনা ও যোগাযোগের বিবরণ।'},heroImage:autoLoanImages[slug] || images.general.community,sections:[{type:'richText',heading:{en,bn},body:[{en:body,bn:bn+' কর্মসূচির মাধ্যমে পরিবার ও ব্যক্তির আর্থিক ও উন্নয়নমূলক সক্ষমতা বাড়াতে সহায়তা করা হয়।'}],image:imageMedia(autoLoanImages[slug] || images.general.community,{en:'Program image',bn:'কর্মসূচির ছবি'})},{type:'cards',heading:{en:'Program Features',bn:'কর্মসূচির বৈশিষ্ট্য'},columns:3,items:[{title:{en:'Accessible Support',bn:'সহজলভ্য সহায়তা'},body:{en:'Designed around real needs and practical use.',bn:'বাস্তব প্রয়োজন ও ব্যবহারিক প্রয়োগকে কেন্দ্র করে।'},image:imageMedia(autoLoanImages[slug] || images.general.community,{en:'Accessible support',bn:'সহজলভ্য সহায়তার ছবি'}),href:slug},{title:{en:'Microfinance Context',bn:'ক্ষুদ্রঋণ প্রেক্ষাপট'},body:{en:'See how this loan fits into the wider microfinance program, savings and group structure.',bn:'এই ঋণ কীভাবে বৃহত্তর ক্ষুদ্রঋণ, সঞ্চয় ও গ্রুপ কাঠামোর সঙ্গে যুক্ত তা দেখুন।'},image:imageMedia(images.field.partnership,{en:'Microfinance program context',bn:'ক্ষুদ্রঋণ কর্মসূচির প্রেক্ষাপট'}),href:'/microfinance-program'},{title:{en:'Related Livelihoods',bn:'সম্পর্কিত জীবিকা'},body:{en:'Explore the social-development and livelihood pathways connected to financial support.',bn:'আর্থিক সহায়তার সঙ্গে যুক্ত সামাজিক উন্নয়ন ও জীবিকার পথগুলো দেখুন।'},image:imageMedia(images.field.livelihood,{en:'Livelihood pathway',bn:'জীবিকার পথ'}),href:'/social-development/agriculture-livelihood'}]},{type:'cards',heading:{en:'Loan Details',bn:'ঋণের বিস্তারিত'},columns:3,items:[{title:{en:'Purpose',bn:'উদ্দেশ্য'},body:{en:body,bn:bn+' পণ্যের নির্ধারিত উদ্দেশ্য পূরণে ব্যবহার করা হয়।'},icon:'check'},{title:{en:'Eligibility',bn:'যোগ্যতা'},body:{en:'Eligibility depends on the selected product, applicant profile, local verification and current institutional policy.',bn:'যোগ্যতা নির্বাচিত পণ্য, আবেদনকারীর প্রোফাইল, স্থানীয় যাচাই ও বর্তমান প্রাতিষ্ঠানিক নীতিমালার ওপর নির্ভর করে।'},icon:'users'},{title:{en:'Repayment',bn:'পরিশোধ'},body:{en:'Repayment frequency and duration are confirmed during approval and may vary by product.',bn:'অনুমোদনের সময় কিস্তির ঘনত্ব ও মেয়াদ নিশ্চিত করা হয় এবং পণ্যভেদে পরিবর্তিত হতে পারে।'},icon:'building'}]},{type:'table',heading:{en:'Terms & Conditions',bn:'শর্তাবলি'},headers:[{en:'Term',bn:'শর্ত'},{en:'What it means',bn:'বিবরণ'}],rows:[[{en:'Current loan amount',bn:'বর্তমান ঋণের পরিমাণ'},{en:'Approved limits depend on the selected product and current schedule; confirm the latest amount with the branch.',bn:'অনুমোদিত সীমা নির্বাচিত পণ্য ও বর্তমান সূচির ওপর নির্ভর করে; সর্বশেষ পরিমাণ শাখা থেকে নিশ্চিত করুন।'}],[{en:'Service charge / fees',bn:'সার্ভিস চার্জ / ফি'},{en:'Applicable charges follow the current approved schedule and should be confirmed before application.',bn:'প্রযোজ্য চার্জ বর্তমান অনুমোদিত সূচি অনুযায়ী; আবেদন করার আগে নিশ্চিত করতে হবে।'}],[{en:'Documents',bn:'কাগজপত্র'},{en:'Identity, address and product-specific supporting documents may be required; the branch provides the final checklist.',bn:'পরিচয়, ঠিকানা ও পণ্যভিত্তিক সহায়ক কাগজপত্র প্রয়োজন হতে পারে; চূড়ান্ত তালিকা শাখা দেবে।'}],[{en:'Membership & savings',bn:'সদস্যপদ ও সঞ্চয়'},{en:'Where applicable, the loan is linked to the microfinance program membership and savings process.',bn:'প্রযোজ্য ক্ষেত্রে ঋণটি ক্ষুদ্রঋণ কর্মসূচির সদস্যপদ ও সঞ্চয় প্রক্রিয়ার সঙ্গে যুক্ত থাকবে।'}],[{en:'Guarantor / security',bn:'গ্যারান্টর / নিরাপত্তা'},{en:'Any guarantor or security requirement depends on the product and current policy; confirm with the relevant office.',bn:'গ্যারান্টর বা নিরাপত্তার প্রয়োজন পণ্য ও বর্তমান নীতিমালার ওপর নির্ভর করে; সংশ্লিষ্ট অফিস থেকে নিশ্চিত করুন।'}]]},{type:'cta',heading:{en:'Need more information?',bn:'আরও তথ্য প্রয়োজন?'},body:{en:'Contact the organization for current eligibility, rates and application details.',bn:'বর্তমান যোগ্যতা, হার ও আবেদন সংক্রান্ত তথ্যের জন্য প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন।'},primary:{label:{en:'Contact Us',bn:'যোগাযোগ করুন'},href:'/contact'}}]}

// Detail pages are generated from editable content entries in the CMS.
const detailPages: Record<string, PageData> = Object.fromEntries(contentEntries.map(entry => {
  const prefix = entry.category === 'project' ? '/projects' : entry.category === 'news' ? '/news' : entry.category === 'notice' ? '/notice' : entry.category === 'career' ? '/carrer-job' : '/enterprise-development'
  return [`${prefix}/${entry.slug}`, { ...entryToPage(entry), contentSlug: entry.slug, contentComponent: entry.category === 'project' ? 'project' : entry.category === 'news' ? 'news' : entry.category === 'notice' ? 'notice' : entry.category === 'career' ? 'job' : 'enterprise' }]
}))

/** Canonicalize URL-valued data (not labels or media content) against the real menu hierarchy. */
function canonicalizeRouteReferences<T>(value: T): T {
  if (typeof value === 'string') return (value.startsWith('/') ? canonicalizeCmsRoute(value) : value) as T
  if (Array.isArray(value)) return value.map((item) => canonicalizeRouteReferences(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key.startsWith('/') ? canonicalizeCmsRoute(key) : key,
      canonicalizeRouteReferences(child),
    ])) as T
  }
  return value
}

// Keep the seed script and the public global export on the same hierarchical paths.
const normalizedPrimaryNav = canonicalizeRouteReferences(primaryNav) as NavItem[]
primaryNav.splice(0, primaryNav.length, ...normalizedPrimaryNav)
// No separate navigation groups are maintained.

const rawAllPages: Record<string, PageData> = { ...pages, ...autoPages, ...detailPages }
const navigationPaths = new Set<string>(['/'])
// Keep the bundled page catalogue aligned with the exact public menu tree used by
// lib/site.ts. Hidden legacy navigation entries (and their descendants) must not
// cause orphan pages to survive merely because their old seed definitions remain.
const excludedNavigationPaths = new Set([
  '/executive-secretariat', '/executive-secratariat', '/senior-management',
  '/public-relation', '/public-relations', '/public-relations-office', '/public-relations-unit',
  '/social-enterprise',
])
const excludedNavigationLabels = new Set([
  'executive secretariat', 'senior management', 'public relation', 'public relations', 'social enterprise',
  'নির্বাহী সচিবালয়', 'নির্বাহী সচিবালয়', 'সিনিয়র ম্যানেজমেন্ট', 'সিনিয়র ম্যানেজমেন্ট',
  'জনসংযোগ', 'সামাজিক উদ্যোগ',
])
const normalizeNavigationLabel = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')
function collectNavigationPaths(items: NavItem[], parentExcluded = false) {
  for (const item of items) {
    const rawPath = String(item.href || '').split(/[?#]/, 1)[0].replace(/\/+$/, '').toLocaleLowerCase() || '/'
    const isExcluded = parentExcluded
      || excludedNavigationPaths.has(rawPath)
      || excludedNavigationLabels.has(normalizeNavigationLabel(item.label?.en))
      || excludedNavigationLabels.has(normalizeNavigationLabel(item.label?.bn))
    if (!isExcluded && item.menuType !== 'external' && item.href.startsWith('/')) navigationPaths.add(canonicalizeCmsRoute(item.href))
    if (!isExcluded && Array.isArray(item.children)) collectNavigationPaths(item.children, false)
  }
}
collectNavigationPaths(primaryNav)

const normalizedPageMap = new Map<string, { page: PageData; canonicalSource: boolean }>()
for (const [rawSlug, rawPage] of Object.entries(rawAllPages)) {
  const slug = canonicalizeCmsRoute(rawSlug)
  const page = { ...(canonicalizeRouteReferences(rawPage) as PageData), slug }
  const isCanonicalSource = rawSlug === slug
  const existing = normalizedPageMap.get(slug)
  if (!existing) {
    normalizedPageMap.set(slug, { page, canonicalSource: isCanonicalSource })
    continue
  }
  // When old aliases converge on a real menu page (e.g. /loans -> /organizational-development),
  // retain the canonical page identity and merge unique sections instead of silently discarding
  // either page's editorial content.
  const preferred = isCanonicalSource && !existing.canonicalSource ? page : existing.page
  const secondary = preferred === page ? existing.page : page
  const sectionKey = (section: any) => `${String(section?.type || '')}:${String(section?.heading?.en || '')}:${String(section?.heading?.bn || '')}`
  const seen = new Set((preferred.sections || []).map(sectionKey))
  const mergedSections = [...(preferred.sections || []), ...(secondary.sections || []).filter((section: any) => {
    const key = sectionKey(section)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })]
  normalizedPageMap.set(slug, { page: { ...preferred, slug, sections: mergedSections }, canonicalSource: existing.canonicalSource || isCanonicalSource })
}
const allPages: Record<string, PageData> = Object.fromEntries(Array.from(normalizedPageMap.entries())
  .filter(([slug, entry]) => navigationPaths.has(slug) || (Boolean(entry.page.contentComponent) && navigationPaths.has(getContentRouteParent(slug))))
  .map(([slug, entry]) => [slug, entry.page]))


// Public grouped data sets.
const systemData = {
  images, themes, media, homeHero, ui, contactInfo, primaryNav, navGroups, imageForSlug,
  // Bootstrap/recovery defaults only. Administrators edit this document in the CMS.
  siteIdentity: {
    name: 'Srizony Foundation',
    alternateName: 'সৃজনী ফাউন্ডেশন',
    canonicalUrl: 'https://srizonyfoundation.org.bd',
    title: 'Srizony Foundation | Community Development in Bangladesh',
    description: 'Srizony Foundation works with marginalized communities in Bangladesh through health, education, livelihoods, microfinance, rights, climate resilience and social development.',
    keywords: ['Srizony Foundation', 'সৃজনী ফাউন্ডেশন', 'Bangladesh NGO', 'community development Bangladesh', 'education', 'health', 'livelihood'],
    foundingDate: '1985',
    logo: images.logo,
    ogImage: images.hero.feature,
  },
} as const

const contentData = {
  projectEntries, additionalProjectEntries, newsEntries, noticeEntries, careerEntries, enterpriseEntries, contentEntries, contentDetails, pages, autoPages, allPages,
} as const

// Grouped exports are the canonical data boundary; named exports are kept for the unchanged presentation components.
export { systemData, contentData }
export { images, imageForSlug, themes, media, homeHero, ui, contactInfo, primaryNav, navGroups }
export { allPages, pages, autoPages, contentEntries, projectEntries, additionalProjectEntries, newsEntries, noticeEntries, careerEntries, enterpriseEntries, contentDetails }

const SDGsteps:SDGStep[]=[
 {n:'1',en:'No Poverty',bn:'দারিদ্র্যমুক্তি',enText:'Microfinance and livelihood pathways reduce economic vulnerability and help families build income resilience.',bnText:'ক্ষুদ্রঋণ ও জীবিকা সহায়তা অর্থনৈতিক ঝুঁকি কমায় এবং পরিবারকে আয়ভিত্তিক সহনশীলতা গড়তে সহায়তা করে।',Icon:Coins},
 {n:'2',en:'Zero Hunger',bn:'ক্ষুধামুক্তি',enText:'Agriculture and food-security initiatives strengthen household food access and resilience.',bnText:'কৃষি ও খাদ্যনিরাপত্তা উদ্যোগ পরিবারের খাদ্যপ্রাপ্তি ও সহনশীলতা বাড়ায়।',Icon:Wheat},
 {n:'3',en:'Good Health',bn:'সুস্বাস্থ্য',enText:'Community health, nutrition and maternal-care activities improve access to essential services.',bnText:'কমিউনিটি স্বাস্থ্য, পুষ্টি ও মাতৃসেবা প্রয়োজনীয় সেবায় প্রবেশাধিকার বাড়ায়।',Icon:HeartPulse},
 {n:'4',en:'Quality Education',bn:'মানসম্মত শিক্ষা',enText:'Skills, vocational and non-formal learning create practical opportunities for marginalized groups.',bnText:'দক্ষতা, কারিগরি ও অনানুষ্ঠানিক শিক্ষা প্রান্তিক মানুষের জন্য ব্যবহারিক সুযোগ তৈরি করে।',Icon:GraduationCap},
 {n:'5',en:'Gender Equality',bn:'জেন্ডার সমতা',enText:'Women’s access to finance, skills and participation advances equal opportunity.',bnText:'নারীর অর্থায়ন, দক্ষতা ও অংশগ্রহণ সমঅধিকার ও সুযোগকে এগিয়ে নেয়।',Icon:HandHeart},
 {n:'6',en:'Clean Water',bn:'নিরাপদ পানি',enText:'Water, sanitation and hygiene activities support healthier and safer communities.',bnText:'পানি, স্যানিটেশন ও স্বাস্থ্যবিধি কার্যক্রম আরও সুস্থ ও নিরাপদ কমিউনিটি গড়ে।',Icon:Droplets},
 {n:'7',en:'Clean Energy',bn:'পরিচ্ছন্ন জ্বালানি',enText:'Solar-energy initiatives expand affordable clean-energy access for communities.',bnText:'সৌরশক্তি উদ্যোগ কমিউনিটির জন্য সাশ্রয়ী পরিচ্ছন্ন জ্বালানির সুযোগ বাড়ায়।',Icon:SunMedium},
 {n:'8',en:'Decent Work and Economic Growth',bn:'শোভন কর্মসংস্থান ও অর্থনৈতিক প্রবৃদ্ধি',enText:'Skills, enterprise support and livelihood pathways help people access productive work and build sustainable incomes.',bnText:'দক্ষতা, উদ্যোগ সহায়তা ও জীবিকা উন্নয়নের মাধ্যমে মানুষ উৎপাদনশীল কর্মসংস্থান ও টেকসই আয় গড়ার সুযোগ পায়।',Icon:BriefcaseBusiness},
]

export { SDGsteps }

export const donationInfo: PaymentInfo[] = [
  { id: 'cards', icon: CreditCard, en: 'Cards', bn: 'কার্ড', noteEn: 'Visa, Mastercard, Amex and other supported cards.', noteBn: 'Visa, Mastercard, Amex ও অন্যান্য সমর্থিত কার্ড।' },
  { id: 'bkash', icon: Smartphone, en: 'bKash', bn: 'বিকাশ', noteEn: 'Direct mobile-wallet channel through the gateway.', noteBn: 'গেটওয়ের মাধ্যমে মোবাইল ওয়ালেট চ্যানেল।' },
  { id: 'nagad', icon: Smartphone, en: 'Nagad', bn: 'নগদ', noteEn: 'Availability depends on your active gateway channels.', noteBn: 'সক্রিয় গেটওয়ে চ্যানেলের ওপর প্রাপ্যতা নির্ভর করে।' },
  { id: 'rocket', icon: Smartphone, en: 'Rocket', bn: 'রকেট', noteEn: 'Availability depends on your active gateway channels.', noteBn: 'সক্রিয় গেটওয়ে চ্যানেলের ওপর প্রাপ্যতা নির্ভর করে।' },
  { id: 'internet', icon: Landmark, en: 'Internet banking', bn: 'ইন্টারনেট ব্যাংকিং', noteEn: 'Available bank and internet-banking channels at checkout.', noteBn: 'সক্রিয় ব্যাংক ও ইন্টারনেট ব্যাংকিং চ্যানেল।' },
]
