'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminLogin } from '@/lib/api/auth'
import Link from 'next/link'

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

type LoginErrors = { email?: string; password?: string }

function validateCredentials(emailValue: string, password: string): LoginErrors {
  const errors: LoginErrors = {}
  const email = emailValue.trim()
  if (!email) errors.email = 'Enter your admin email address.'
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Enter your password.'
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.'
  return errors
}

/* -------------------------------------------------------------------------- */
/* Low-poly 3D scene (pure canvas, no dependencies)                           */
/* -------------------------------------------------------------------------- */

type V3 = [number, number, number]
type Tri = [V3, V3, V3]
type Body = { tris: Tri[]; pos: V3; scale: number; rot: V3; spin: V3; phase: number; tone: number; bob: number; alpha: number }

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

function rotate(p: V3, rx: number, ry: number, rz: number): V3 {
  let [x, y, z] = p
  let c = Math.cos(rx), s = Math.sin(rx);[y, z] = [y * c - z * s, y * s + z * c]
  c = Math.cos(ry); s = Math.sin(ry);[x, z] = [x * c + z * s, -x * s + z * c]
  c = Math.cos(rz); s = Math.sin(rz);[x, y] = [x * c - y * s, x * s + y * c]
  return [x, y, z]
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function icosahedron(): Tri[] {
  const t = (1 + Math.sqrt(5)) / 2
  const v = ([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]] as V3[]).map(norm)
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
  return f.map(([a, b, c]) => [v[a], v[b], v[c]] as Tri)
}

function subdivide(tris: Tri[]): Tri[] {
  return tris.flatMap(([a, b, c]) => {
    const ab = norm(mid(a, b)), bc = norm(mid(b, c)), ca = norm(mid(c, a))
    return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]] as Tri[]
  })
}

function octahedron(stretch: number): Tri[] {
  const p: V3[] = [[1, 0, 0], [-1, 0, 0], [0, stretch, 0], [0, -stretch, 0], [0, 0, 1], [0, 0, -1]]
  const f = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]]
  return f.map(([a, b, c]) => [p[a], p[b], p[c]] as Tri)
}

function tetrahedron(): Tri[] {
  const p: V3[] = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map((q) => norm(q as V3))
  return [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]].map(([a, b, c]) => [p[a], p[b], p[c]] as Tri)
}

function makeBodies(): Body[] {
  const rand = rng(11)
  const gem = subdivide(icosahedron()).map((tri) =>
    tri.map((p) => {
      const r = 1 + 0.16 * Math.sin(p[0] * 5.1 + 1.3) * Math.cos(p[1] * 4.3) + 0.1 * Math.sin(p[2] * 7.7)
      return [p[0] * r, p[1] * r * 1.12, p[2] * r] as V3
    }) as Tri,
  )
  const bodies: Body[] = [{ tris: gem, pos: [0, 0, 0], scale: 1.4, rot: [0.3, 0, 0.1], spin: [0.04, 0.2, 0.03], phase: 0, tone: 0, bob: 0.5, alpha: 1 }]
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2
    const d = 2.2 + rand() * 2.3
    bodies.push({
      tris: i % 3 === 0 ? tetrahedron() : octahedron(1.5 + rand() * 0.9),
      pos: [Math.cos(a) * d, (rand() - 0.5) * 4.4, Math.sin(a) * d * 0.5],
      scale: 0.12 + rand() * 0.28,
      rot: [rand() * 6, rand() * 6, rand() * 6],
      spin: [(rand() - 0.5) * 1.1, (rand() - 0.5) * 1.1, (rand() - 0.5) * 0.6],
      phase: rand() * 6,
      tone: rand(),
      bob: 0.15 + rand() * 0.3,
      alpha: 0.92,
    })
  }
  return bodies
}

const LIGHT = norm([-0.5, -0.65, -0.6])
const VIEW: V3 = [0, 0, -1]
const HALF = norm(add(LIGHT, VIEW))
const CAM = 6

function PolygonScene({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bodies = makeBodies()
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    let w = 0, h = 0, raf = 0

    const draw = (t: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.05
      mouse.y += (mouse.ty - mouse.y) * 0.05
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2, cy = h / 2
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.6)
      glow.addColorStop(0, `rgba(224,31,61,${0.26 + Math.sin(t * 0.9) * 0.05})`)
      glow.addColorStop(1, 'rgba(224,31,61,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      const yaw = mouse.x * 0.4 + Math.sin(t * 0.2) * 0.08
      const pitch = mouse.y * 0.25
      const focal = Math.min(w, h) * 0.95
      const xs = Math.max(0.55, Math.min(1.5, w / h))
      const camPos: V3 = [0, 0, -CAM]
      const faces: { pts: [number, number][]; z: number; fill: string; alpha: number }[] = []

      for (const b of bodies) {
        const r = b.rot.map((v, i) => v + b.spin[i] * t) as V3
        const center = rotate([b.pos[0] * xs, b.pos[1] + Math.sin(t * 0.8 + b.phase) * b.bob, b.pos[2]], pitch, yaw, 0)
        const tr = (p: V3): V3 => add(rotate(rotate([p[0] * b.scale, p[1] * b.scale, p[2] * b.scale], r[0], r[1], r[2]), pitch, yaw, 0), center)
        for (const tri of b.tris) {
          const [p0, p1, p2] = [tr(tri[0]), tr(tri[1]), tr(tri[2])]
          let n = norm(cross(sub(p1, p0), sub(p2, p0)))
          const c: V3 = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3]
          if (dot(n, sub(c, center)) < 0) n = [-n[0], -n[1], -n[2]]
          if (dot(n, sub(c, camPos)) >= 0) continue
          const lam = Math.max(0, dot(n, LIGHT))
          const spec = Math.pow(Math.max(0, dot(n, HALF)), 28)
          const hue = 350 + b.tone * 12
          const sat = b === bodies[0] ? 86 : 62 + b.tone * 28
          const light = 5 + lam * (b === bodies[0] ? 50 : 40) + spec * 34
          const pts = [p0, p1, p2].map((p) => {
            const s = focal / (p[2] + CAM)
            return [cx + p[0] * s, cy - p[1] * s] as [number, number]
          })
          faces.push({ pts, z: c[2], fill: `hsl(${hue} ${sat}% ${light}%)`, alpha: b.alpha })
        }
      }

      faces.sort((a, b) => b.z - a.z)
      ctx.lineJoin = 'round'
      ctx.lineWidth = 0.8
      for (const f of faces) {
        ctx.globalAlpha = f.alpha
        ctx.beginPath()
        ctx.moveTo(f.pts[0][0], f.pts[0][1])
        ctx.lineTo(f.pts[1][0], f.pts[1][1])
        ctx.lineTo(f.pts[2][0], f.pts[2][1])
        ctx.closePath()
        ctx.fillStyle = f.fill
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,128,142,0.2)'
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width; h = rect.height
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduce) draw(2)
    }
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const frame = (ms: number) => { draw(ms / 1000); raf = requestAnimationFrame(frame) }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    if (!reduce) {
      window.addEventListener('pointermove', onMove)
      raf = requestAnimationFrame(frame)
    }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', onMove) }
  }, [])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

const inputClass =
  'h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35 focus-visible:border-[#ff4d5e] focus-visible:ring-[#ff4d5e]/30 aria-invalid:border-[#ff8794]'
const errorClass = 'block text-sm leading-snug text-[#ff8794] [overflow-wrap:anywhere]'

function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center justify-between w-auto p-4 rounded-xl bg-white/25 shadow-[0_8px_30px_-8px_rgba(224,31,61,0.6)]">
      <Link href="https://scarletlabs.tech" className={`flex flex-col rounded-xl p-2 bg-red-900/50 shadow-2xl backdrop-blur-lg ${size === 'lg' ? 'size-24 p-1' : 'size-10 p-2'}`}>
        <Image src="/images/sl-logo.png" alt="Scarlet Labs" width={64} height={64} priority className="h-full w-full object-contain" />
        <span className="font-bold">ScarletLabs</span>
      </Link>
      <span className={`font-semibold tracking-tight text-white ${size === 'lg' ? 'text-4xl' : 'text-lg'}`}> Content Management System</span>
    </div>
  )
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [caps, setCaps] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nextErrors = validateCredentials(email, password)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      document.getElementById(nextErrors.email ? 'email' : 'password')?.focus()
      return
    }

    setBusy(true)
    void adminLogin(email.trim(), password)
      .then(() => {
        toast.success('CMS login successful')
        router.replace('/admin/dashboard')
        router.refresh()
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Login failed')
      })
      .finally(() => setBusy(false))
  }

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'))

  return (
    <main className="relative isolate grid min-h-dvh overflow-hidden bg-[#0d0507] text-[#f6eaec] lg:grid-cols-[57fr_43fr]">
      <style>{`
        @keyframes sl-rise { from { opacity: 0; transform: translateY(18px) scale(.985) } to { opacity: 1; transform: none } }
        .sl-rise { animation: sl-rise .8s cubic-bezier(.2,.7,.2,1) both }
        @media (prefers-reduced-motion: reduce) { .sl-rise { animation: none } }
      `}</style>

      <PolygonScene className="pointer-events-none absolute inset-y-0 left-0 -z-10 h-full w-full opacity-60 lg:w-[57%] lg:opacity-100" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_100%,rgba(224,31,61,0.16),transparent_55%)]" />

      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <Logo size="lg" />
        <div className="max-w-md backdrop-blur-2xl p-4 shadow-2xl rounded-xl">
          <span className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white">
            Welcome To the CMS...
          </span>
          <p className="mt-4 max-w-sm text-pretty text-base leading-relaxed text-white/60">
            Edit site content, manage job vacancies and review applications and submissions.
          </p>
          <p className="mt-4 text-xs text-white/35">© 2026 Scarlet Labs</p>
        </div>
      </section>

      {/* Sign-in panel */}
      <section className="relative grid place-items-center p-5 sm:p-8 lg:border-l lg:border-white/10 lg:bg-black/25 lg:backdrop-blur-sm">
        <div className="sl-rise w-full max-w-110">
          <div className="mb-8 lg:hidden"><Logo /></div>

          <div className="relative rounded-2xl border border-white/10 bg-white/4 p-6 shadow-[0_40px_90px_-30px_rgba(224,31,61,0.45)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-[#ff4d5e]/70 to-transparent" />
            <span className="text-2xl font-semibold tracking-tight text-white">Sign in to continue</span>
            <p className="mt-1.5 text-sm text-white/60">Use your admin account to continue.</p>

            <form onSubmit={submit} noValidate className="mt-7 grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-white/90">Admin email</Label>
                <div className="relative flex items-center">
                  <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 text-white/45" />
                  <Input
                    id="email" type="email" autoComplete="username" value={email} className={inputClass}
                    placeholder="admin@example.com"
                    onChange={(e) => { setEmail(e.target.value); setErrors((c) => ({ ...c, email: undefined })) }}
                    aria-invalid={!!errors.email} aria-describedby={errors.email ? 'admin-email-error' : undefined}
                  />
                </div>
                {errors.email && <small id="admin-email-error" className={errorClass} role="alert">{errors.email}</small>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password" className="text-white/90">Password</Label>
                <div className="relative flex items-center">
                  <LockKeyhole size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 text-white/45" />
                  <Input
                    id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password}
                    className={`${inputClass} pr-11`} placeholder="Enter your password"
                    onChange={(e) => { setPassword(e.target.value); setErrors((c) => ({ ...c, password: undefined })) }}
                    onKeyDown={trackCaps} onKeyUp={trackCaps} onBlur={() => setCaps(false)}
                    aria-invalid={!!errors.password}
                    aria-describedby={[errors.password ? 'admin-password-error' : '', caps ? 'admin-caps-hint' : ''].filter(Boolean).join(' ') || undefined}
                  />
                  <Button
                    variant="ghost" size="icon"
                    type="button" onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
                    className="absolute right-2 grid size-8 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4d5e]"
                  >
                    {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </Button>
                </div>
                {errors.password && <small id="admin-password-error" className={errorClass} role="alert">{errors.password}</small>}
                {caps && <small id="admin-caps-hint" className="block text-sm text-amber-300/90">Caps Lock is on.</small>}
              </div>

              <Button
                type="submit" size="lg" disabled={busy}
                className="group mt-1 h-11 w-full bg-linear-to-r from-[#e01f3d] to-[#a8102c] text-white shadow-[0_12px_30px_-10px_rgba(224,31,61,0.8)] transition hover:brightness-110 focus-visible:ring-[#ff4d5e]/40 disabled:opacity-70"
              >
                {busy ? 'Signing in…' : 'Sign in'}
                <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
