/**
 * The only runtime bridge to bundled data/. This module is a recovery/bootstrap
 * source only: normal public rendering and CMS editing must read PostgreSQL.
 * Seed/migration scripts may also import these exports to copy legacy records.
 */
import {
  contentData,
  systemData,
  donationInfo,
  SDGsteps,
  images,
  homeHero,
  themes,
  media,
  ui,
  contactInfo,
  primaryNav,
  navGroups,
  allPages,
  contentEntries,
  imageForSlug,
  openImageUrlForPath,
} from '@/data/data'
import { contentDetails, validateContentDetailsDataset } from '@/data/contentDetails'
import { BRANCHES } from '@/data/branches'
import { HOME_HERO_COPY_DEFAULTS } from '@/data/homeHeroDefaults'
import { dedupeLandingSections, prepareHeroSlides } from '@/data/landingImages'

export const SITE_FALLBACKS = {
  contentData,
  systemData,
  donationInfo,
  SDGsteps,
  images,
  homeHero,
  themes,
  media,
  ui,
  contactInfo,
  primaryNav,
  navGroups,
  allPages,
  contentEntries,
  contentDetails,
  validateContentDetailsDataset,
  branches: BRANCHES,
  homeHeroCopy: HOME_HERO_COPY_DEFAULTS,
  imageForSlug,
  openImageUrlForPath,
  dedupeLandingSections,
  prepareHeroSlides,
} as const

export {
  contentData,
  systemData,
  donationInfo,
  SDGsteps,
  images,
  homeHero,
  themes,
  media,
  ui,
  contactInfo,
  primaryNav,
  navGroups,
  allPages,
  contentEntries,
  contentDetails,
  validateContentDetailsDataset,
  BRANCHES,
  HOME_HERO_COPY_DEFAULTS,
  imageForSlug,
  openImageUrlForPath,
  dedupeLandingSections,
  prepareHeroSlides,
}
