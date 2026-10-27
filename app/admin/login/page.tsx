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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nextErrors = validateCredentials(email, password)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setBusy(true)
    try {
      await adminLogin(email.trim(), password)
      toast.success('CMS login successful')
      router.replace('/admin/dashboard')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return <main className="admin-auth-page"><div className="admin-auth-orbit orbit-a"/><div className="admin-auth-orbit orbit-b"/><Card className="admin-login-card"><CardHeader><div className="admin-brand-mark"><ShieldCheck size={21} aria-hidden="true"/></div><CardTitle>Srizony CMS</CardTitle><CardDescription>Securely manage bilingual content, theme tokens and submissions.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="admin-form" noValidate>
    <div className="admin-form-field"><Label htmlFor="email">Admin email</Label><div className="admin-input-with-icon"><Mail size={16} aria-hidden="true"/><Input id="email" type="email" autoComplete="username" value={email} onChange={e=>{setEmail(e.target.value);setErrors(current=>({...current,email:undefined}))}} placeholder="admin@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email?'admin-email-error':undefined}/></div>{errors.email&&<small id="admin-email-error" className="admin-auth-field-error" role="alert">{errors.email}</small>}</div>
    <div className="admin-form-field"><Label htmlFor="password">Password</Label><div className="admin-input-with-icon"><LockKeyhole size={16} aria-hidden="true"/><Input id="password" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>{setPassword(e.target.value);setErrors(current=>({...current,password:undefined}))}} placeholder="Enter your password" aria-invalid={!!errors.password} aria-describedby={errors.password?'admin-password-error':undefined}/><button type="button" className="password-toggle" onClick={()=>setShow(v=>!v)} aria-label={show?'Hide password':'Show password'} aria-pressed={show}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>{errors.password&&<small id="admin-password-error" className="admin-auth-field-error" role="alert">{errors.password}</small>}</div>
    <Button type="submit" size="lg" disabled={busy}>{busy?'Signing in…':'Sign in'}<ArrowRight size={17} aria-hidden="true"/></Button><p className="admin-login-note">Set <code>CMS_ADMIN_USERS_JSON</code> (or the legacy single-user variables) and either <code>CMS_SESSION_SECRET</code> or <code>AUTH_SECRET</code> in your environment.</p>
  </form></CardContent></Card></main>
}
