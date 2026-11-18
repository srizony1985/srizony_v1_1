'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminLogin } from '@/lib/api/auth'

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

export default function AdminLoginPage() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nextErrors = validateCredentials(email, password)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

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

  return <main className="admin-auth-page relative min-h-dvh grid place-items-center p-6 overflow-hidden [background:radial-gradient(circle_at_18%_18%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_32%),var(--background)] max-[620px]:p-[max(16px,env(safe-area-inset-top))_12px_max(16px,env(safe-area-inset-bottom))]">
    <div className="admin-auth-orbit absolute w-105 h-105 [border:1px_solid_color-mix(in_srgb,var(--primary)_14%,transparent)] rounded-[50%] orbit-a"/>
    <div className="admin-auth-orbit absolute w-105 h-105 [border:1px_solid_color-mix(in_srgb,var(--primary)_14%,transparent)] rounded-[50%] orbit-b"/>
    <Card className="admin-login-card relative z-2 w-[min(440px,100%)] max-[460px]:**:data-[slot=card-header]:px-4.25 max-[460px]:**:data-[slot=card-content]:px-4.25 max-[620px]:w-[min(440px,100%)]">
      <CardHeader>
        <div className="admin-brand-mark">
          <ShieldCheck size={21} aria-hidden="true"/>
        </div>
        <CardTitle>Srizony CMS</CardTitle>
        <CardDescription>Securely manage bilingual site content, pages and submissions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="admin-form grid gap-4 max-[620px]:gap-3.5" noValidate>
          <div className="admin-form-field grid gap-(--sf-space-2) min-w-0 text-(--foreground,var(--foreground)) font-sans text-[0.875rem] [&_>_label]:text-(--foreground,var(--foreground)) [&_>_label]:font-semibold">
            <Label htmlFor="email">Admin email</Label>
            <div className="admin-input-with-icon relative flex items-center [&>svg]:absolute [&>svg]:left-2.75 [&>svg]:z-1 [&>svg]:text-muted-foreground **:data-[slot=input]:pl-8.75 max-[620px]:**:data-[slot=input]:min-w-0">
              <Mail size={16} aria-hidden="true"/>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={e=>{setEmail(e.target.value);setErrors(current=>({...current,email:undefined}))}} placeholder="admin@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email?'admin-email-error':undefined}/>
            </div>
            {errors.email&&<small id="admin-email-error" className="admin-auth-field-error [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[color:var(--destructive)] [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[font-size:0.875rem] [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[line-height:1.35] [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[overflow-wrap:anywhere] block mt-1.5" role="alert">{errors.email}</small>}
          </div>
          <div className="admin-form-field grid gap-(--sf-space-2) min-w-0 text-(--foreground,var(--foreground)) font-sans text-[0.875rem] [&_>_label]:text-(--foreground,var(--foreground)) [&_>_label]:font-semibold">
            <Label htmlFor="password">Password</Label>
            <div className="admin-input-with-icon relative flex items-center [&>svg]:absolute [&>svg]:left-2.75 [&>svg]:z-1 [&>svg]:text-muted-foreground **:data-[slot=input]:pl-8.75 max-[620px]:**:data-[slot=input]:min-w-0">
              <LockKeyhole size={16} aria-hidden="true"/>
              <Input id="password" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>{setPassword(e.target.value);setErrors(current=>({...current,password:undefined}))}} placeholder="Enter your password" aria-invalid={!!errors.password} aria-describedby={errors.password?'admin-password-error':undefined}/>
              <Button type="button" className="password-toggle" onClick={()=>setShow(v=>!v)} aria-label={show?'Hide password':'Show password'} aria-pressed={show}>
                {show?<EyeOff size={16}/>:<Eye size={16}/>}
              </Button>
            </div>
            {errors.password&&
            <small id="admin-password-error" className="admin-auth-field-error [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[color:var(--destructive)] [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[font-size:0.875rem] [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[line-height:1.35] [&,_.cms-field-error,_.cms-save-error,_.field-error,_.form-error)]:[overflow-wrap:anywhere] block mt-1.5" role="alert">
              {errors.password}
            </small>}
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            {busy?'Signing in…':'Sign in'}
            <ArrowRight size={17} aria-hidden="true"/>
          </Button>
          <p className="admin-login-note m-0 text-[0.75rem] leading-[1.4] text-muted-foreground [&_code]:p-[2px_4px] [&_code]:[background:var(--muted)] [&_code]:[border-radius:calc(var(--radius)-2px)]">
            Set <code>CMS_ADMIN_USERS_JSON</code>
            (or the legacy single-user variables) and either 
            <code>CMS_SESSION_SECRET</code>
            or <code>AUTH_SECRET</code> in your environment.
          </p>
        </form>
      </CardContent>
    </Card>
  </main>
}
