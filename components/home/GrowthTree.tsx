'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lang, PageData } from '@/types/entityType'
import { layoutTree } from '@/lib/growthTreeLayout'
import { MILESTONES, normalizeGrowthMilestones, pick, type Milestone } from '@/lib/GrowthMilestones'
import Image from 'next/image'
import { plainSectionTitle } from '@/lib/sectionTitle'
import { GrowthSectionData, normalizeHeading } from './GrowthSection'

/* ---------- localized number formatting ---------- */
const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯'

function formatDigits(value: string | number, lang: Lang): string {
    const text = String(value)
    if (lang !== 'bn') return text
    return text.replace(/[0-9]/g, (digit) => BENGALI_DIGITS[Number(digit)])
}

/* ---------- copy ---------- */
const UI = {
    en: {
        tree: 'Timeline tree of Srizony Foundation, 1985 to 2026. A seedling grows into a full tree as you move through the years. Scroll or select a branch to read about each year.',
        yearOf: (n: number, total: number) => `Year ${n} of ${total}`,
        prev: 'Previous year',
        next: 'Next year',
        slider: 'Choose a year',
        hint: 'Scroll to watch the tree grow through the years, or select a branch.',
        empty: (y: number) => `The record for ${y} is being added.`,
        achievements: 'Key achievements',
        branch: (y: number) => `Branch for ${y}`,
    },
    bn: {
        tree: 'শ্রীজনি ফাউন্ডেশনের ১৯৮৫ থেকে ২০২৬ পর্যন্ত টাইমলাইন গাছ। বছর এগোলে একটি চারা ধীরে ধীরে পূর্ণ বৃক্ষে পরিণত হয়। স্ক্রল করুন বা কোনো শাখা নির্বাচন করুন।',
        yearOf: (n: number, total: number) => `${formatDigits(total, 'bn')} বছরের মধ্যে ${formatDigits(n, 'bn')} নম্বর`,
        prev: 'আগের বছর',
        next: 'পরের বছর',
        slider: 'বছর বেছে নিন',
        hint: 'গাছের বেড়ে ওঠা দেখতে স্ক্রল করুন, অথবা কোনো শাখা বেছে নিন।',
        empty: (y: number) => `${formatDigits(y, 'bn')} সালের তথ্য যুক্ত করা হচ্ছে।`,
        achievements: 'প্রধান অর্জন',
        branch: (y: number) => `${formatDigits(y, 'bn')} সালের শাখা`,
    },
} as const
type UIText = (typeof UI)['en']
const getUI = (lang: Lang): UIText => ((UI as Record<string, unknown>)[lang] ?? UI.en) as UIText

/* ---------- growth tuning ---------- */
const SEEDLING_HEIGHT = 46 // trunk height (svg units) of the very first sprout
const MAX_ZOOM = 2.4 // camera zoom on the seedling; eases out to 1 for the full tree
const FOLLOW_MS = 260 // how quickly the plant catches up with the selected year

/* ---------- math helpers ---------- */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 2.2
const snap = (v: number, step: number) => Math.round(v / step) * step

const mulberry = (seed: number) => {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Math.sin/cos can differ by a few floating-point ulps between Node and browsers.
// Quantizing every generated SVG coordinate makes the server and client markup identical.
const stable = (value: number) => Number(value.toFixed(3))

const bez = (p: number[][], t: number) => {
    const u = 1 - t
    return [0, 1].map(k => u ** 3 * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t ** 3 * p[3][k])
}

/* ---------- geometry ---------- */
type Leaf = { x: number; y: number; rx: number; ry: number; rot: number; tone: 1 | 2 | 3 }
type Fruit = { x: number; y: number }
type Twig = { d: string; t: number; w: number; leaves: Leaf[] }
type NodeGeo = {
    i: number
    m: Milestone
    d: string
    ex: number
    ey: number
    sx: number
    sy: number
    width: number
    twigs: Twig[]
    tip: Leaf[]
    fruit: Fruit[]
}
type Tree = ReturnType<typeof buildTree>

function buildTree(compact: boolean, milestones: Milestone[]) {
    const n = milestones.length
    const rawLayout = layoutTree(n, compact)

    // Normalize layout values too: they feed SVG viewBox, transforms and path geometry.
    const L = {
        ...rawLayout,
        W: stable(rawLayout.W),
        H: stable(rawLayout.H),
        cx: stable(rawLayout.cx),
        cy: stable(rawLayout.cy),
        base: stable(rawLayout.base),
        a: stable(rawLayout.a),
        b: stable(rawLayout.b),
        points: rawLayout.points.map(point => ({ x: stable(point.x), y: stable(point.y) })),
    }
    const { cx, cy, base } = L
    const k = compact ? 0.8 : 1
    const r = compact ? 15 : 17
    const sway = (y: number) => (compact ? 0 : stable(Math.sin(y / 110) * 5))

    const nodes: NodeGeo[] = milestones.map((m, i) => {
        const rnd = mulberry(m.year * 97)
        const tone = () => (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3
        const { x: ex, y: ey } = L.points[i]
        const sy = stable(Math.min(base - 40, Math.max(cy + 10, ey + 120)))
        const sx = stable(cx + sway(sy))
        const rise = stable(Math.abs(sy - ey))
        const pts = [
            [sx, sy],
            [stable(sx + (ex - sx) * 0.12), stable(sy - rise * 0.5)],
            [stable(sx + (ex - sx) * 0.62), stable(ey + rise * 0.18)],
            [ex, ey],
        ]
        const d = `M${pts[0][0]} ${pts[0][1]} C${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]} ${ex} ${ey}`

        // side twigs: each one sprouts after the main limb has passed its attachment point
        const twigs: Twig[] = []
        const twigCount = 3 + Math.floor(i / 8)
        for (let q = 0; q < twigCount; q++) {
            const t = 0.3 + rnd() * 0.55
            const [px, py] = bez(pts, t)
            const [qx, qy] = bez(pts, Math.min(1, t + 0.03))
            const heading = Math.atan2(qy - py, qx - px) + (rnd() < 0.5 ? -1 : 1) * (0.55 + rnd() * 0.55)
            const len = (14 + rnd() * 18) * k
            const tx = px + Math.cos(heading) * len
            const ty = py + Math.sin(heading) * len - 3
            const bend = (rnd() - 0.5) * 8
            const mx = (px + tx) / 2 + bend
            const my = (py + ty) / 2 - Math.abs(bend) * 0.4
            const leaves: Leaf[] = []
            for (let w = 0; w < 2; w++) {
                const a = heading + (rnd() - 0.5) * 1.6
                const rr = 2 + rnd() * 7
                leaves.push({
                    x: stable(tx + Math.cos(a) * rr),
                    y: stable(ty + Math.sin(a) * rr),
                    rx: stable(6 + rnd() * 3),
                    ry: stable(3 + rnd() * 1.4),
                    rot: stable((a * 180) / Math.PI),
                    tone: tone(),
                })
            }
            twigs.push({
                d: `M${stable(px)} ${stable(py)} Q${stable(mx)} ${stable(my)} ${stable(tx)} ${stable(ty)}`,
                t: stable(t),
                w: stable((1.3 + rnd() * 0.6) * k),
                leaves,
            })
        }

        // leaf cluster around the year bud
        const tip: Leaf[] = []
        const cluster = 2 + Math.floor(i / 8)
        for (let q = 0; q < cluster; q++) {
            const a = rnd() * Math.PI * 2
            const rr = r + 2 + rnd() * 9
            tip.push({
                x: stable(ex + Math.cos(a) * rr),
                y: stable(ey + Math.sin(a) * rr),
                rx: stable(7 + rnd() * 4),
                ry: stable(3.5 + rnd() * 2),
                rot: stable((a * 180) / Math.PI),
                tone: tone(),
            })
        }

        const fruit: Fruit[] = []
        if (m.featured ?? (i % 5 === 0)) {
            const a0 = rnd() * Math.PI * 2
            for (let q = 0; q < 3; q++) {
                fruit.push({
                    x: stable(ex + Math.cos(a0 + q * 2.1) * (r + 7)),
                    y: stable(ey + Math.sin(a0 + q * 2.1) * (r + 7)),
                })
            }
        }

        const denominator = Math.max(1, n - 1)
        return { i, m, d, ex, ey, sx, sy, twigs, tip, fruit, width: stable((5 - (i / denominator) * 2.4) * k) }
    })

    const topY = stable(cy - 12)

    const roots = [-1, 1, -0.5, 0.55].map((s, idx) => {
        const len = stable((60 + idx * 14) * k)
        return `M${cx} ${stable(base + 2)} C${stable(cx + s * 20)} ${stable(base + 16)} ${stable(cx + s * len * 0.6)} ${stable(base + 20)} ${stable(cx + s * len)} ${stable(base + 30 + (idx % 2) * 4)}`
    })

    // grass around the base
    const gr = mulberry(5)
    const grass = Array.from({ length: 16 }, () => {
        const h = 7 + gr() * 9
        return {
            x: stable(cx + (gr() - 0.5) * 190 * k),
            y: stable(base + 9 - h * 0.55),
            ry: stable(h),
            rot: stable((gr() - 0.5) * 50),
            tone: (1 + Math.floor(gr() * 3)) as 1 | 2 | 3,
        }
    })
    const mound = `M${stable(cx - 34 * k)} ${stable(base + 10)} Q${cx} ${stable(base - 4)} ${stable(cx + 34 * k)} ${stable(base + 10)} Z`

    return { ...L, nodes, roots, grass, mound, topY, sway, r, fs: compact ? 9.5 : 10, k }
}

/** The trunk is rebuilt as the tree grows: taller, thicker, with bark that develops with age. */
function buildTrunk(tree: Pick<Tree, 'cx' | 'base' | 'k' | 'sway'>, top: number, widthFactor: number) {
    const { cx, base, k, sway } = tree
    const samples = 24
    const left: string[] = []
    const right: string[] = []
    const offsets = [-0.55, -0.18, 0.22, 0.58]
    const phases = offsets.map((_, idx) => idx * 1.7)
    const bark: string[][] = offsets.map(() => [])

    for (let s = 0; s <= samples; s++) {
        const y = stable(base + 8 - ((base + 8 - top) * s) / samples)
        const half = stable((15 - 9 * (s / samples) + (s < 3 ? 4 - s * 1.3 : 0)) * k * widthFactor)
        const centerX = stable(cx + sway(y))
        left.push(`${stable(centerX - half)},${y}`)
        right.unshift(`${stable(centerX + half)},${y}`)
        if (s >= 1 && s <= samples - 2) {
            offsets.forEach((o, idx) => {
                bark[idx].push(`${stable(centerX + o * half + Math.sin(y / 9 + phases[idx]) * half * 0.12)},${y}`)
            })
        }
    }
    const topX = stable(cx + sway(top))
    return {
        d: `M${left.join(' L')} L${right.join(' L')} Z`,
        bark: bark.map(line => `M${line.join(' L')}`),
        topX,
        top,
    }
}

/* ---------- small memoised pieces (only the branches that change re-render) ---------- */
const leafEl = (l: Leaf, key: string | number, p: number) =>
    p > 0.02 ? (
        <ellipse
            key={key}
            cx={l.x}
            cy={l.y}
            rx={stable(l.rx * p)}
            ry={stable(l.ry * p)}
            transform={`rotate(${l.rot} ${l.x} ${l.y})`}
            className={`sf-tree-leaf t${l.tone}`}
        />
    ) : null

const drawStyle = (progress: number): CSSProperties => ({
    strokeDasharray: '1',
    strokeDashoffset: stable(1 - progress),
    strokeLinecap: 'round',
    fill: 'none',
    opacity: 1,
    transition: 'none',
})

type BranchProps = { n: NodeGeo; bp: number; thick: number; ripe: number; past: boolean; current: boolean }

const Branch = memo(function Branch({ n, bp, thick, ripe, past, current }: BranchProps) {
    const { i, m, d, sx, sy, width, twigs, tip, fruit } = n
    const grown = bp > 0.001
    const tipLeaf = clamp01((bp - 0.65) / 0.35)
    return (
        <g className={`sf-tree-branch${past ? ' is-past' : ''}${current ? ' is-active' : ''}`}>
            <path d={d} className="sf-tree-ghost" />
            {grown && (
                <>
                    <path
                        d={d}
                        pathLength={1}
                        className="sf-tree-limb"
                        strokeWidth={stable(width * thick * (0.4 + 0.6 * Math.sqrt(bp)))}
                        style={drawStyle(bp)}
                    />
                    <g className="sf-tree-foliage" style={{ opacity: 1, transition: 'none' }}>
                        <g className="sf-sway" style={{ transformOrigin: `${sx}px ${sy}px`, animationDelay: `-${(i * 0.83) % 7}s` }}>
                            {twigs.map((tw, q) => {
                                const tp = clamp01((bp - tw.t) * 3)
                                if (tp <= 0.001) return null
                                const lp = clamp01((tp - 0.45) / 0.55)
                                return (
                                    <g key={q}>
                                        <path
                                            d={tw.d}
                                            pathLength={1}
                                            className="sf-tree-limb"
                                            strokeWidth={stable(tw.w * thick)}
                                            style={drawStyle(tp)}
                                        />
                                        {tw.leaves.map((l, w) => leafEl(l, w, lp))}
                                    </g>
                                )
                            })}
                            {tip.map((l, q) => leafEl(l, `t${q}`, tipLeaf))}
                            {ripe > 0.05 &&
                                fruit.map((f, q) => (
                                    <circle key={q} cx={f.x} cy={f.y} r={stable(3.2 * ripe)} className="sf-tree-fruit" />
                                ))}
                        </g>
                    </g>
                </>
            )}
            <title>{m.year}</title>
        </g>
    )
})

type BudProps = {
    n: NodeGeo
    ns: number
    past: boolean
    current: boolean
    label: string
    aria: string
    r: number
    fs: number
    onPreview: (i: number | null) => void
    onGo: (i: number) => void
    onKey: (e: KeyboardEvent<SVGGElement>, i: number) => void
}

const Bud = memo(function Bud({ n, ns, past, current, label, aria, r, fs, onPreview, onGo, onKey }: BudProps) {
    const i = n.i
    return (
        <g
            id={`sf-tree-node-${i}`}
            className={`sf-tree-node${past ? ' is-past' : ''}${current ? ' is-active' : ''}`}
            transform={`translate(${n.ex} ${n.ey}) scale(${ns})`}
            role="button"
            tabIndex={0}
            aria-label={aria}
            aria-pressed={current}
            onPointerEnter={e => e.pointerType === 'mouse' && onPreview(i)}
            onPointerLeave={() => onPreview(null)}
            onFocus={() => onPreview(i)}
            onBlur={() => onPreview(null)}
            onClick={() => {
                onPreview(null)
                onGo(i)
            }}
            onKeyDown={e => onKey(e, i)}
        >
            <circle r={r + 3} className="sf-tree-hit" />
            <g className="sf-tree-disc">
                <circle r={r} className="sf-tree-bud" />
                <text className="sf-tree-year" fontSize={fs} textAnchor="middle" dominantBaseline="central">
                    {label}
                </text>
            </g>
        </g>
    )
})

const GROWTH_CSS = `
.sf-sway{animation:sf-sway 7s ease-in-out infinite}
@keyframes sf-sway{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(1deg)}}
@media (prefers-reduced-motion:reduce){.sf-sway{animation:none}}
`

/* ---------- component ---------- */
export default function GrowthTree({ lang, page }: { lang: Lang;  page: PageData; }) {
    const ui = getUI(lang)
    const wrapRef = useRef<HTMLDivElement | null>(null)
    const stickyRef = useRef<HTMLDivElement | null>(null)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const lockUntil = useRef(0)
    const gfRef = useRef(0)
    const [compact, setCompact] = useState(false)
    const [milestones, setMilestones] = useState<Milestone[]>(MILESTONES)
    const [active, setActive] = useState(0) // driven by scroll position
    const [gf, setGf] = useState(0) // smoothed "age" of the tree, in year units (0 = seedling)
    const [preview, setPreview] = useState<number | null>(null) // hover / focus only
    const total = milestones.length
    const section = page.sections.find((item): item is GrowthSectionData => item.type === 'stats' && (item.homeComponent === 'growth' || normalizeHeading(item.heading?.en) === 'growing together'))
    const eyebrow = section?.eyebrow
    const heading = section?.heading

    useEffect(() => {
        let mounted = true
        void fetch('/api/growth-tree', { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) throw new Error('Growth-tree records are temporarily unavailable.')
                return response.json() as Promise<{ milestones?: unknown }>
            })
            .then((payload) => {
                if (mounted) setMilestones(normalizeGrowthMilestones(payload.milestones))
            })
            .catch(() => {
                // Keep the validated bootstrap records visible while the CMS API is unavailable.
            })
        return () => { mounted = false }
    }, [])

    const tree = useMemo(() => buildTree(compact, milestones), [compact, milestones])

    useEffect(() => {
        const node = stageRef.current
        if (!node) return
        const measure = () => setCompact(node.clientWidth < 520)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(node)
        return () => ro.disconnect()
    }, [])

    const metrics = useCallback(() => {
        const wrap = wrapRef.current
        const sticky = stickyRef.current
        if (!wrap || !sticky) return null
        const top = parseFloat(getComputedStyle(sticky).top) || 0
        const runway = Math.max(1, wrap.offsetHeight - sticky.offsetHeight)
        return { top, runway, rectTop: wrap.getBoundingClientRect().top }
    }, [])

    // scroll position -> year
    useEffect(() => {
        let raf = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        const update = () => {
            raf = 0
            const m = metrics()
            if (!m) return
            if (performance.now() < lockUntil.current) {
                clearTimeout(timer)
                timer = setTimeout(update, lockUntil.current - performance.now() + 20)
                return
            }
            const p = Math.min(1, Math.max(0, (m.top - m.rectTop) / m.runway))
            setActive(Math.min(total - 1, Math.floor(p * total)))
        }
        const on = () => { if (!raf) raf = requestAnimationFrame(update) }
        update()
        window.addEventListener('scroll', on, { passive: true })
        window.addEventListener('resize', on)
        return () => {
            window.removeEventListener('scroll', on)
            window.removeEventListener('resize', on)
            cancelAnimationFrame(raf)
            clearTimeout(timer)
        }
    }, [metrics, total])

    // selected year -> smoothly growing tree (a plant never jumps, it grows)
    useEffect(() => {
        const target = active
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduce) {
            gfRef.current = target
            const raf = requestAnimationFrame(() => setGf(target))
            return () => cancelAnimationFrame(raf)
        }
        let raf = 0
        let last = performance.now()
        const step = (now: number) => {
            const dt = Math.min(64, now - last)
            last = now
            const diff = target - gfRef.current
            if (Math.abs(diff) < 0.002) {
                gfRef.current = target
                setGf(target)
                return
            }
            gfRef.current += diff * (1 - Math.exp(-dt / FOLLOW_MS))
            setGf(gfRef.current)
            raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
    }, [active])

    // year -> scroll position
    const goTo = useCallback((i: number, smooth = true) => {
        const next = Math.min(total - 1, Math.max(0, i))
        const m = metrics()
        setActive(next)
        if (!m) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const animate = smooth && !reduce
        lockUntil.current = performance.now() + (animate ? 900 : 150)
        const y = window.scrollY + m.rectTop - m.top + ((next + 0.5) / total) * m.runway
        window.scrollTo({ top: y, behavior: animate ? 'smooth' : 'auto' })
    }, [metrics, total])

    const onNodeKey = useCallback((e: KeyboardEvent<SVGGElement>, i: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            goTo(i)
        } else if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) {
            e.preventDefault()
            const j = Math.min(total - 1, Math.max(0, i + (e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1)))
            document.getElementById(`sf-tree-node-${j}`)?.focus()
        }
    }, [goTo, total])

    /* ----- growth state derived from the smoothed age ----- */
    const g = total > 1 ? clamp01(gf / (total - 1)) : 1
    const { cx, base, k, topY, W, H } = tree

    // each branch grows during the year before its own: it is complete when its year is reached
    const progress = tree.nodes.map(n => clamp01(gf - n.i + 1))

    let minY = base - SEEDLING_HEIGHT * k
    let minSy = Infinity
    let maxDx = 40
    progress.forEach((bp, idx) => {
        if (bp <= 0) return
        const nd = tree.nodes[idx]
        minSy = Math.min(minSy, nd.sy)
        minY = Math.min(minY, lerp(nd.sy, nd.ey, bp))
        maxDx = Math.max(maxDx, Math.abs(lerp(nd.sx, nd.ex, bp) - cx))
    })

    // the trunk rises as the tree ages and always reaches the highest limb that has started
    const trunkTop = Math.min(lerp(base - SEEDLING_HEIGHT * k, topY, easeOut(g)), minSy - 6)
    const widthFactor = lerp(0.2, 1, g ** 0.7)
    minY = Math.min(minY, trunkTop)

    const trunk = useMemo(
        () => buildTrunk(tree, snap(trunkTop, 0.5), snap(widthFactor, 0.004)),
        [tree, trunkTop, widthFactor],
    )

    // the camera starts close on the sprout and pulls back as the crown fills the frame
    const needH = base + 40 - (minY - 1200)
    const zoom = snap(Math.min(MAX_ZOOM, Math.max(1, Math.min(H / needH, W / (2 * (maxDx + 70))))), 0.01)
    const vw = stable(W / zoom)
    const vh = stable(H / zoom)
    const vx = stable(Math.min(W - vw, Math.max(0, cx - vw / 2)))
    const vy = stable(Math.min(H - vh, Math.max(0, base + 44 - vh)))
    const budScale = snap(zoom ** -0.8, 0.02)

    const thick = snap(lerp(0.75, 1.3, g), 0.02)
    const haloScale = lerp(0.12, 1, easeOut(g))
    const cotyledon = 1 - clamp01(g / 0.1)
    const rootGrow = (idx: number) => clamp01(g * 2.4 - idx * 0.15)

    const shown = preview ?? active
    const cur = milestones[shown] ?? milestones[0] ?? MILESTONES[0]
    const hasDetail = Boolean(cur.title || cur.summary || cur.achievements?.length || cur.stats?.length || cur.photo)

    if (!section || section.visible === false || !heading || !eyebrow) return null;

    return (
        <div className="sf-tree" ref={wrapRef} style={{ '--n': total } as CSSProperties}>
            <style>{GROWTH_CSS}</style>
            <div className="sf-tree-sticky" ref={stickyRef}>
                <div className="sf-tree-stage" ref={stageRef}>
                    <svg
                        viewBox={`${vx} ${vy} ${vw} ${vh}`}
                        role="group"
                        aria-label={ui.tree}
                        className="sf-tree-svg"
                        style={{ '--p': total > 1 ? snap(g, 0.001) : 0 } as CSSProperties}
                    >
                        <defs>
                            <linearGradient id="sf-tree-bark" x1="0" x2="1" y1="0" y2="0">
                                <stop offset="0" stopColor="#000" stopOpacity=".28" />
                                <stop offset=".38" stopColor="#fff" stopOpacity=".12" />
                                <stop offset=".65" stopColor="#000" stopOpacity=".02" />
                                <stop offset="1" stopColor="#000" stopOpacity=".34" />
                            </linearGradient>
                        </defs>

                        <ellipse
                            cx={cx}
                            cy={stable(trunk.top + 12)}
                            rx={stable((tree.a + 14) * haloScale)}
                            ry={stable((tree.b + 14) * haloScale)}
                            className="sf-tree-halo"
                        />
                        <line x1="0" x2={W} y1={base + 10} y2={base + 10} className="sf-tree-ground" />
                        <path d={tree.mound} fill="rgba(80,58,38,.4)" style={{ pointerEvents: 'none' }} />
                        {tree.grass.map((b, q) => (
                            <ellipse
                                key={q}
                                cx={b.x}
                                cy={b.y}
                                rx="1.5"
                                ry={b.ry}
                                transform={`rotate(${b.rot} ${b.x} ${b.y})`}
                                className={`sf-tree-leaf t${b.tone}`}
                            />
                        ))}

                        <g>
                            {tree.roots.map((d, q) => (
                                <path
                                    key={q}
                                    d={d}
                                    pathLength={1}
                                    className="sf-tree-root"
                                    strokeWidth={stable(lerp(1.1, 3.4, g) * k)}
                                    style={{ ...drawStyle(snap(rootGrow(q), 0.01)), opacity: rootGrow(q) > 0.001 ? 1 : 0 }}
                                />
                            ))}
                        </g>

                        <path d={trunk.d} className="sf-tree-trunk" />
                        <path d={trunk.d} fill="url(#sf-tree-bark)" style={{ pointerEvents: 'none' }} />
                        <g
                            fill="none"
                            stroke="rgba(0,0,0,.28)"
                            strokeWidth="1"
                            strokeLinecap="round"
                            style={{ pointerEvents: 'none', opacity: clamp01((widthFactor - 0.4) / 0.5) }}
                        >
                            {trunk.bark.map((d, q) => <path key={q} d={d} />)}
                        </g>

                        {cotyledon > 0.02 && (
                            <g style={{ pointerEvents: 'none' }}>
                                {[-1, 1].map(s => (
                                    <ellipse
                                        key={s}
                                        cx={stable(trunk.topX + s * 8 * cotyledon)}
                                        cy={stable(trunk.top - 2)}
                                        rx={stable(10 * cotyledon)}
                                        ry={stable(4.5 * cotyledon)}
                                        transform={`rotate(${s * -24} ${stable(trunk.topX + s * 8 * cotyledon)} ${stable(trunk.top - 2)})`}
                                        className="sf-tree-leaf t2"
                                    />
                                ))}
                            </g>
                        )}

                        {tree.nodes.map((n, idx) => (
                            <Branch
                                key={n.m.year}
                                n={n}
                                bp={snap(progress[idx], 0.004)}
                                thick={thick}
                                ripe={snap(clamp01((gf - n.i - 1.5) / 2), 0.05)}
                                past={n.i <= active}
                                current={n.i === shown}
                            />
                        ))}

                        {tree.nodes.map((n) => (
                            <Bud
                                key={n.m.year}
                                n={n}
                                ns={budScale}
                                past={n.i <= active}
                                current={n.i === shown}
                                label={formatDigits(n.m.year, lang)}
                                aria={ui.branch(n.m.year)}
                                r={tree.r}
                                fs={tree.fs}
                                onPreview={setPreview}
                                onGo={goTo}
                                onKey={onNodeKey}
                            />
                        ))}
                    </svg>
                </div>

                <aside className="flex flex-col h-full justify-between" aria-live="polite">
                    <div className="sf-tree-panel">
                        <p className="sf-tree-count">{ui.yearOf(shown + 1, total)}</p>
                        <div className="sf-tree-head">
                            <h3 className="sf-tree-panel-year">{formatDigits(cur.year, lang)}</h3>
                            {pick(cur.title, lang) && <p className="sf-tree-panel-title">{formatDigits(pick(cur.title, lang), lang)}</p>}
                        </div>
                        {cur.photo && <Image width={400} height={400} className="sf-tree-photo" src={cur.photo.src} alt={pick(cur.photo.alt, lang)} loading="lazy" />}
                        {pick(cur.summary, lang) && <p className="sf-tree-summary">{formatDigits(pick(cur.summary, lang), lang)}</p>}
                        {!!cur.achievements?.length && (
                            <>
                                <h4 className="sf-tree-sub">{ui.achievements}</h4>
                                <ul className="sf-tree-list">{cur.achievements.map((a, q) => <li key={q}>{formatDigits(pick(a, lang), lang)}</li>)}</ul>
                            </>
                        )}
                        {!!cur.stats?.length && (
                            <dl className="sf-tree-stats">
                                {cur.stats.map((s, q) => <div key={q}><dt>{formatDigits(pick(s.label, lang), lang)}</dt><dd>{formatDigits(s.value, lang)}</dd></div>)}
                            </dl>
                        )}
                        {!hasDetail && <p className="sf-tree-summary">{ui.empty(cur.year)}</p>}
                        <div className="sf-tree-nav">
                            <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label={ui.prev}><ChevronLeft size={18} aria-hidden="true" /></button>
                            <input type="range" min={0} max={Math.max(0, total - 1)} value={active} onChange={e => goTo(Number(e.target.value), false)} aria-label={ui.slider} aria-valuetext={formatDigits(milestones[active]?.year ?? milestones[0]?.year ?? MILESTONES[0].year, lang)} />
                            <button type="button" onClick={() => goTo(active + 1)} disabled={active === total - 1} aria-label={ui.next}><ChevronRight size={18} aria-hidden="true" /></button>
                        </div>
                        <p className="sf-tree-hint">{ui.hint}</p>
                    </div>
                    <div>
                        <span className="sf-eyebrow">{plainSectionTitle(eyebrow[lang])}</span>
                        <h2 id="sf-growth-title" className="sf-h2">{plainSectionTitle(heading[lang])}</h2>
                        {section?.introBody?.[lang] && <p className="sf-growth-lead">{section.introBody[lang]}</p>}
                    </div>
                </aside>
            </div>
        </div>
    )
}