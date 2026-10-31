import type { IconType } from 'react-icons'
import { SiFacebook, SiInstagram, SiYoutube } from 'react-icons/si'
import { FaLinkedin } from 'react-icons/fa'
import type { OfficialSocials } from '@/lib/websiteEssentials'
import type { Lang } from '@/types/entityType'

const NETWORKS: Record<keyof OfficialSocials, { Icon: IconType; en: string; bn: string }> = {
  facebook: { Icon: SiFacebook, en: 'Facebook', bn: 'ফেসবুক' },
  instagram: { Icon: SiInstagram, en: 'Instagram', bn: 'ইনস্টাগ্রাম' },
  youtube: { Icon: SiYoutube, en: 'YouTube', bn: 'ইউটিউব' },
  linkedin: { Icon: FaLinkedin, en: 'LinkedIn', bn: 'লিংকডইন' },
}

const configured = (socials: Partial<OfficialSocials>) => (Object.keys(NETWORKS) as (keyof OfficialSocials)[]).filter((key) => /^https:\/\//i.test(socials[key]?.trim() ?? ''))
export const hasSocials = (socials: Partial<OfficialSocials>) => configured(socials).length > 0

/** Icon links for every configured https social profile; renders nothing when none are set. */
export default function SocialLinks({ socials, lang, className, size = 15 }: { socials: Partial<OfficialSocials>; lang: Lang; className?: string; size?: number }) {
  const links = configured(socials)
  if (!links.length) return null
  return <div className={className}>{links.map((key) => {
    const { Icon, ...names } = NETWORKS[key]
    return <a key={key} href={socials[key]!.trim()} target="_blank" rel="noopener noreferrer" aria-label={names[lang]} title={names[lang]}><Icon size={size} aria-hidden="true" /></a>
  })}</div>
}
