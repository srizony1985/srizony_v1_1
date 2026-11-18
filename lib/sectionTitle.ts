/**
 * Removes decorative emoji from CMS-driven section headings at render time.
 * The persisted CMS content is left untouched so editors do not lose source data.
 */
export function plainSectionTitle(value: string | null | undefined): string {
  if (!value) return ''

  return String(value)
    .replace(/[#*0-9]\uFE0F?\u20E3/gu, '')
    .replace(/\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?)*/gu, '')
    .replace(/[\u200D\uFE0E\uFE0F]/gu, '')
    .replace(/[\t\n\r ]{2,}/g, ' ')
    .trim()
}
