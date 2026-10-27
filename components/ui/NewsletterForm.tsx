'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import LogoLoader from '@/components/ui/LogoLoader'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSite } from '@/components/containers/SiteProvider'
import { confirmNewsletter, getNewsletterStatus, requestNewsletterCode } from '@/lib/api/public'

const newsletterSchema = z.object({ email: z.string().trim().email('Please enter a valid email address.').max(254, 'Email address must be 254 characters or fewer.') })
type Status = 'subscribed'|'unsubscribed'|'not_subscribed'|'unknown'|null

export default function NewsletterForm(){
 const {lang,profile}=useSite()
 const [email,setEmail]=useState('')
 const [busy,setBusy]=useState(false)
 const [consent,setConsent]=useState(false)
 const [status,setStatus]=useState<Status>(null)
 const [unsubscribeUrl,setUnsubscribeUrl]=useState('')
 const [verificationSent,setVerificationSent]=useState(false)
 const [verificationCode,setVerificationCode]=useState('')
 const [validationError,setValidationError]=useState('')
 const [consentError,setConsentError]=useState('')
 useEffect(()=>{if(profile&&!email)setEmail(profile.email)},[profile,email])
 useEffect(()=>{
   const parsed=newsletterSchema.safeParse({email})
   if(!parsed.success || !profile || parsed.data.email.toLowerCase()!==profile.email.toLowerCase()){setStatus(null);setUnsubscribeUrl('');return}
   const controller=new AbortController()
   const timer=window.setTimeout(()=>{
     void getNewsletterStatus(email.trim(),controller.signal)
       .then(res=>{if(!res.ok)throw new Error('status');return res.data as {status:Status;unsubscribeUrl?:string}})
       .then(data=>{setStatus(data.status);setUnsubscribeUrl(data.unsubscribeUrl||'')})
       .catch(error=>{if(error?.name!=='AbortError')setStatus(null)})
   },450)
   return()=>{window.clearTimeout(timer);controller.abort()}
 },[email])
 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setValidationError('')
   const parsed=newsletterSchema.safeParse({email})
   if(!parsed.success){setValidationError(parsed.error.issues[0]?.message||'Enter a valid email address.');return}
   if(!consent){setConsentError(lang==='en'?'Please agree to receive newsletter updates.':'নিউজলেটার আপডেট পেতে সম্মতি দিন।');return}
   if(verificationSent&&!/^\d{6}$/.test(verificationCode)){setValidationError(lang==='en'?'Enter the six-digit verification code.':'ছয় অংকের যাচাইকরণ কোড দিন।');return}
   setBusy(true)
   try{
     if(!verificationSent){
       const res=await requestNewsletterCode(parsed.data.email)
       const data=res.data;if(!res.ok)throw new Error(data.error?.message || data.error || 'Unable to send verification code.')
       setVerificationSent(true)
       toast.success(lang==='en'?'Verification code sent. Check your email.':'যাচাইকরণ কোড পাঠানো হয়েছে। ইমেইল দেখুন।')
     }else{
       const res=await confirmNewsletter(parsed.data.email,verificationCode)
       const data=res.data;if(!res.ok)throw new Error(data.error?.message || data.error || 'Unable to subscribe.')
       setStatus('subscribed');setUnsubscribeUrl(data.unsubscribeUrl||'');setVerificationSent(false);setVerificationCode('')
       toast.success(lang==='en'?'Newsletter subscription confirmed.':'নিউজলেটার সাবস্ক্রিপশন নিশ্চিত হয়েছে।')
     }
   }catch(e){toast.error(e instanceof Error?e.message:(lang==='en'?'Unable to subscribe.':'সাবস্ক্রাইব করা যায়নি.'))}finally{setBusy(false)}
 }
 if(status==='subscribed') return <div className="newsletter-form newsletter-success" aria-live="polite"><div><strong><CheckCircle2 size={16}/>{lang==='en'?'Newsletter active':'নিউজলেটার সক্রিয়'}</strong><span>{lang==='en'?`Updates will be sent to ${email}.`:`${email} ঠিকানায় আপডেট পাঠানো হবে।`}</span></div>{unsubscribeUrl&&<a href={unsubscribeUrl}>{lang==='en'?'Unsubscribe anytime':'যেকোনো সময় আনসাবস্ক্রাইব করুন'}</a>}</div>
 if(status==='unsubscribed') return <div className="newsletter-form newsletter-success" aria-live="polite"><div><strong>{lang==='en'?'Currently unsubscribed':'বর্তমানে আনসাবস্ক্রাইব করা'}</strong><span>{lang==='en'?'This email is not receiving newsletter updates. Submit below to subscribe again.':'এই ইমেইলে এখন নিউজলেটার পাঠানো হচ্ছে না। আবার সাবস্ক্রাইব করতে নিচে জমা দিন।'}</span></div><button type="button" className="btn primary" onClick={()=>setStatus(null)}>{lang==='en'?'Subscribe again':'আবার সাবস্ক্রাইব করুন'}</button></div>
 return <form className="newsletter-form" onSubmit={submit} noValidate><div><span>{verificationSent ? (lang==='en'?'Enter the six-digit code sent to your email.':'ইমেইলে পাঠানো ছয় অংকের কোড দিন।') : (lang==='en'?'News, reports and community updates.':'সংবাদ, প্রতিবেদন ও কমিউনিটি আপডেট।')}</span></div><div className="newsletter-input"><input type={verificationSent?'text':'email'} inputMode={verificationSent?'numeric':'email'} value={verificationSent?verificationCode:email} onChange={e=>{if(verificationSent){setVerificationCode(e.target.value.replace(/\D/g,'').slice(0,6));setValidationError('')}else{setEmail(e.target.value);setValidationError('')}}} placeholder={verificationSent?'123456':(lang==='en'?'Email address':'ইমেইল ঠিকানা')} aria-label={verificationSent?'Verification code':(lang==='en'?'Email address':'ইমেইল ঠিকানা')} aria-invalid={!!validationError} aria-describedby={validationError?'newsletter-input-error':undefined} autoComplete={verificationSent?'one-time-code':'email'}/><button aria-label={verificationSent?(lang==='en'?'Confirm subscription':'সাবস্ক্রিপশন নিশ্চিত করুন'):(lang==='en'?'Send verification code':'যাচাইকরণ কোড পাঠান')} disabled={busy}>{busy?<LogoLoader size="sm" inline label="" />:verificationSent?<CheckCircle2 size={16}/>:<ArrowRight size={16}/>}</button></div>{validationError&&<small id="newsletter-input-error" className="newsletter-error" role="alert">{validationError}</small>}{!verificationSent&&<label className="newsletter-consent"><input type="checkbox" checked={consent} aria-invalid={!!consentError} aria-describedby={consentError?'newsletter-consent-error':undefined} onChange={e=>{setConsent(e.target.checked);setConsentError('')}}/><ShieldCheck size={15}/><span>{lang==='en'?'I agree to receive newsletter updates and can unsubscribe at any time.':'আমি নিউজলেটার আপডেট পেতে সম্মতি দিচ্ছি এবং যেকোনো সময় আনসাবস্ক্রাইব করতে পারি।'}</span></label>}{consentError&&<small id="newsletter-consent-error" className="newsletter-error" role="alert">{consentError}</small>}{verificationSent&&<button type="button" className="btn ghost" onClick={()=>{setVerificationSent(false);setVerificationCode('')}}>{lang==='en'?'Use another email':'অন্য ইমেইল ব্যবহার করুন'}</button>}</form>
}
