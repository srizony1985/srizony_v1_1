'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Building2, Compass, Mail, MapPin, Navigation, Phone, Search, User, X } from 'lucide-react'
import type { Branch } from '@/types/branch'
import { MAP_H, MAP_W, OUTLINE_COORDS, OUTLINE_PATH, project } from '@/lib/bangladeshMap'
import { localizeDigits } from '@/lib/utils'
import type { Lang, PageData } from '@/types/entityType'
import { useSite } from '@/components/containers/SiteProvider'
import LogoLoader from '@/components/ui/LogoLoader'
import Reveal from '@/components/containers/Reveal'
import SectionActions from '@/components/ui/SectionActions'
import { useWebsiteEssentials } from '@/components/hooks/useWebsiteEssentials'

/* ───────────── Leaflet loader (CDN, so no extra npm dependency) ───────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    L?: any
  }
}
const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist'
const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ?? ''
// Simplified GeoBoundaries BGD ADM2/ADM0 data is fetched through our same-origin cached API.
// The local SVG outline remains the offline fallback.
let leafletPromise: Promise<any> | null = null

function loadLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `${LEAFLET}/leaflet.css`
    css.crossOrigin = ''
    document.head.appendChild(css)
    const script = document.createElement('script')
    script.src = `${LEAFLET}/leaflet.js`
    script.crossOrigin = ''
    script.async = true
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet missing')))
    script.onerror = () => {
      leafletPromise = null
      reject(new Error('Leaflet failed to load'))
    }
    document.head.appendChild(script)
  })
  return leafletPromise
}

const BD_BOUNDS: [[number, number], [number, number]] = [[20.55, 87.95], [26.7, 92.8]]
const tileUrl = (dark: boolean) =>
  `https://api.maptiler.com/maps/${dark ? 'base-v4-dark' : 'base-v4-light'}/{z}/{x}/{y}.png?key=${encodeURIComponent(MAPTILER_API_KEY)}`
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor'

/* ───────────── Data helpers ───────────── */

type ContactLite = { primaryPhone?: string; address?: { en: string; bn: string } }

type Resolved = {
  branch: Branch
  vx: number
  vy: number
  name: string
  district: string
  location: string
  managerName: string | null
  managerTitle: string
  phone: string
  ownPhone: boolean
  email?: string
  mapUrl: string
  searchText: string
}

type GeoPosition = [number, number, ...number[]]
type GeoPolygon = GeoPosition[][]
type GeoGeometry =
  | { type: 'Polygon'; coordinates: GeoPolygon }
  | { type: 'MultiPolygon'; coordinates: GeoPolygon[] }
type MapFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: GeoGeometry }
type FeatureCollection = { type: 'FeatureCollection'; features: MapFeature[] }

const normalizeDistrictName = (value: unknown) => {
  const name = String(value ?? '').toLowerCase().replace(/\bdistrict\b|\bzila\b|\bzilla\b/g, '').replace(/[^a-z]/g, '')
  const aliases: Record<string, string> = {
    jessore: 'jashore',
    chittagong: 'chattogram',
    comilla: 'cumilla',
    bogra: 'bogura',
    barisal: 'barishal',
  }
  return aliases[name] ?? name
}

const featureDistrictName = (feature: MapFeature) =>
  String(feature.properties.shapeName ?? feature.properties.ADM2_EN ?? feature.properties.NAME_2 ?? feature.properties.name ?? '')

const DISTRICT_COLORS = {
  light: ['#72c7c4', '#f6bd60', '#a8dadc', '#cdb4db', '#f4a7a0', '#b8d99b', '#91b9e8', '#f2a65a'],
  dark: ['#168b8b', '#9b6b1d', '#286b75', '#73508e', '#9f4f52', '#4a7837', '#355f9c', '#9b5821'],
} as const

function districtPaletteIndex(name: string): number {
  const normalized = normalizeDistrictName(name) || name.trim().toLowerCase()
  let hash = 2166136261
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % DISTRICT_COLORS.light.length
}

/** Stable district colours shared by the SVG fallback and interactive Leaflet map. */
function districtPaletteFill(name: string): string {
  return `var(--sf-fp-district-${districtPaletteIndex(name) + 1})`
}

function geoFeaturePath(feature: MapFeature): string {
  const polygons: GeoPolygon[] = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.type === 'MultiPolygon'
      ? feature.geometry.coordinates
      : []

  return polygons.flatMap((polygon) => polygon.map((ring) => {
    if (!ring.length) return ''
    const commands = ring.map(([lng, lat], index) => {
      const point = project(lng, lat)
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    })
    return `${commands.join(' ')} Z`
  })).filter(Boolean).join(' ')
}

function parseFeatureCollection(value: unknown): MapFeature[] {
  if (!value || typeof value !== 'object') return []
  const collection = value as Partial<FeatureCollection>
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) return []
  return collection.features.filter((feature): feature is MapFeature =>
    Boolean(feature && feature.type === 'Feature' && feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'))
  )
}

type SvgViewport = { x: number; y: number; width: number; height: number }
const COUNTRY_SVG_VIEW: SvgViewport = { x: 0, y: 0, width: MAP_W, height: MAP_H }

function projectedFeatureBounds(feature: MapFeature): SvgViewport | null {
  const polygons: GeoPolygon[] = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.type === 'MultiPolygon'
      ? feature.geometry.coordinates
      : []
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        const point = project(lng, lat)
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || maxX <= minX || maxY <= minY) return null
  const padX = Math.max((maxX - minX) * 0.20, 14)
  const padY = Math.max((maxY - minY) * 0.20, 14)
  return { x: minX - padX, y: minY - padY, width: maxX - minX + padX * 2, height: maxY - minY + padY * 2 }
}

const dial = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function resolve(branch: Branch, lang: Lang, contact: ContactLite): Resolved {
  const t = (v?: { en: string; bn: string }) => v?.[lang] ?? ''
  const pos = project(branch.lng, branch.lat)
  const isHead = branch.kind === 'head'
  const district = t(branch.district)
  const fallbackLoc = `${district}, ${t(branch.division)}`
  const location = isHead ? t(branch.address) || t(contact.address) || fallbackLoc : t(branch.address) || fallbackLoc
  const mapQuery = branch.address?.en?.trim() || branch.address?.bn?.trim() || (isHead && (contact.address?.en?.trim() || contact.address?.bn?.trim())) || `${branch.name.en || branch.name.bn}, ${branch.district.en || branch.district.bn}, Bangladesh`
  return {
    branch,
    vx: pos.x,
    vy: pos.y,
    name: t(branch.name),
    district,
    location,
    managerName: branch.manager?.name ? t(branch.manager.name) : null,
    managerTitle: branch.manager?.title ? t(branch.manager.title) : lang === 'en' ? 'Branch Manager' : 'শাখা ব্যবস্থাপক',
    phone: branch.manager?.phone || contact.primaryPhone || '',
    ownPhone: isHead || Boolean(branch.manager?.phone),
    email: branch.manager?.email,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
    searchText: [branch.name.en, branch.name.bn, branch.district.en, branch.district.bn, branch.division.en, branch.division.bn, branch.address?.en, branch.address?.bn, branch.manager?.name?.en, branch.manager?.name?.bn, branch.manager?.phone, branch.manager?.email].filter(Boolean).join(' ').toLowerCase(),
  }
}

/** Contact details for the single selected-location details panel. */
function BranchDetail({ r, lang, onClose }: { r: Resolved; lang: Lang; onClose?: () => void }) {
  const tr = (en: string, bn: string) => (lang === 'en' ? en : bn)
  const isHead = r.branch.kind === 'head'
  const callLabel = isHead || !r.ownPhone ? tr('Call head office', 'প্রধান কার্যালয়ে কল করুন') : tr('Call manager', 'ব্যবস্থাপককে কল করুন')

  return (
    <div className="sf-fp-card-inner">
      <div className="sf-fp-card-top">
        <span className={`sf-fp-card-icon ${isHead ? 'is-head' : ''}`} aria-hidden="true"><Building2 size={18} /></span>
        <div className="sf-fp-card-title">
          <strong>{r.name}</strong>
          <span className="sf-chip">{isHead ? tr('Head office', 'প্রধান কার্যালয়') : tr('Branch office', 'শাখা অফিস')}</span>
        </div>
        {onClose && (
          <button type="button" className="sf-icon-btn" onClick={onClose} aria-label={tr('Close details', 'বিস্তারিত বন্ধ করুন')}>
            <X size={16} />
          </button>
        )}
      </div>

      <dl className="sf-fp-rows">
        <div className="sf-fp-row">
          <dt><MapPin size={15} aria-hidden="true" /><span className="sf-sr">{tr('Location', 'অবস্থান')}</span></dt>
          <dd>
            {r.location}
            <a className="sf-fp-maplink" href={r.mapUrl} target="_blank" rel="noopener noreferrer">
              <Navigation size={12} aria-hidden="true" /> {tr('Directions', 'দিকনির্দেশ')}
            </a>
          </dd>
        </div>

        {!isHead && (
          <div className="sf-fp-row">
            <dt><User size={15} aria-hidden="true" /><span className="sf-sr">{tr('Branch manager', 'শাখা ব্যবস্থাপক')}</span></dt>
            <dd>
              {r.managerName ? (
                <>
                  <strong>{r.managerName}</strong>
                  <span className="sf-muted"> · {r.managerTitle}</span>
                </>
              ) : (
                <>
                  <strong>{r.managerTitle}</strong>
                  {!r.ownPhone && (
                    <span className="sf-muted sf-block">
                      {tr('Direct number not published yet. Calls go to the head office.', 'সরাসরি নম্বর এখনও প্রকাশিত হয়নি। কল প্রধান কার্যালয়ে যাবে।')}
                    </span>
                  )}
                </>
              )}
            </dd>
          </div>
        )}

        {r.phone && (
          <div className="sf-fp-row">
            <dt><Phone size={15} aria-hidden="true" /><span className="sf-sr">{tr('Phone', 'ফোন')}</span></dt>
            <dd><a href={dial(r.phone)} className="sf-fp-phone">{localizeDigits(r.phone, lang)}</a></dd>
          </div>
        )}
      </dl>

      <div className="sf-fp-actions">
        {r.phone && (
          <a className="sf-btn sf-btn--primary sf-btn--block" href={dial(r.phone)}>
            <Phone size={16} aria-hidden="true" /> {callLabel}
          </a>
        )}
        {r.email && (
          <a className="sf-btn sf-btn--ghost" href={`mailto:${r.email}`} aria-label={tr('Email branch', 'শাখায় ইমেইল করুন')}>
            <Mail size={16} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}

/* ───────────── Component ───────────── */

type FootprintCopySection = Extract<PageData['sections'][number], { type: 'richText' }>
const normalizeFootprintHeading = (value?: string) => (value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')

export default function LocationMaps({ page, variant = 'default' }: { page: PageData; variant?: 'default' | 'contact' }) {
  const { lang, site, mode: colorMode, theme } = useSite()
  const tr = (en: string, bn: string) => (lang === 'en' ? en : bn)
  const contact: ContactLite = site?.global?.contactInfo ?? {}
  const footprintCopy = page.sections.find((section): section is FootprintCopySection => section.type === 'richText' && (section.homeComponent === 'locations' || normalizeFootprintHeading(section.heading?.en) === 'our offices across bangladesh'))
  const footprintEyebrow = variant === 'contact'
    ? { en: 'Contact & locations', bn: 'যোগাযোগ ও অবস্থান' }
    : footprintCopy?.eyebrow
  const footprintTitle = variant === 'contact'
    ? { en: 'Find a Srizony office', bn: 'সৃজনীর অফিস খুঁজুন' }
    : footprintCopy?.heading
  const footprintParagraphs = footprintCopy?.body?.filter((paragraph) => paragraph.en?.trim() || paragraph.bn?.trim()) ?? []
  // An explicitly saved empty body is a valid CMS choice; only use defaults when no
  // section document is present, not when the editor intentionally clears the copy.
  const footprintLead = variant === 'contact'
    ? { en: 'Search offices by district or branch, select a location to view contact details, and open directions in Maps.', bn: 'জেলা বা শাখা দিয়ে অফিস খুঁজুন, যোগাযোগের তথ্য দেখতে একটি অবস্থান নির্বাচন করুন এবং ম্যাপে যাওয়ার নির্দেশনা খুলুন।' }
    : footprintCopy
      ? { en: footprintParagraphs.map((paragraph) => paragraph.en).filter(Boolean).join(' '), bn: footprintParagraphs.map((paragraph) => paragraph.bn).filter(Boolean).join(' ') }
      : { en: '', bn: '' }

  const [query, setQuery] = useState('')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'loading' | 'map' | 'svg'>('loading')
  const [size, setSize] = useState({ w: 560, h: 560 })
  const [districtFeatures, setDistrictFeatures] = useState<MapFeature[]>([])
  const [countryFeature, setCountryFeature] = useState<MapFeature | null>(null)
  const [, setTick] = useState(0)
  const hoverTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const leafletEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const tileRef = useRef<any>(null)
  const circlesRef = useRef<any>(null)
  const fitRef = useRef<any>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const [wantMap, setWantMap] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  const branchDirectory = useWebsiteEssentials().essentials.locations
  const all = useMemo(() => branchDirectory.map((b) => resolve(b, lang, contact)), [branchDirectory, lang, contact.primaryPhone, contact.address?.en, contact.address?.bn]) // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? all.filter((r) => r.searchText.includes(q)) : all
  }, [all, query])

  // Details are click/tap-selected only; hover is a delayed visual hint, never a popup.
  const activeId = pinnedId
  const active = all.find((r) => r.branch.id === activeId) ?? null

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)')
    const update = () => setIsMobileViewport(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const svgViewport = useMemo<SvgViewport>(() => {
    if (!active || !districtFeatures.length) return COUNTRY_SVG_VIEW
    const name = normalizeDistrictName(active.branch.district.en)
    const feature = districtFeatures.find((item) => normalizeDistrictName(featureDistrictName(item)) === name)
    return feature ? projectedFeatureBounds(feature) ?? COUNTRY_SVG_VIEW : COUNTRY_SVG_VIEW
  }, [isMobileViewport, activeId, active, districtFeatures])

  /* Delayed hover bookkeeping keeps map pins and the location rail from popping rapidly. */
  const clearTimer = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    hoverTimer.current = null
    closeTimer.current = null
  }
  const openHover = (id: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    hoverTimer.current = window.setTimeout(() => {
      setHoverId(id)
      hoverTimer.current = null
    }, 360)
  }
  const scheduleClose = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setHoverId(null)
      closeTimer.current = null
    }, 480)
  }
  useEffect(() => clearTimer, [])
  const togglePin = (id: string) => setPinnedId((cur) => (cur === id ? null : id))

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('[data-fp-keep]')) setPinnedId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedId(null)
        setHoverId(null)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  /* container size (pins are positioned in pixels for both map and fallback) */
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
      mapRef.current?.invalidateSize()
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Hand scrolling back to the document when the nested location rail reaches either edge.
     This explicit handoff covers mobile Safari, where nested overflow lists can trap swipes. */
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    let previousTouchY: number | null = null

    const handoffWheel = (event: WheelEvent) => {
      const maxScroll = list.scrollHeight - list.clientHeight
      const atTop = list.scrollTop <= 1
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1
      const leavingTop = event.deltaY < 0 && atTop
      const leavingBottom = event.deltaY > 0 && (atBottom || maxScroll <= 1)
      const noInnerScroll = maxScroll <= 1
      if (leavingTop || leavingBottom || noInnerScroll) {
        event.preventDefault()
        window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' })
      }
    }
    const startTouch = (event: TouchEvent) => {
      previousTouchY = event.touches[0]?.clientY ?? null
    }
    const moveTouch = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY
      if (currentY == null || previousTouchY == null) return
      const delta = previousTouchY - currentY
      previousTouchY = currentY
      if (Math.abs(delta) < 1) return

      const maxScroll = list.scrollHeight - list.clientHeight
      const atTop = list.scrollTop <= 1
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1
      const handoffDown = delta > 0 && (atBottom || maxScroll <= 1)
      const handoffUp = delta < 0 && (atTop || maxScroll <= 1)
      if (handoffDown || handoffUp) {
        event.preventDefault()
        window.scrollBy(0, delta)
      }
    }
    const endTouch = () => { previousTouchY = null }

    list.addEventListener('wheel', handoffWheel, { passive: false })
    list.addEventListener('touchstart', startTouch, { passive: true })
    list.addEventListener('touchmove', moveTouch, { passive: false })
    list.addEventListener('touchend', endTouch, { passive: true })
    list.addEventListener('touchcancel', endTouch, { passive: true })
    return () => {
      list.removeEventListener('wheel', handoffWheel)
      list.removeEventListener('touchstart', startTouch)
      list.removeEventListener('touchmove', moveTouch)
      list.removeEventListener('touchend', endTouch)
      list.removeEventListener('touchcancel', endTouch)
    }
  }, [])

  /* only fetch the map library/tiles once the section is close to the screen */
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    if (!('IntersectionObserver' in window)) return setWantMap(true)
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setWantMap(true)
        io.disconnect()
      }
    }, { rootMargin: '500px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* Load real ADM2 district shapes and the ADM0 national outline; never depend on map tiles for borders. */
  useEffect(() => {
    if (!wantMap) return
    const controller = new AbortController()
    let cancelled = false
    fetch('/api/map-boundaries', { signal: controller.signal, cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Boundary request failed: ${response.status}`)
        return response.json() as Promise<{ districts?: unknown; country?: unknown }>
      })
      .then((data) => {
        if (cancelled) return
        const districts = parseFeatureCollection(data.districts)
        const country = parseFeatureCollection(data.country)
        if (districts.length) setDistrictFeatures(districts)
        if (country.length) setCountryFeature(country[0])
      })
      .catch(() => { /* SVG country outline remains available if boundary data is offline. */ })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [wantMap])

  /* Real map: frame the full country and keep touch gestures available for vertical page/list scrolling. */
  useEffect(() => {
    if (!wantMap) return
    // The interactive basemap requires a MapTiler key; keep the local Bangladesh SVG usable until configured.
    if (!MAPTILER_API_KEY) {
      setMode('svg')
      return
    }
    let cancelled = false
    let map: any
    const timeout = new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('timeout')), 8000))
    Promise.race([loadLeaflet(), timeout])
      .then((L) => {
        if (cancelled || !leafletEl.current) return
        map = L.map(leafletEl.current, {
          zoomControl: false,
          zoomSnap: 0.25,
          maxZoom: 13,
          maxBounds: L.latLngBounds(BD_BOUNDS).pad(0.16),
          maxBoundsViscosity: 0.65,
          scrollWheelZoom: false,
          // Let vertical touch gestures scroll the page and the location rail instead of panning the basemap.
          dragging: window.matchMedia('(min-width: 1001px)').matches,
          touchZoom: false,
          doubleClickZoom: false,
          attributionControl: true,
        })
        // Leaflet has no pixel projection until the map has an initial view.
        // Set a Bangladesh-centered view before registering the ready callback
        // or switching the overlay pins from the SVG projection to Leaflet.
        mapRef.current = map
        map.setView([23.685, 90.3563], 7, { animate: false })
        L.control.zoom({ position: 'bottomright' }).addTo(map)
        const tiles = L.tileLayer(tileUrl(document.documentElement.dataset.mode === 'dark'), {
          maxZoom: 20,
          opacity: 0.92,
          attribution: '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
        }).addTo(map)
        tileRef.current = tiles
        // A failed/invalid API key can return blank tiles. Fade failed tiles away so the
        // local map background and district/country vector overlays remain clearly visible.
        let tileErrors = 0
        let tileFallbackApplied = false
        tiles.on('tileerror', () => {
          tileErrors += 1
          if (tileErrors >= 3 && !tileFallbackApplied) {
            tileFallbackApplied = true
            tiles.setOpacity(0.04)
            // Switch to the self-contained vector view instead of leaving a white tile grid.
            setMode('svg')
          }
        })
        tiles.on('tileload', () => {
          if (!tileFallbackApplied) tileErrors = Math.max(0, tileErrors - 1)
        })
        circlesRef.current = L.layerGroup().addTo(map)
        // Keep all of Bangladesh visible at every aspect ratio; re-fit after mobile/desktop resize.
        fitRef.current = L.latLngBounds(BD_BOUNDS)
        const fit = (animate: boolean) => {
          if (!map || !map.getSize().x || !map.getSize().y) return
          const padding = window.innerWidth <= 560 ? [10, 10] : [18, 18]
          // Keep the minimum zoom low enough that a narrower viewport can always fit the country.
          map.setMinZoom(4)
          map.fitBounds(fitRef.current, { padding, maxZoom: 6.5, animate })
        }
        map.whenReady(() => fit(false))
        // Responsive fitting is handled below so a selected district remains in focus on mobile.
        map.on('move zoom resize', () => setTick((n) => n + 1))
        map.on('focus', () => map.scrollWheelZoom.enable())
        map.on('blur', () => map.scrollWheelZoom.disable())
        // setView above initializes Leaflet synchronously; the ready callback
        // now has a valid center/zoom and can safely fit the Bangladesh country bounds.
        setMode('map')
      })
      .catch(() => {
        if (!cancelled) setMode('svg')
      })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
      tileRef.current = null
      circlesRef.current = null
    }
  }, [wantMap])

  /* light / dark map tiles follow the site mode */
  useEffect(() => {
    tileRef.current?.setUrl(tileUrl(colorMode === 'dark'))
  }, [colorMode, mode])

  /* Fit Bangladesh by default; on mobile, zoom to the selected district when one is chosen. */
  useEffect(() => {
    const map = mapRef.current
    const L = window.L
    if (mode !== 'map' || !map || !L || !fitRef.current) return

    let targetBounds = fitRef.current
    let maxZoom = 6.5
    const mobile = window.matchMedia('(max-width: 700px)').matches
    if (active && districtFeatures.length) {
      const selectedName = normalizeDistrictName(active.branch.district.en)
      const feature = districtFeatures.find((item) => normalizeDistrictName(featureDistrictName(item)) === selectedName)
      if (feature) {
        const districtBounds = L.geoJSON(feature).getBounds()
        if (districtBounds.isValid()) {
          targetBounds = districtBounds.pad(0.10)
          maxZoom = 8.75
        }
      }
    }

    let raf = 0
    raf = window.requestAnimationFrame(() => {
      if (!mapRef.current) return
      map.invalidateSize({ pan: false })
      map.fitBounds(targetBounds, {
        padding: mobile ? [8, 8] : [34, 34],
        maxZoom,
        animate: Boolean(active),
        duration: 0.45,
      })
    })
    return () => window.cancelAnimationFrame(raf)
  }, [mode, activeId, active, districtFeatures, size.w, size.h])

  /* Render real district shapes and colour the selected district boundary. */
  useEffect(() => {
    const L = window.L
    const group = circlesRef.current
    if (!L || !group || mode !== 'map') return
    group.clearLayers()
    const primary = cssVar('--sf-primary')
    const accent = cssVar('--sf-accent')
    const districtFill = colorMode === 'dark' ? cssVar('--sf-bg') : cssVar('--sf-soft')
    const districtColors = colorMode === 'dark' ? DISTRICT_COLORS.dark : DISTRICT_COLORS.light
    const selectedName = normalizeDistrictName(active?.branch.district.en)

    if (districtFeatures.length) {
      const collection: FeatureCollection = { type: 'FeatureCollection', features: districtFeatures }
      L.geoJSON(collection, {
        interactive: false,
        style: (feature: MapFeature | undefined) => {
          const selected = Boolean(feature && normalizeDistrictName(featureDistrictName(feature)) === selectedName && selectedName)
          return {
            color: selected ? accent : cssVar('--sf-muted'),
            weight: selected ? 3.25 : 1.05,
            opacity: 1,
            fillColor: selected ? accent : feature ? districtColors[districtPaletteIndex(featureDistrictName(feature))] : districtFill,
            fillOpacity: selected ? 0.62 : 0.48,
            lineJoin: 'round',
            interactive: false,
          }
        },
      }).addTo(group)
      if (countryFeature) {
        L.geoJSON(countryFeature, {
          interactive: false,
          style: { color: cssVar('--sf-ink'), weight: 3, opacity: 0.88, fillOpacity: 0, interactive: false, lineJoin: 'round' },
        }).addTo(group)
      }
    } else {
      // Keep a clear country outline even when only the ADM0 dataset is reachable.
      if (countryFeature) {
        L.geoJSON(countryFeature, {
          interactive: false,
          style: { color: cssVar('--sf-ink'), weight: 3, opacity: 0.92, fillColor: districtFill, fillOpacity: 0.68, interactive: false, lineJoin: 'round' },
        }).addTo(group)
      } else {
        L.polygon(OUTLINE_COORDS.map(([lng, lat]) => [lat, lng]), {
          color: cssVar('--sf-ink'), weight: 3, opacity: 0.92, fillColor: cssVar('--sf-soft'), fillOpacity: 0.78,
          lineJoin: 'round', interactive: false,
        }).addTo(group)
      }
      // Exact district highlighting becomes available automatically when the ADM2 file loads.
      visible.forEach((r) => {
        const isHead = r.branch.kind === 'head'
        const on = r.branch.id === activeId
        L.circle([r.branch.lat, r.branch.lng], {
          radius: on ? 36000 : isHead ? 14500 : 9500,
          color: on ? accent : isHead ? accent : primary,
          weight: on ? 3 : 1.25,
          opacity: on ? 1 : 0.72,
          fillColor: on ? accent : isHead ? accent : primary,
          fillOpacity: on ? 0.48 : 0.16,
          interactive: false,
        }).addTo(group)
      })
    }
  }, [mode, visible, activeId, active, districtFeatures, countryFeature, theme, colorMode])

  const resetView = useCallback(() => {
    if (mapRef.current && fitRef.current) mapRef.current.fitBounds(fitRef.current, { padding: window.innerWidth <= 560 ? [10, 10] : [18, 18], maxZoom: 7.5, animate: true })
  }, [])
  // Selecting a branch highlights its area and its row; it deliberately does not zoom the map.
  const focusBranch = (r: Resolved) => {
    togglePin(r.branch.id)
  }

  /* pixel position of a pin inside the map box */
  const pixel = (r: Resolved) => {
    if (mode === 'map' && mapRef.current?._loaded) {
      const p = mapRef.current.latLngToContainerPoint([r.branch.lat, r.branch.lng])
      return { x: p.x as number, y: p.y as number }
    }
    const bounds = svgViewport
    const s = Math.min(size.w / bounds.width, size.h / bounds.height)
    return {
      x: (size.w - bounds.width * s) / 2 + (r.vx - bounds.x) * s,
      y: (size.h - bounds.height * s) / 2 + (r.vy - bounds.y) * s,
    }
  }

  if (variant !== 'contact' && (footprintCopy?.visible === false || !footprintEyebrow || !footprintTitle)) return null
  const sectionId = variant === 'contact' ? 'contact-locations' : 'national-footprint'
  const titleId = variant === 'contact' ? 'sf-contact-map-title' : 'sf-fp-title'

  return (
    <section id={sectionId} ref={sectionRef} className={`sf-section sf-footprint${variant === 'contact' ? ' sf-footprint--contact' : ''}`} aria-labelledby={titleId}>
      <div className="sf-container">
        <Reveal>
          <header className="sf-sec-head sf-sec-head--center">
            <span className="sf-eyebrow">{footprintEyebrow?.[lang] ?? ''}</span>
            <h2 id={titleId} className="sf-h2">{footprintTitle?.[lang] ?? ''}</h2>
            <p className="sf-lead">{footprintLead[lang]}</p>
          </header>
        </Reveal>

        <div className="sf-fp-grid">
          <div className="sf-fp-mapcol" data-fp-keep>
            <div className={`sf-fp-map is-${mode}`} ref={boxRef}>
              <div ref={leafletEl} className="sf-fp-leaflet" />
              <div className="sf-fp-map-legend" role="group" aria-label={tr('Map legend', 'মানচিত্রের নির্দেশিকা')}>
                <span><i className="is-head" />{tr('Head office', 'প্রধান কার্যালয়')}</span>
                <span><i className="is-branch" />{tr('Branch office', 'শাখা অফিস')}</span>
                <span><i className="is-district" />{tr('District areas', 'জেলা সীমানা')}</span>
              </div>

              {mode !== 'map' && (
                <svg className="sf-fp-svg" viewBox={`${svgViewport.x} ${svgViewport.y} ${svgViewport.width} ${svgViewport.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={tr('Map of Bangladesh with district boundaries', 'জেলা সীমানাসহ বাংলাদেশের মানচিত্র')}>
                  <defs>
                    <pattern id="sf-fp-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.25" /></pattern>
                  </defs>
                  {districtFeatures.length ? (
                    <>
                      {countryFeature && <path d={geoFeaturePath(countryFeature)} className="sf-fp-country-fill" />}
                      {districtFeatures.map((feature, index) => {
                        const selected = Boolean(active && normalizeDistrictName(featureDistrictName(feature)) === normalizeDistrictName(active.branch.district.en))
                        return <path
                          key={`${featureDistrictName(feature)}-${index}`}
                          d={geoFeaturePath(feature)}
                          className={`sf-fp-district${selected ? ' is-selected' : ''}`}
                          style={{ fill: selected ? 'var(--sf-accent)' : districtPaletteFill(featureDistrictName(feature)), fillOpacity: selected ? 0.72 : 0.42 }}
                        />
                      })}
                      {countryFeature && <path d={geoFeaturePath(countryFeature)} className="sf-fp-country-edge" />}
                    </>
                  ) : countryFeature ? (
                    <>
                      <path d={geoFeaturePath(countryFeature)} className="sf-fp-country-fill" />
                      <path d={geoFeaturePath(countryFeature)} className="sf-fp-country-edge" />
                    </>
                  ) : (
                    <>
                      <path d={OUTLINE_PATH} className="sf-fp-land" />
                      <path d={OUTLINE_PATH} className="sf-fp-dots" fill="url(#sf-fp-dots)" />
                      <path d={OUTLINE_PATH} className="sf-fp-edge" />
                    </>
                  )}
                </svg>
              )}

              {mode === 'loading' && (
                <div className="sf-fp-loading" role="status" aria-live="polite">
                  <LogoLoader size="sm" inline label="" />
                  <span className="sf-sr">{tr('Loading map', 'মানচিত্র লোড হচ্ছে')}</span>
                </div>
              )}

              {mode !== 'map' && active && !districtFeatures.length && (() => {
                const point = pixel(active)
                return <div className="sf-fp-selected-area" aria-hidden="true" style={{ left: point.x, top: point.y }} />
              })()}

              <div className="sf-fp-pins">
                {visible.map((r, i) => {
                  const { x, y } = pixel(r)
                  if (x < -30 || y < -30 || x > size.w + 30 || y > size.h + 30) return null
                  const isActive = r.branch.id === activeId
                  const isHead = r.branch.kind === 'head'
                  return (
                    <div
                      key={r.branch.id}
                      className={`sf-fp-pin ${isHead ? 'is-head' : ''} ${isActive ? 'is-active' : ''} ${hoverId === r.branch.id ? 'is-hovered' : ''}`}
                      style={{ left: x, top: y, ['--i' as string]: i } as CSSProperties}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && openHover(r.branch.id)}
                      onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleClose()}
                      onFocus={() => openHover(r.branch.id)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose()
                      }}
                    >
                      <button type="button" className="sf-fp-dot" aria-label={`${r.name}, ${r.district}`} aria-pressed={pinnedId === r.branch.id} onClick={() => togglePin(r.branch.id)}>
                        <span className="sf-fp-dot-core" />
                      </button>
                    </div>
                  )
                })}
              </div>

              {districtFeatures.length > 0 && (
                <a
                  className="sf-fp-boundary-credit"
                  href="https://www.geoboundaries.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tr('District boundary source: geoBoundaries, CC BY 3.0 IGO', 'জেলা সীমানার উৎস: geoBoundaries, CC BY 3.0 IGO')}
                >
                  geoBoundaries · CC BY 3.0 IGO
                </a>
              )}

              <button type="button" className="sf-fp-reset" onClick={resetView} aria-label={tr('Reset map view', 'মানচিত্র রিসেট করুন')} hidden={mode !== 'map'}>
                <Compass size={18} />
              </button>
            </div>

            {active && (
              <div className="sf-fp-panel" aria-live="polite">
                <BranchDetail r={active} lang={lang} onClose={() => { setPinnedId(null); setHoverId(null) }} />
              </div>
            )}
          </div>

          <aside className="sf-fp-listcol" data-fp-keep>
            <div className="sf-fp-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Search district or branch…', 'জেলা বা শাখা খুঁজুন…')} aria-label={tr('Search offices', 'অফিস খুঁজুন')} />
              {query && (
                <button type="button" className="sf-icon-btn" onClick={() => setQuery('')} aria-label={tr('Clear search', 'অনুসন্ধান মুছুন')}><X size={14} /></button>
              )}
            </div>

            <div className="sf-fp-meta">
              <span>{localizeDigits(visible.length, lang)} {tr(visible.length === 1 ? 'office' : 'offices', 'টি অফিস')}</span>
              <span className="sf-fp-legend"><i className="is-head" /> {tr('Head office', 'প্রধান কার্যালয়')} <i /> {tr('Branch', 'শাখা')}</span>
            </div>

            <ul ref={listRef} className="sf-fp-list">
              {visible.map((r) => (
                <li
                  key={r.branch.id}
                  className={[r.branch.id === activeId ? 'is-active' : '', r.branch.id === hoverId ? 'is-hovered' : ''].filter(Boolean).join(' ')}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && openHover(r.branch.id)}
                  onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleClose()}
                >
                  <button type="button" className="sf-fp-item" onClick={() => focusBranch(r)}>
                    <span className={`sf-fp-item-dot ${r.branch.kind === 'head' ? 'is-head' : ''}`} aria-hidden="true" />
                    <span className="sf-fp-item-text">
                      <strong>{r.name}</strong>
                      <small className="sf-fp-item-district">{r.district} · {r.branch.division[lang]}</small>
                    </span>
                  </button>
                </li>
              ))}
              {visible.length === 0 && <li className="sf-fp-empty">{tr('No offices match your search.', 'আপনার অনুসন্ধানের সঙ্গে কোনো অফিস মেলেনি।')}</li>}
            </ul>
          </aside>
        </div>
      </div>
      <SectionActions config={footprintCopy?.buttonConfig} lang={lang} arrow className="sf-home-section-actions" />
    </section>
  )
}
