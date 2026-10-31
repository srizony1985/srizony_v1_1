import type { Bilingual } from '@/types/entityType'

/**
 * Legacy bootstrap/recovery copy for the office directory. Runtime display and editing
 * read the canonical Website Essentials record in PostgreSQL. Keep this file limited
 * to migration and first-run fallback use through lib/cms/fallback-gateway.ts.
 *
 * HOW TO COMPLETE THIS FILE
 *  - Each entry is one map pin. `lat` / `lng` place it on the map automatically.
 *  - Add the branch manager to `manager` to show their name and number in the hover card:
 *      manager: { name: { en: 'Md. Example Name', bn: 'মো. উদাহরণ নাম' }, phone: '+8801XXXXXXXXX' }
 *  - Until a manager phone is set, the card's Call button dials the head-office number
 *    (and says so), so the page never points at an invented number.
 *  - Coordinates below are district headquarters (approximate). Replace them with the exact
 *    branch location when you have it. The head office address and phone are read from the
 *    CMS contact info at runtime.
 */
export type BranchManager = {
  name?: Bilingual
  title?: Bilingual
  phone?: string
  email?: string
}

export type Branch = {
  id: string
  kind: 'head' | 'branch'
  name: Bilingual
  district: Bilingual
  division: Bilingual
  /** Street address. Omit to show "District, Division". */
  address?: Bilingual
  lat: number
  lng: number
  manager?: BranchManager
}

const DIVISION = {
  khulna: { en: 'Khulna Division', bn: 'খুলনা বিভাগ' },
  rajshahi: { en: 'Rajshahi Division', bn: 'রাজশাহী বিভাগ' },
  dhaka: { en: 'Dhaka Division', bn: 'ঢাকা বিভাগ' },
} as const

const branch = (
  id: string,
  en: string,
  bn: string,
  division: Bilingual,
  lat: number,
  lng: number,
): Branch => ({
  id,
  kind: 'branch',
  name: { en: `${en} Branch`, bn: `${bn} শাখা` },
  district: { en, bn },
  division,
  lat,
  lng,
})

export const BRANCHES: Branch[] = [
  {
    id: 'head-office',
    kind: 'head',
    name: { en: 'Head Office — Srizony Bhaban', bn: 'প্রধান কার্যালয় — সৃজনী ভবন' },
    district: { en: 'Jhenaidah', bn: 'ঝিনাইদহ' },
    division: DIVISION.khulna,
    lat: 23.5448,
    lng: 89.1726,
  },
  branch('kushtia', 'Kushtia', 'কুষ্টিয়া', DIVISION.khulna, 23.9013, 89.1205),
  branch('pabna', 'Pabna', 'পাবনা', DIVISION.rajshahi, 24.0064, 89.2372),
  branch('chuadanga', 'Chuadanga', 'চুয়াডাঙ্গা', DIVISION.khulna, 23.6402, 88.8418),
  branch('meherpur', 'Meherpur', 'মেহেরপুর', DIVISION.khulna, 23.7622, 88.6318),
  branch('jashore', 'Jashore', 'যশোর', DIVISION.khulna, 23.1665, 89.2081),
  branch('satkhira', 'Satkhira', 'সাতক্ষীরা', DIVISION.khulna, 22.7185, 89.0705),
  branch('khulna', 'Khulna', 'খুলনা', DIVISION.khulna, 22.8456, 89.5403),
  branch('narail', 'Narail', 'নড়াইল', DIVISION.khulna, 23.1725, 89.5126),
  branch('magura', 'Magura', 'মাগুরা', DIVISION.khulna, 23.4873, 89.4199),
  branch('faridpur', 'Faridpur', 'ফরিদপুর', DIVISION.dhaka, 23.607, 89.8429),
  branch('rajbari', 'Rajbari', 'রাজবাড়ী', DIVISION.dhaka, 23.7574, 89.6445),
  branch('manikganj', 'Manikganj', 'মানিকগঞ্জ', DIVISION.dhaka, 23.8617, 90.0003),
  branch('dhaka', 'Dhaka', 'ঢাকা', DIVISION.dhaka, 23.8103, 90.4125),
]
