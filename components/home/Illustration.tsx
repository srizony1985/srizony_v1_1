import type { CSSProperties, ReactElement } from 'react'
import { LoanIllustration } from 'react-undraw-illustrations'
import type { IllustrationName } from '@/types/entityType'

export type AreaIcon = 'heart' | 'book' | 'users' | 'coins' | 'sprout' | 'store'
export const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

type IllustrationProps =
  | { name: IllustrationName; label?: string }
  | { kind: 'area'; icon: AreaIcon }
  | { kind: 'growth'; label: string; year: string }
  | { kind: 'mission' | 'vision' | 'values'; label: string }

/** A single prop-driven SVG illustration component shared by homepage sections. */
export default function Illustration(props: IllustrationProps): ReactElement {
  // Named illustrations are the shared CMS-facing registry. Legacy `kind` props
  // remain supported so existing homepage compositions do not need a rewrite.
  if ('name' in props) {
    const name = props.name
    if (name === 'mission' || name === 'vision' || name === 'values') {
      return <Illustration kind={name} label={props.label || name} />
    }
    if (['heart', 'book', 'users', 'coins', 'sprout', 'store'].includes(name)) {
      return <Illustration kind="area" icon={name as AreaIcon} />
    }
    return <LoanIllustration name={name as 'women-business' | 'small-enterprise' | 'agriculture' | 'migrant-household' | 'rural-development' | 'career' | 'education'} className="cms-undraw-illustration" />
  }
  if (props.kind === 'area') {
    const { icon } = props
    switch (icon) {
      case 'heart': return <svg className="ar ar-heart" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="f-s" /><path className="ar-beat f-a" d="M60 96 C22 70 20 40 42 33 C53 30 60 37 60 43 C60 37 67 30 78 33 C100 40 98 70 60 96 Z" /><polyline className="ar-ecg" points="12,62 38,62 48,44 60,84 72,54 80,62 108,62" /></svg>
      case 'users': return <svg className="ar ar-users" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="f-s" /><g className="ar-ring"><circle cx="60" cy="60" r="36" className="il-dash-ring" />{[0, 120, 240].map((a) => <g key={a} transform={`rotate(${a} 60 60)`}><circle cx="60" cy="24" r="9" className="f-p" /><path d="M48 44 a12 10 0 0 1 24 0" className="s-p" /></g>)}</g><circle cx="60" cy="60" r="13" className="f-a ar-beat" /></svg>
      case 'coins': return <svg className="ar ar-coins" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="f-s" />{[0, 1, 2].map((i) => <g key={i} className="ar-coin" style={delay(i * 140)}><path d={`M30 ${88 - i * 17} v9 a30 9 0 0 0 60 0 v-9z`} className="f-g2" /><ellipse cx="60" cy={88 - i * 17} rx="30" ry="9" className="f-g" /></g>)}<path className="ar-up s-p" d="M92 40 L92 18 M82 28 L92 18 L102 28" /></svg>
      case 'sprout': return <svg className="ar ar-sprout" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="f-s" /><circle cx="90" cy="30" r="10" className="f-g ar-sun" /><path className="ar-stem" d="M60 92 C60 76 60 62 60 46" /><path className="ar-leaf ar-leaf--l f-p" d="M60 62 C46 62 36 54 34 42 C48 42 58 48 60 62Z" /><path className="ar-leaf ar-leaf--r f-a" d="M60 52 C74 52 84 44 86 32 C72 32 62 38 60 52Z" /><path d="M28 96 Q60 82 92 96 V104 H28Z" className="f-p2" /></svg>
      case 'store': return <svg className="ar ar-store" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="f-s" /><rect x="30" y="56" width="60" height="38" className="f-w" /><rect x="52" y="68" width="16" height="26" className="f-p" /><rect x="36" y="64" width="12" height="12" className="f-g" /><g className="ar-awning"><path d="M26 56 L32 34 H88 L94 56Z" className="f-a" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${34 + i * 15} 34 L${30 + i * 15} 56 H${38 + i * 15} L${41 + i * 15} 34Z`} className="f-wsoft" />)}</g></svg>
      case 'book': default: return <svg className="ar ar-book" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="f-s" /><path d="M60 40 C48 32 34 32 24 36 V88 C34 84 48 84 60 92Z" className="f-p" /><path d="M60 40 C72 32 86 32 96 36 V88 C86 84 72 84 60 92Z" className="f-a" /><path className="ar-page" d="M60 40 C70 34 80 34 90 38 V84 C80 80 70 80 60 86Z" /><path className="ar-star f-g" d="M60 14 l4 9 l10 1 l-8 7 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -7 l10 -1z" /></svg>
    }
  }

  if (props.kind === 'growth') {
    const branches = ['M200 218 C172 208 152 192 138 170', 'M200 198 C228 188 250 172 262 148', 'M199 176 C176 164 166 142 168 118', 'M200 162 C222 150 236 130 232 106']
    const leaves: [number, number, number, string][] = [[138, 170, 26, 'f-p'], [262, 148, 28, 'f-a'], [168, 118, 24, 'f-g'], [232, 104, 26, 'f-p'], [200, 90, 32, 'f-p2'], [110, 190, 16, 'f-a'], [292, 176, 16, 'f-p'], [150, 140, 14, 'f-g']]
    return <svg className="il il-growth" viewBox="0 0 400 300" role="img" aria-label={props.label}><defs><linearGradient id="il-gbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sf-primary)" stopOpacity="0.05" /><stop offset="1" stopColor="var(--sf-accent)" stopOpacity="0.28" /></linearGradient></defs><rect width="400" height="300" rx="26" fill="url(#il-gbg)" /><circle className="il-sun-halo" cx="326" cy="64" r="24" /><circle className="il-sun" cx="326" cy="64" r="24" style={{ animation: 'none', transform: 'none', opacity: 1 }} /><path className="f-p2" d="M0 262 Q110 240 210 258 T400 246 V300 H0 Z" /><path className="il-draw s-trunk" d="M200 266 C200 226 196 192 200 150 C200 130 202 112 200 96" />{branches.map((d, i) => <path key={d} className="il-draw s-trunk s-trunk--thin" d={d} style={delay(500 + i * 220)} />)}{leaves.map(([x, y, r, c], i) => <circle key={i} cx={x} cy={y} r={r} className={`il-leaf ${c}`} style={delay(1100 + i * 140)} />)}<circle className="il-fruit" cx="232" cy="96" r="4" style={delay(2400)} /><circle className="il-fruit" cx="160" cy="124" r="4" style={delay(2600)} /><circle className="il-fruit" cx="270" cy="152" r="4" style={delay(2800)} /><g><rect x="158" y="268" width="84" height="26" rx="13" className="f-a" /><text x="200" y="286" textAnchor="middle" className="il-year">{props.year}</text></g></svg>
  }

  if (props.kind === 'mission') {
    const steps = [{ x: 40, y: 212, h: 50 }, { x: 126, y: 172, h: 90 }, { x: 212, y: 132, h: 130 }, { x: 298, y: 92, h: 170 }]
    const path = 'M78 200 L164 160 L250 120 L336 80'
    return <svg className="il il-mission" viewBox="0 0 400 300" role="img" aria-label={props.label}><defs><linearGradient id="il-msky" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="var(--sf-primary)" stopOpacity="0.07" /><stop offset="1" stopColor="var(--sf-accent)" stopOpacity="0.22" /></linearGradient></defs><rect width="400" height="300" rx="26" fill="url(#il-msky)" />{steps.map((s, i) => <rect key={s.x} className="il-step" x={s.x} y={s.y} width="76" height={s.h} rx="10" style={delay(i * 180)} />)}<path className="il-path" d={path} /><g className="il-flag"><line x1="336" y1="92" x2="336" y2="34" className="s-ink" /><path className="il-flag-cloth" d="M336 34 l38 11 l-38 13 z" /></g><circle className="il-ring" cx="336" cy="92" r="12" /><circle className="il-ring il-ring--2" cx="336" cy="92" r="12" /><g className="il-walker"><animateMotion dur="5.5s" repeatCount="indefinite" path={path} keyPoints="0;1" keyTimes="0;1" calcMode="linear" /><circle r="6" cy="-16" className="f-a" /><path d="M0 -10 V4 M0 -6 L-6 0 M0 -6 L6 0 M0 4 L-5 12 M0 4 L5 12" className="s-a" /></g></svg>
  }

  if (props.kind === 'vision') {
    const rays = Array.from({ length: 14 }, (_, i) => i * (360 / 14))
    const houses: [number, number][] = [[40, 0], [92, 1], [252, 2], [304, 3], [352, 4]]
    return <svg className="il il-vision" viewBox="0 0 400 300" role="img" aria-label={props.label}><defs><linearGradient id="il-vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sf-accent)" stopOpacity="0.4" /><stop offset="1" stopColor="var(--sf-primary)" stopOpacity="0.06" /></linearGradient></defs><rect width="400" height="300" rx="26" fill="url(#il-vsky)" /><g className="il-rays">{rays.map((a) => <line key={a} x1="200" y1="130" x2="200" y2="108" transform={`rotate(${a} 200 190)`} className="s-g" />)}</g><circle className="il-sun" cx="200" cy="190" r="46" /><circle className="il-sun-halo" cx="200" cy="190" r="46" /><path className="il-bird" d="M60 84 q9 -10 18 0 q9 -10 18 0" /><path className="il-bird il-bird--2" d="M300 62 q7 -8 14 0 q7 -8 14 0" /><circle className="il-star" cx="92" cy="50" r="3" /><circle className="il-star il-star--2" cx="330" cy="120" r="3" /><circle className="il-star il-star--3" cx="140" cy="132" r="2.4" /><path className="f-p" d="M0 238 Q90 208 200 234 T400 222 V300 H0 Z" />{houses.map(([x, i]) => <g key={x} className="il-house" style={delay(300 + i * 160)}><rect x={x} y={216} width="30" height="22" className="f-w" /><path d={`M${x - 3} 216 L${x + 15} 198 L${x + 33} 216 Z`} className="f-a" /><rect x={x + 11} y={224} width="8" height="14" className="il-win" style={delay(i * 260)} /></g>)}<path className="f-p2" d="M0 266 Q120 240 230 260 T400 252 V300 H0 Z" /></svg>
  }

  const nodes = Array.from({ length: 6 }, (_, i) => i * 60)
  return <svg className="il il-values" viewBox="0 0 400 300" role="img" aria-label={props.label}><defs><linearGradient id="il-vbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--sf-accent)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--sf-primary)" stopOpacity="0.1" /></linearGradient></defs><rect width="400" height="300" rx="26" fill="url(#il-vbg)" /><circle cx="200" cy="150" r="116" className="il-dash-ring" /><g className="il-orbit">{nodes.map((a, i) => <circle key={a} cx="200" cy="34" r="9" transform={`rotate(${a} 200 150)`} className={i % 2 ? 'f-g' : 'f-p'} />)}</g><path className="il-shield" d="M200 52 L270 76 V140 C270 190 234 222 200 240 C166 222 130 190 130 140 V76 Z" /><line x1="200" y1="100" x2="200" y2="212" className="s-w" strokeWidth="5" strokeLinecap="round" /><rect x="168" y="212" width="64" height="9" rx="4" className="f-w" /><g className="il-beam"><line x1="130" y1="102" x2="270" y2="102" className="s-w" strokeWidth="6" strokeLinecap="round" /><circle cx="200" cy="102" r="7" className="f-g" /><g><path d="M130 102 L112 158 M130 102 L148 158" className="s-w" strokeWidth="2" /><path d="M104 158 h52 q-26 28 -52 0z" className="f-w" /></g><g><path d="M270 102 L252 158 M270 102 L288 158" className="s-w" strokeWidth="2" /><path d="M244 158 h52 q-26 28 -52 0z" className="f-w" /></g></g><path className="il-check" d="M176 176 l16 16 l34 -38" /></svg>
}
