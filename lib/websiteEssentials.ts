import type { Branch } from '@/types/branch'

export type OfficialSocials = {
  facebook: string
  instagram: string
  youtube: string
  linkedin: string
}

export type PublishedDocument = {
  titleEn: string
  titleBn: string
  url: string
}

export type ManagementStaffMember = {
  id: string
  nameEn: string
  nameBn: string
  designationEn: string
  designationBn: string
  bioEn?: string
  bioBn?: string
  photoUrl?: string
  published: boolean
  sortOrder: number
}

export type WebsiteEssentials = {
  socials: OfficialSocials
  documents: {
    staffListPdf: PublishedDocument
    locationsPdf: PublishedDocument
  }
  staff: ManagementStaffMember[]
  locations: Branch[]
}

export const DEFAULT_WEBSITE_ESSENTIALS: WebsiteEssentials = {
  socials: {
    facebook: '',
    instagram: '',
    youtube: '',
    linkedin: 'https://bd.linkedin.com/company/srizonyfoundation',
  },
  documents: {
    staffListPdf: { titleEn: 'Staff List', titleBn: 'কর্মকর্তা-কর্মচারীর তালিকা', url: '' },
    locationsPdf: { titleEn: 'Working Locations & Branch Offices', titleBn: 'কার্যক্রমের স্থান ও শাখা কার্যালয়', url: '' },
  },
  // Staff names and employment details are intentionally empty until approved records are supplied.
  staff: [],
  // Empty is the signal for the public map to use the project's existing branch directory.
  locations: [],
}

export function normalizeWebsiteEssentials(value: unknown): WebsiteEssentials {
  if (!value || typeof value !== 'object') return DEFAULT_WEBSITE_ESSENTIALS
  const data = value as Partial<WebsiteEssentials>
  const socials: Partial<OfficialSocials> = data.socials ?? {}
  const documents: Partial<WebsiteEssentials['documents']> = data.documents ?? {}
  const staffListPdf = documents.staffListPdf ?? DEFAULT_WEBSITE_ESSENTIALS.documents.staffListPdf
  const locationsPdf = documents.locationsPdf ?? DEFAULT_WEBSITE_ESSENTIALS.documents.locationsPdf
  return {
    socials: {
      facebook: typeof socials.facebook === 'string' ? socials.facebook : '',
      instagram: typeof socials.instagram === 'string' ? socials.instagram : '',
      youtube: typeof socials.youtube === 'string' ? socials.youtube : '',
      linkedin: typeof socials.linkedin === 'string' ? socials.linkedin : DEFAULT_WEBSITE_ESSENTIALS.socials.linkedin,
    },
    documents: {
      staffListPdf: {
        titleEn: typeof staffListPdf.titleEn === 'string' ? staffListPdf.titleEn : 'Staff List',
        titleBn: typeof staffListPdf.titleBn === 'string' ? staffListPdf.titleBn : 'কর্মকর্তা-কর্মচারীর তালিকা',
        url: typeof staffListPdf.url === 'string' ? staffListPdf.url : '',
      },
      locationsPdf: {
        titleEn: typeof locationsPdf.titleEn === 'string' ? locationsPdf.titleEn : 'Working Locations & Branch Offices',
        titleBn: typeof locationsPdf.titleBn === 'string' ? locationsPdf.titleBn : 'কার্যক্রমের স্থান ও শাখা কার্যালয়',
        url: typeof locationsPdf.url === 'string' ? locationsPdf.url : '',
      },
    },
    staff: Array.isArray(data.staff) ? data.staff.filter((item) => item && typeof item.id === 'string').map((item) => ({
      id: String(item.id), nameEn: String(item.nameEn ?? ''), nameBn: String(item.nameBn ?? ''),
      designationEn: String(item.designationEn ?? ''), designationBn: String(item.designationBn ?? ''),
      bioEn: String(item.bioEn ?? ''), bioBn: String(item.bioBn ?? ''), photoUrl: String(item.photoUrl ?? ''),
      published: item.published !== false, sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
    })) : [],
    locations: Array.isArray(data.locations) ? data.locations.filter((item) => item && typeof item.id === 'string' && item.name && item.district && item.division && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))).map((item) => ({
      ...item,
      name: { en: String(item.name?.en ?? ''), bn: String(item.name?.bn ?? item.name?.en ?? '') },
      district: { en: String(item.district?.en ?? ''), bn: String(item.district?.bn ?? item.district?.en ?? '') },
      division: { en: String(item.division?.en ?? ''), bn: String(item.division?.bn ?? item.division?.en ?? '') },
      address: item.address ? { en: String(item.address.en ?? ''), bn: String(item.address.bn ?? item.address.en ?? '') } : undefined,
      lat: Number(item.lat), lng: Number(item.lng), kind: item.kind === 'head' ? 'head' : 'branch',
      manager: item.manager && typeof item.manager === 'object' ? {
        ...(item.manager.name ? { name: { en: String(item.manager.name.en ?? ''), bn: String(item.manager.name.bn ?? item.manager.name.en ?? '') } } : {}),
        ...(item.manager.title ? { title: { en: String(item.manager.title.en ?? ''), bn: String(item.manager.title.bn ?? item.manager.title.en ?? '') } } : {}),
        ...(typeof item.manager.phone === 'string' && item.manager.phone.trim() ? { phone: item.manager.phone.trim() } : {}),
        ...(typeof item.manager.email === 'string' && item.manager.email.trim() ? { email: item.manager.email.trim() } : {}),
      } : undefined,
    })) as Branch[] : [],
  }
}

export function isSafePublicUrl(value: string, allowRelative = true) {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) return true
  try { return new URL(trimmed).protocol === 'https:' } catch { return false }
}
