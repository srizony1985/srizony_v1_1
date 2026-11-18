'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lang } from '@/types/entityType'
import { layoutTree } from '@/lib/growthTreeLayout'
import { MILESTONES, normalizeGrowthMilestones, pick, type Milestone } from '@/lib/GrowthMilestones'
import Image from 'next/image'

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
        tree: 'Timeline tree of Srizony Foundation, 1985 to 2026. Scroll or select a branch to read about each year.',
        yearOf: (n: number, total: number) => `Year ${n} of ${total}`,
        prev: 'Previous year',
        next: 'Next year',
        slider: 'Choose a year',
        hint: 'Scroll to travel through the years, or select a branch.',
        empty: (y: number) => `The record for ${y} is being added.`,
        achievements: 'Key achievements',
        branch: (y: number) => `Branch for ${y}`,
    },
    bn: {
        tree: 'শ্রীজনি ফাউন্ডেশনের ১৯৮৫ থেকে ২০২৬ পর্যন্ত টাইমলাইন গাছ। স্ক্রল করুন বা কোনো শাখা নির্বাচন করুন।',
        yearOf: (n: number, total: number) => `${formatDigits(total, 'bn')} বছরের মধ্যে ${formatDigits(n, 'bn')} নম্বর`,
        prev: 'আগের বছর',
        next: 'পরের বছর',
        slider: 'বছর বেছে নিন',
        hint: 'বছরগুলো দেখতে স্ক্রল করুন, অথবা কোনো শাখা বেছে নিন।',
        empty: (y: number) => `${formatDigits(y, 'bn')} সালের তথ্য যুক্ত করা হচ্ছে।`,
        achievements: 'প্রধান অর্জন',
        branch: (y: number) => `${formatDigits(y, 'bn')} সালের শাখা`,
    },
} as const
type UIText = (typeof UI)['en']
const getUI = (lang: Lang): UIText => ((UI as Record<string, unknown>)[lang] ?? UI.en) as UIText

/* ---------- geometry ---------- */
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

type Leaf = { x: number; y: number; rx: number; ry: number; rot: number; tone: 1 | 2 | 3 }
type Fruit = { x: number; y: number }

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

    const nodes = milestones.map((m, i) => {
        const rnd = mulberry(m.year * 97)
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

        const leaves: Leaf[] = []
        const twigs = 1 + Math.floor(i / 10)
        for (let q = 0; q < twigs; q++) {
            const [px, py] = bez(pts, 0.4 + rnd() * 0.45)
            leaves.push({
                x: stable(px + (rnd() - 0.5) * 8),
                y: stable(py + (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 5)),
                rx: stable(6 + rnd() * 3),
                ry: stable(3 + rnd() * 1.5),
                rot: stable(rnd() * 180),
                tone: (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3,
            })
        }
        const cluster = 2 + Math.floor(i / 8)
        for (let q = 0; q < cluster; q++) {
            const a = rnd() * Math.PI * 2
            const rr = r + 2 + rnd() * 9
            leaves.push({
                x: stable(ex + Math.cos(a) * rr),
                y: stable(ey + Math.sin(a) * rr),
                rx: stable(7 + rnd() * 4),
                ry: stable(3.5 + rnd() * 2),
                rot: stable((a * 180) / Math.PI),
                tone: (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3,
            })
        }

        const fruit: Fruit[] = []
        if (m.featured ?? i % 5 === 0) {
            const a0 = rnd() * Math.PI * 2
            for (let q = 0; q < 3; q++) {
                fruit.push({
                    x: stable(ex + Math.cos(a0 + q * 2.1) * (r + 7)),
                    y: stable(ey + Math.sin(a0 + q * 2.1) * (r + 7)),
                })
            }
        }

        const denominator = Math.max(1, n - 1)
        return { i, m, d, ex, ey, leaves, fruit, width: stable((5 - (i / denominator) * 2.4) * k) }
    })

    const topY = stable(cy - 12)
    const left: string[] = []
    const right: string[] = []
    const samples = 24
    for (let s = 0; s <= samples; s++) {
        const y = stable(base + 8 - ((base + 8 - topY) * s) / samples)
        const half = stable((15 - 9 * (s / samples) + (s < 3 ? 4 - s * 1.3 : 0)) * k)
        const centerX = stable(cx + sway(y))
        left.push(`${stable(centerX - half)},${y}`)
        right.unshift(`${stable(centerX + half)},${y}`)
    }
    const trunk = `M${left.join(' L')} L${right.join(' L')} Z`
    const roots = [-1, 1, -0.5, 0.55].map((s, idx) => {
        const len = stable((60 + idx * 14) * k)
        return `M${cx} ${stable(base + 2)} C${stable(cx + s * 20)} ${stable(base + 16)} ${stable(cx + s * len * 0.6)} ${stable(base + 20)} ${stable(cx + s * len)} ${stable(base + 30 + (idx % 2) * 4)}`
    })

    return { ...L, nodes, trunk, roots, r, fs: compact ? 9.5 : 10, k }
}

/* ---------- component ---------- */
export default function GrowthTree({ lang }: { lang: Lang }) {
    const ui = getUI(lang)
    const wrapRef = useRef<HTMLDivElement | null>(null)
    const stickyRef = useRef<HTMLDivElement | null>(null)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const lockUntil = useRef(0)
    const [compact, setCompact] = useState(false)
    const [milestones, setMilestones] = useState<Milestone[]>(MILESTONES)
    const [active, setActive] = useState(0) // driven by scroll position
    const [preview, setPreview] = useState<number | null>(null) // hover / focus only
    const total = milestones.length

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

    const onNodeKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            goTo(i)
        } else if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) {
            e.preventDefault()
            const j = Math.min(total - 1, Math.max(0, i + (e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1)))
            document.getElementById(`sf-tree-node-${j}`)?.focus()
        }
    }

    const shown = preview ?? active
    const cur = milestones[shown] ?? milestones[0] ?? MILESTONES[0]
    const hasDetail = Boolean(cur.title || cur.summary || cur.achievements?.length || cur.stats?.length || cur.photo)

    return (
        <div className="sf-tree" ref={wrapRef} style={{ '--n': total } as CSSProperties}>
            <div className="sf-tree-sticky" ref={stickyRef}>
                <div className="sf-tree-stage" ref={stageRef}>
                    <svg
                        viewBox={`0 0 ${tree.W} ${tree.H}`}
                        role="group"
                        aria-label={ui.tree}
                        className="sf-tree-svg"
                        style={{ '--p': total > 1 ? active / (total - 1) : 0 } as CSSProperties}
                    >
                        <ellipse cx={tree.cx} cy={tree.cy} rx={tree.a + 14} ry={tree.b + 14} className="sf-tree-halo" />
                        <line x1="0" x2={tree.W} y1={tree.base + 10} y2={tree.base + 10} className="sf-tree-ground" />
                        <g>{tree.roots.map((d, q) => <path key={q} d={d} className="sf-tree-root" />)}</g>
                        <path d={tree.trunk} className="sf-tree-trunk" />

                        {tree.nodes.map(({ i, m, d, leaves, fruit, width }) => {
                            const past = i <= active
                            return (
                                <g key={m.year} className={`sf-tree-branch${past ? ' is-past' : ''}${i === shown ? ' is-active' : ''}`}>
                                    <path d={d} className="sf-tree-ghost" />
                                    <path d={d} pathLength={1} className="sf-tree-limb" strokeWidth={width} />
                                    <g className="sf-tree-foliage">
                                        {leaves.map((l, q) => (
                                            <ellipse key={q} cx={l.x} cy={l.y} rx={l.rx} ry={l.ry} transform={`rotate(${l.rot} ${l.x} ${l.y})`} className={`sf-tree-leaf t${l.tone}`} />
                                        ))}
                                        {fruit.map((f, q) => <circle key={q} cx={f.x} cy={f.y} r="3.2" className="sf-tree-fruit" />)}
                                    </g>
                                </g>
                            )
                        })}

                        {tree.nodes.map(({ i, m, ex, ey }) => (
                            <g
                                key={m.year}
                                id={`sf-tree-node-${i}`}
                                className={`sf-tree-node${i <= active ? ' is-past' : ''}${i === shown ? ' is-active' : ''}`}
                                transform={`translate(${ex} ${ey})`}
                                role="button"
                                tabIndex={0}
                                aria-label={ui.branch(m.year)}
                                aria-pressed={i === shown}
                                onPointerEnter={e => e.pointerType === 'mouse' && setPreview(i)}
                                onPointerLeave={() => setPreview(null)}
                                onFocus={() => setPreview(i)}
                                onBlur={() => setPreview(null)}
                                onClick={() => { setPreview(null); goTo(i) }}
                                onKeyDown={e => onNodeKey(e, i)}
                            >
                                <circle r={tree.r + 3} className="sf-tree-hit" />
                                <g className="sf-tree-disc">
                                    <circle r={tree.r} className="sf-tree-bud" />
                                    <text className="sf-tree-year" fontSize={tree.fs} textAnchor="middle" dominantBaseline="central">{formatDigits(m.year, lang)}</text>
                                </g>
                            </g>
                        ))}
                    </svg>
                </div>

                <aside className="sf-tree-panel" aria-live="polite">
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
                </aside>
            </div>
        </div>
    )
}
