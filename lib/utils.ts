import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return (clsx(inputs))
}

export function localizeDigits(value: string | number, lang: 'en' | 'bn') {
  const text = String(value)
  if (lang !== 'bn') return text
  const map: Record<string, string> = { '0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯' }
  return text.replace(/[0-9]/g, d => map[d])
}

export function localizeText(value: string, lang: 'en' | 'bn') {
  return localizeDigits(value, lang)
}
