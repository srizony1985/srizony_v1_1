import type { Bilingual } from '@/types/entityType'
import { poolUrl } from '@/data/landingImages'

/**
 * Bilingual copy for the illustration-first landing page. Deliberately short:
 * the animated visuals carry the meaning, the text only labels them.
 */

/* ── Mission → Vision → Values scroll story ── */
export type StoryStep = {
  id: 'mission' | 'vision' | 'values'
  kicker: Bilingual
  body: Bilingual
  chips: Bilingual[]
}

export const STORY_INTRO = {
  eyebrow: { en: 'Who We Are', bn: 'আমরা যারা' } as Bilingual,
  title: { en: 'Mission, Vision & Values', bn: 'মিশন, ভিশন ও মূল্যবোধ' } as Bilingual,
  hint: { en: 'Keep scrolling', bn: 'স্ক্রল করুন' } as Bilingual,
}

export const STORY: StoryStep[] = [
  {
    id: 'mission',
    kicker: { en: 'Our Mission', bn: 'আমাদের মিশন' },
    body: {
      en: 'Create an enabling environment for poverty reduction, socio-economic development and human rights.',
      bn: 'দারিদ্র্য বিমোচন, আর্থ-সামাজিক উন্নয়ন ও মানবাধিকার প্রতিষ্ঠায় সহায়ক পরিবেশ তৈরি করা।',
    },
    chips: [
      { en: 'Poverty reduction', bn: 'দারিদ্র্য বিমোচন' },
      { en: 'Socio-economic development', bn: 'আর্থ-সামাজিক উন্নয়ন' },
      { en: 'Human rights', bn: 'মানবাধিকার' },
    ],
  },
  {
    id: 'vision',
    kicker: { en: 'Our Vision', bn: 'আমাদের ভিশন' },
    // DRAFT: the CMS has no vision statement. Replace with the approved wording.
    body: {
      en: 'A Bangladesh where every person, especially the poor and marginalised, lives with dignity, opportunity and rights.',
      bn: 'এমন একটি বাংলাদেশ, যেখানে প্রত্যেক মানুষ, বিশেষ করে দরিদ্র ও প্রান্তিক জনগোষ্ঠী, মর্যাদা, সুযোগ ও অধিকারসহ বাঁচতে পারে।',
    },
    chips: [
      { en: 'Dignity', bn: 'মর্যাদা' },
      { en: 'Opportunity', bn: 'সুযোগ' },
      { en: 'Rights', bn: 'অধিকার' },
    ],
  },
  {
    id: 'values',
    kicker: { en: 'Our Values', bn: 'আমাদের মূল্যবোধ' },
    body: {
      en: 'Accountability and fairness: abiding by rules and policies in everything we do.',
      bn: 'জবাবদিহিতা ও ন্যায়পরায়ণতা: প্রতিটি কাজে নীতি ও নিয়ম মেনে চলা।',
    },
    chips: [
      { en: 'Accountability', bn: 'জবাবদিহিতা' },
      { en: 'Fairness', bn: 'ন্যায়পরায়ণতা' },
    ],
  },
]

/* ── Footprint ── */
export const FOOTPRINT_INTRO = {
  eyebrow: { en: 'National Footprint', bn: 'জাতীয় বিস্তৃতি' } as Bilingual,
  title: { en: 'Our offices across Bangladesh', bn: 'সারা বাংলাদেশে আমাদের কার্যালয়' } as Bilingual,
  lead: {
    en: 'Select a pin or branch to view its location and contact details.',
    bn: 'শাখার অবস্থান ও যোগাযোগের তথ্য দেখতে পিন বা শাখা নির্বাচন করুন।',
  } as Bilingual,
}

/* ── Development areas ── */
export type AreaCard = {
  href: string
  icon: 'heart' | 'book' | 'users' | 'coins' | 'sprout' | 'store'
  title: Bilingual
  body: Bilingual
  image: string
  imageAlt?: Bilingual
  chips?: Bilingual[]
}

export const AREAS_INTRO = {
  eyebrow: { en: 'What We Do', bn: 'আমাদের কার্যক্রম' } as Bilingual,
  title: { en: 'Integrated Development Areas', bn: 'সমন্বিত উন্নয়ন ক্ষেত্র' } as Bilingual,
}

export const AREAS: AreaCard[] = [
  { href: '/social-development/health-program', icon: 'heart', image: poolUrl('clinic'), title: { en: 'Health & Nutrition', bn: 'স্বাস্থ্য ও পুষ্টি' }, body: { en: 'Primary healthcare and nutrition for communities.', bn: 'কমিউনিটির জন্য প্রাথমিক স্বাস্থ্যসেবা ও পুষ্টি।' } },
  { href: '/social-development', icon: 'users', image: poolUrl('communityAction'), title: { en: 'Social Development', bn: 'সামাজিক উন্নয়ন' }, body: { en: 'Rights, inclusion and community leadership.', bn: 'অধিকার, অন্তর্ভুক্তি ও কমিউনিটি নেতৃত্ব।' } },
  { href: '/microfinance-program', icon: 'coins', image: poolUrl('sewing'), title: { en: 'Microfinance & Loans', bn: 'ক্ষুদ্রঋণ ও ঋণ সেবা' }, body: { en: 'Savings and loans built around livelihoods.', bn: 'জীবিকাকেন্দ্রিক সঞ্চয় ও ঋণসেবা।' } },
  { href: '/social-development/agriculture-livelihood', icon: 'sprout', image: poolUrl('agriculture'), title: { en: 'Agriculture & Livelihood', bn: 'কৃষি ও জীবিকা' }, body: { en: 'Climate-aware farming and rural income.', bn: 'জলবায়ু-সচেতন কৃষি ও গ্রামীণ আয়।' } },
  { href: '/enterprise-development', icon: 'store', image: poolUrl('localMarket'), title: { en: 'Enterprise Development', bn: 'এন্টারপ্রাইজ উন্নয়ন' }, body: { en: 'Social enterprises linking people to markets.', bn: 'মানুষকে বাজারের সঙ্গে যুক্ত করা সামাজিক উদ্যোগ।' } },
  { href: '/social-development/education-program', icon: 'book', image: poolUrl('localSchool'), title: { en: 'Education & Skills', bn: 'শিক্ষা ও দক্ষতা' }, body: { en: 'Learning and practical skills for young people.', bn: 'তরুণদের জন্য শিক্ষা ও ব্যবহারিক দক্ষতা।' } },
]

export const STORIES_INTRO = {
  eyebrow: { en: 'Impact', bn: 'প্রভাব' } as Bilingual,
  title: { en: 'Success Story of Srizony', bn: 'সৃজনীর সফলতার গল্প' } as Bilingual,
  all: { en: 'All stories', bn: 'সব গল্প' } as Bilingual,
  prev: { en: 'Previous stories', bn: 'আগের গল্প' } as Bilingual,
  next: { en: 'Next stories', bn: 'পরের গল্প' } as Bilingual,
}

/* ── Growth + counters ── */
export type Counter = {
  id: string
  icon: 'users' | 'briefcase' | 'home' | 'building'
  value: number
  label: Bilingual
}

export const GROWTH_INTRO = {
  eyebrow: { en: 'Since 1985', bn: '১৯৮৫ সাল থেকে' } as Bilingual,
  title: { en: 'Growing together', bn: 'একসাথে এগিয়ে চলা' } as Bilingual,
  about: { en: 'About us', bn: 'আমাদের সম্পর্কে' } as Bilingual,
}

export const COUNTERS: Counter[] = [
  { id: 'members', icon: 'users', value: 69753, label: { en: 'Members', bn: 'সদস্য' } },
  { id: 'staff', icon: 'briefcase', value: 2540, label: { en: 'Staff', bn: 'কর্মী' } },
  { id: 'villages', icon: 'home', value: 1898, label: { en: 'Villages', bn: 'গ্রাম' } },
  { id: 'branches', icon: 'building', value: 80, label: { en: 'Branch offices', bn: 'শাখা অফিস' } },
]
