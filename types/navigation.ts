import type { CmsTypography } from '@/types/entityType'

export type MenuType = 'page' | 'external' | 'folder'
export type SectionButtonType = 'none' | 'primary' | 'secondary' | 'both'

export type NavigationMenuWriteInput = {
  groupKey: string
  parentId: number | null
  labelEn: string
  labelBn: string
  slug: string
  renderedComponents: string[]
  menuType?: MenuType
  sectionCount?: number
  sectionContentType?: string
  sectionButtonType?: SectionButtonType
  typography?: CmsTypography
}

export type NavigationMenuUpdateInput = Omit<NavigationMenuWriteInput, 'groupKey' | 'parentId'>

/** Recursive payload accepted by the navigation reorder endpoint. */
export type NavigationMoveNode = { id: number; children?: NavigationMoveNode[] }
