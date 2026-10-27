'use client'

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Landmark,
  LockKeyhole,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import { localizeDigits } from '@/lib/utils'
import LogoLoader from '@/components/ui/LogoLoader'
import CountryCodeSelect, { type CountryCode } from '@/components/ui/CountryCodeSelect'
import { PaymentMethod } from '@/types/entityType'
import s from '@/app/css_extra/DonationForm.module.css'
import { initiateDonation } from '@/lib/api/public'

const amounts = ['500', '1000', '2500', '5000']
const MIN_AMOUNT = 10

const iconMap: Record<string, ComponentType<{ size?: number }>> = {
  cards: CreditCard,
  all: WalletCards,
  bkash: Smartphone,
  nagad: Smartphone,
  rocket: Smartphone,
  mobile: Smartphone,
  internet: Landmark,
}

type ResultKind = 'success' | 'cancelled' | 'failed'

type FieldErrors = {
  name?: string
  email?: string
  phone?: string
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+880', country: 'BD', label: 'Bangladesh (+880)' },
  { code: '+91', country: 'IN', label: 'India (+91)' },
  { code: '+92', country: 'PK', label: 'Pakistan (+92)' },
  { code: '+971', country: 'AE', label: 'UAE (+971)' },
  { code: '+966', country: 'SA', label: 'Saudi Arabia (+966)' },
  { code: '+974', country: 'QA', label: 'Qatar (+974)' },
  { code: '+965', country: 'KW', label: 'Kuwait (+965)' },
  { code: '+973', country: 'BH', label: 'Bahrain (+973)' },
  { code: '+44', country: 'GB', label: 'United Kingdom (+44)' },
  { code: '+1', country: 'US', label: 'United States (+1)' },
  { code: '+1', country: 'CA', label: 'Canada (+1)' },
  { code: '+61', country: 'AU', label: 'Australia (+61)' },
  { code: '+60', country: 'MY', label: 'Malaysia (+60)' },
  { code: '+65', country: 'SG', label: 'Singapore (+65)' },
  { code: '+49', country: 'DE', label: 'Germany (+49)' },
  { code: '+33', country: 'FR', label: 'France (+33)' },
  { code: '+81', country: 'JP', label: 'Japan (+81)' },
  { code: '+82', country: 'KR', label: 'South Korea (+82)' },
]

const DEFAULT_COUNTRY_ISO = 'BD'
const DEFAULT_COUNTRY_CODE = '+880'

/** Smoothly tweens a number; jumps instantly when the user prefers reduced motion. */
function useAnimatedNumber(target: number, duration = 450) {
  const [value, setValue] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduce || !Number.isFinite(target)) {
      from.current = target
      setValue(target)
      return
    }

    const start = performance.now()
    const begin = from.current
    let raf = 0

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = begin + (target - begin) * eased
      from.current = v
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

const group = (n: number | string) => {
  const num = Number(n)
  return Number.isFinite(num) ? num.toLocaleString('en-US') : String(n)
}

/** TypeScript-side email validation (browser `required` validation is not used). */
function isValidEmail(value: string): boolean {
  const email = value.trim()
  if (!email || email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

/** Subscriber number only — the country code is selected separately. */
function isValidPhone(value: string): boolean {
  return /^\d{6,15}$/.test(value)
}

function isValidName(value: string): boolean {
  const name = value.trim()
  if (name.length < 2 || name.length > 100) return false
  if (/[\u0000-\u001F\u007F]/.test(name)) return false
  return true
}

/**
 * Convert a stored profile phone into ISO country + subscriber number.
 * +8801712345678 -> BD / 1712345678
 * 01712345678    -> BD / 1712345678
 */
function splitProfilePhone(phone?: string | null): { iso: string; number: string } {
  if (!phone) return { iso: DEFAULT_COUNTRY_ISO, number: '' }

  const raw = phone.trim()

  const match = COUNTRY_CODES.slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => raw.startsWith(item.code))

  if (match) {
    return {
      iso: match.country,
      number: raw.slice(match.code.length).replace(/\D/g, ''),
    }
  }

  const digits = raw.replace(/\D/g, '')

  // A leading zero is treated as a Bangladesh local number.
  if (digits.startsWith('0')) {
    return { iso: DEFAULT_COUNTRY_ISO, number: digits.slice(1) }
  }

  return { iso: DEFAULT_COUNTRY_ISO, number: digits }
}

export default function DonationForm() {
  const { lang, site, profile } = useSite()

  const ui = site?.global.ui
  const methods = site?.global.donationInfo || []

  const [amount, setAmount] = useState('1000')
  const [custom, setCustom] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cards')

  /** Anonymous is the default mode. */
  const [anonymous, setAnonymous] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  /** ISO code (unique) — dial code is derived, since US and CA both use +1. */
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO)
  const [message, setMessage] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const methodRefs = useRef<Array<HTMLButtonElement | null>>([])

  const countryCode =
    COUNTRY_CODES.find((c) => c.country === countryIso)?.code ?? DEFAULT_COUNTRY_CODE

  /**
   * Autofill profile details ONLY for an identified donation.
   * Anonymous donations never receive profile donor information.
   */
  useEffect(() => {
    if (!profile || anonymous) return

    setName((value) => value || profile.name)
    setEmail((value) => value || profile.email)

    if (!phone) {
      const parsed = splitProfilePhone(profile.phone)
      setCountryIso(parsed.iso)
      setPhone(parsed.number)
    }
  }, [profile, anonymous, phone])

  /**
   * Switching to anonymous erases every donor field so personal
   * information can never be retained or sent by accident.
   */
  useEffect(() => {
    if (!anonymous) return

    setName('')
    setEmail('')
    setPhone('')
    setCountryIso(DEFAULT_COUNTRY_ISO)
    setMessage('')
    setFieldErrors({})
  }, [anonymous])

  /** Read payment status from the callback URL. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const st = q.get('donation')
    if (st) setStatus(st)
  }, [])

  const displayAmount = amount === 'custom' ? custom : amount
  const numeric = Number(displayAmount)
  const validNumber = Number.isFinite(numeric) && displayAmount !== ''
  const animated = useAnimatedNumber(validNumber ? numeric : 0)

  const shownTotal = !validNumber
    ? '0'
    : Number.isInteger(numeric)
      ? group(Math.round(animated))
      : displayAmount

  const customTooLow =
    amount === 'custom' &&
    custom !== '' &&
    (!Number.isFinite(numeric) || numeric < MIN_AMOUNT)

  const selected = methods.find((x) => x.id === method) ?? methods[0]

  if (!ui || !selected) return null

  const t = (en: string, bn: string) => (lang === 'en' ? en : bn)
  const fmt = (v: string) => localizeDigits(v, lang)

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      return { ...current, [field]: undefined }
    })
  }

  /** Donor/contact validation applies ONLY to identified donations. */
  function validateForm(): boolean {
    if (anonymous) {
      setFieldErrors({})
      return true
    }

    const next: FieldErrors = {}

    if (!isValidName(name)) {
      next.name = t('Please enter your full name.', 'আপনার পূর্ণ নাম লিখুন।')
    }
    if (!isValidEmail(email)) {
      next.email = t('Please enter a valid email address.', 'সঠিক ইমেইল ঠিকানা লিখুন।')
    }
    if (!isValidPhone(phone)) {
      next.phone = t(
        'Please enter a valid mobile number using digits only.',
        'শুধু সংখ্যা ব্যবহার করে একটি সঠিক মোবাইল নম্বর লিখুন।',
      )
    }

    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function startPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return

    setError('')

    const value = Number(displayAmount)

    if (!Number.isFinite(value) || value < MIN_AMOUNT) {
      setError(t('Minimum online donation is ৳10.', 'অনলাইন দানের সর্বনিম্ন পরিমাণ ৳১০।'))
      return
    }

    if (!validateForm()) {
      setError(
        t(
          'Please correct the highlighted fields before continuing.',
          'এগিয়ে যাওয়ার আগে চিহ্নিত তথ্যগুলো ঠিক করুন।',
        ),
      )
      return
    }

    /**
     * Anonymous: no name/email/phone/message is sent at all.
     * Identified: validated donor information is included.
     */
    const payload = anonymous
      ? { amount: value, method, anonymous: true }
      : {
          amount: value,
          method,
          anonymous: false,
          name: name.trim(),
          email: email.trim(),
          phone: `${countryCode}${phone}`,
          message: message.trim(),
        }

    setLoading(true)

    try {
      const { ok, data } = await initiateDonation(payload)

      if (!ok || !data.url) {
        throw new Error(data.error || 'Unable to start payment')
      }

      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start payment.')
      setLoading(false)
    }
  }

  function resetStatus() {
    const url = new URL(window.location.href)
    url.searchParams.delete('donation')
    window.history.replaceState(null, '', url.toString())
    setStatus(null)
  }

  /** Arrow-key navigation inside the payment radiogroup. */
  function onMethodKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(e.key)) return

    e.preventDefault()

    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
    const next = (index + dir + methods.length) % methods.length

    setMethod(methods[next].id as PaymentMethod)
    methodRefs.current[next]?.focus()
  }

  if (status === 'success' || status === 'cancelled' || status === 'failed') {
    const kind = status as ResultKind

    const cfg = {
      success: {
        Icon: CheckCircle2,
        tone: 'var(--sf-success)',
        title: t('Donation completed', 'দান সফল হয়েছে'),
        text: t(
          'Thank you. Your payment was validated by the payment gateway.',
          'ধন্যবাদ। পেমেন্ট গেটওয়ের মাধ্যমে আপনার লেনদেন যাচাই হয়েছে।',
        ),
        btn: t('Make another donation', 'আরেকটি দান করুন'),
      },
      cancelled: {
        Icon: AlertCircle,
        tone: 'var(--sf-warning)',
        title: t('Donation cancelled', 'দান বাতিল হয়েছে'),
        text: t(
          'No payment was captured. You can try again.',
          'কোনো পেমেন্ট গ্রহণ করা হয়নি। আবার চেষ্টা করতে পারেন।',
        ),
        btn: t('Try again', 'আবার চেষ্টা করুন'),
      },
      failed: {
        Icon: XCircle,
        tone: 'var(--sf-danger)',
        title: t('Payment failed', 'পেমেন্ট ব্যর্থ হয়েছে'),
        text: t(
          'The gateway did not confirm the donation. Please try another method.',
          'গেটওয়ে দানটি নিশ্চিত করতে পারেনি। অন্য পদ্ধতি চেষ্টা করুন।',
        ),
        btn: t('Try again', 'আবার চেষ্টা করুন'),
      },
    }[kind]

    const { Icon } = cfg

    return (
      <div className={s.result} role="status" aria-live="polite">
        <div className={s.resultIcon} style={{ ['--tone' as string]: cfg.tone }}>
          <Icon size={42} />
        </div>
        <h3>{cfg.title}</h3>
        <p>{cfg.text}</p>
        <button type="button" className={s.resultBtn} onClick={resetStatus}>
          <RotateCcw size={16} />
          {cfg.btn}
        </button>
      </div>
    )
  }

  return (
    <form className={s.form} onSubmit={startPayment} noValidate aria-busy={loading}>
      <div className={s.head}>
        <div className={s.art} aria-hidden="true">
          <div className={`${s.orbit} ${s.orbitA}`} />
          <div className={`${s.orbit} ${s.orbitB}`} />
          <div className={s.artCard}>
            <CreditCard size={24} />
            <span>৳</span>
          </div>
          <div className={s.heart}>♥</div>
        </div>

        <div className={s.intro}>
          <div className={s.secure}>
            <ShieldCheck size={15} />
            <span>{t('Secure online donation', 'নিরাপদ অনলাইন দান')}</span>
          </div>
          <h3>{t('Make a Difference', 'অর্থবহ অবদান রাখুন')}</h3>
          <p>
            {t(
              'Choose an amount and continue through secure SSLCOMMERZ checkout.',
              'পরিমাণ নির্বাচন করে নিরাপদ SSLCOMMERZ চেকআউটের মাধ্যমে এগিয়ে যান।',
            )}
          </p>
        </div>
      </div>

      <div className={s.layout}>
        <div className={s.main}>
          {/* 1 — amount */}
          <section
            className={s.step}
            style={{ ['--i' as string]: 0 }}
            aria-labelledby="don-amount"
          >
            <div className={s.stepHead}>
              <span className={s.stepNum}>1</span>
              <div>
                <strong id="don-amount">{t('Donation amount', 'দানের পরিমাণ')}</strong>
                <span className={s.sub}>
                  {t(
                    'Select a preset or enter your own amount.',
                    'একটি নির্ধারিত বা নিজের পরিমাণ নির্বাচন করুন।',
                  )}
                </span>
              </div>
            </div>

            <div className={s.amounts} role="group" aria-labelledby="don-amount">
              {amounts.map((x) => (
                <button
                  type="button"
                  key={x}
                  className={`${s.chip} ${amount === x ? s.chipOn : ''}`}
                  aria-pressed={amount === x}
                  onClick={() => {
                    setAmount(x)
                    setCustom('')
                  }}
                >
                  <span className={s.cur}>৳</span>
                  <span>{fmt(group(x))}</span>
                </button>
              ))}

              <button
                type="button"
                className={`${s.chip} ${amount === 'custom' ? s.chipOn : ''}`}
                aria-pressed={amount === 'custom'}
                onClick={() => setAmount('custom')}
              >
                <span aria-hidden="true">+</span>
                <span>{ui[lang].custom}</span>
              </button>
            </div>

            <div
              className={`${s.customWrap} ${amount === 'custom' ? s.customWrapOpen : ''}`}
              aria-hidden={amount !== 'custom'}
            >
              <div className={s.customInner}>
                <div className={s.customField}>
                  <span>৳</span>
                  <input
                    inputMode="decimal"
                    value={custom}
                    onChange={(e) => {
                      // digits and a single decimal point only
                      const v = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
                      setCustom(v)
                    }}
                    placeholder={ui[lang].amount}
                    aria-label={ui[lang].amount}
                    aria-invalid={customTooLow}
                    aria-describedby="don-custom-hint"
                    tabIndex={amount === 'custom' ? 0 : -1}
                  />
                </div>

                <p
                  id="don-custom-hint"
                  className={`${s.fieldHint} ${customTooLow ? s.fieldError : ''}`}
                  role={customTooLow ? 'alert' : undefined}
                >
                  {customTooLow
                    ? t('Minimum online donation is ৳10.', 'অনলাইন দানের সর্বনিম্ন পরিমাণ ৳১০।')
                    : t('Minimum ৳10.', 'সর্বনিম্ন ৳১০।')}
                </p>
              </div>
            </div>
          </section>

          {/* 2 — payment method */}
          <fieldset className={s.step} style={{ ['--i' as string]: 1 }}>
            <legend className={s.legend}>
              <div className={s.stepHead}>
                <span className={s.stepNum}>2</span>
                <strong>{t('Preferred payment method', 'পছন্দের পেমেন্ট পদ্ধতি')}</strong>
              </div>
            </legend>

            <div
              className={s.methods}
              role="radiogroup"
              aria-label={t('Payment method', 'পেমেন্ট পদ্ধতি')}
            >
              {methods.map((m, i) => {
                const M = iconMap[m.icon] || WalletCards
                const on = method === m.id

                return (
                  <button
                    type="button"
                    key={m.id}
                    ref={(el) => {
                      methodRefs.current[i] = el
                    }}
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    className={`${s.method} ${on ? s.methodOn : ''}`}
                    onClick={() => setMethod(m.id as PaymentMethod)}
                    onKeyDown={(e) => onMethodKey(e, i)}
                  >
                    <span className={s.methodIcon}>
                      <M size={16} />
                    </span>
                    <span className={s.methodLabel}>{lang === 'en' ? m.en : m.bn}</span>
                    {on && <CheckCircle2 size={15} className={s.tick} />}
                  </button>
                )
              })}
            </div>

            <p className={s.note} aria-live="polite" key={selected.id}>
              <LockKeyhole size={14} />
              <span>{lang === 'en' ? selected.noteEn : selected.noteBn}</span>
            </p>
          </fieldset>

          {/* 3 — donor details */}
          <section
            className={s.step}
            style={{ ['--i' as string]: 2 }}
            aria-labelledby="don-donor"
          >
            <div className={s.stepHead}>
              <span className={s.stepNum}>3</span>
              <div>
                <strong id="don-donor">
                  {anonymous
                    ? t('Anonymous donation', 'বেনামী দান')
                    : t('Your details', 'আপনার তথ্য')}
                </strong>
                <span className={s.sub}>
                  {anonymous
                    ? t('No donor information is required.', 'কোনো দাতা তথ্য প্রয়োজন নেই।')
                    : t(
                        'Provide your contact details for the donation receipt.',
                        'দান রসিদের জন্য আপনার যোগাযোগের তথ্য দিন।',
                      )}
                </span>
              </div>
              <UserRound size={16} style={{ marginLeft: 'auto', color: 'var(--sf-muted)' }} />
            </div>

            <label className={s.toggle}>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              <span className={s.switch} aria-hidden="true" />
              <span className={s.toggleCopy}>
                <strong>{t('Donate anonymously', 'বেনামে দান করুন')}</strong>
                <small>
                  {t(
                    'No donor information is required. Your donation will be recorded anonymously.',
                    'কোনো দাতা তথ্য প্রয়োজন নেই। আপনার দান বেনামীভাবে সংরক্ষণ করা হবে।',
                  )}
                </small>
              </span>
            </label>

            {!anonymous && (
              <div className={s.fields}>
                {/* Name */}
                <label className={`${s.field} ${s.fullRow}`}>
                  <span>{ui[lang].name}</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      clearFieldError('name')
                    }}
                    autoComplete="name"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'don-name-error' : undefined}
                  />
                  {fieldErrors.name && (
                    <small id="don-name-error" className={s.fieldError} role="alert">
                      {fieldErrors.name}
                    </small>
                  )}
                </label>

                {/* Email */}
                <label className={s.field}>
                  <span>{ui[lang].email}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      clearFieldError('email')
                    }}
                    autoComplete="email"
                    inputMode="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'don-email-error' : undefined}
                  />
                  {fieldErrors.email && (
                    <small id="don-email-error" className={s.fieldError} role="alert">
                      {fieldErrors.email}
                    </small>
                  )}
                </label>

                {/* Phone — a div (not a label) so the country dropdown button isn't hijacked */}
                <div className={s.field}>
                  <label htmlFor="don-phone">{ui[lang].phone}</label>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(136px, 0.5fr) minmax(0, 1.5fr)',
                      gap: '8px',
                    }}
                  >
                    <CountryCodeSelect
                      options={COUNTRY_CODES}
                      value={countryIso}
                      onChange={(iso) => {
                        setCountryIso(iso)
                        clearFieldError('phone')
                      }}
                      ariaLabel={t('Country code', 'দেশের কোড')}
                      invalid={Boolean(fieldErrors.phone)}
                    />

                    <input
                      id="don-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      maxLength={15}
                      onChange={(e) => {
                        // keep phone state strictly numeric
                        const digits = e.target.value.replace(/\D/g, '')
                        setPhone(digits.slice(0, 15))
                        clearFieldError('phone')
                      }}
                      autoComplete="tel-national"
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? 'don-phone-error' : undefined}
                    />
                  </div>

                  {fieldErrors.phone && (
                    <small id="don-phone-error" className={s.fieldError} role="alert">
                      {fieldErrors.phone}
                    </small>
                  )}
                </div>

                {/* Message */}
                <label className={`${s.field} ${s.fullRow}`}>
                  <span>{ui[lang].message}</span>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
              </div>
            )}
          </section>
        </div>

        {/* Donation summary */}
        <aside className={s.summary} aria-label={t('Donation summary', 'দানের সারাংশ')}>
          <div className={s.sumTop}>
            <span>{t('Donation summary', 'দানের সারাংশ')}</span>
            <ShieldCheck size={17} />
          </div>

          <div className={s.sumLabel}>{t('You are donating', 'আপনি দান করছেন')}</div>

          <div className={s.total} aria-live="polite">
            ৳ {fmt(shownTotal)}
          </div>

          <div className={s.sumRow}>
            <span>{t('Payment', 'পেমেন্ট')}</span>
            <strong>{lang === 'en' ? selected.en : selected.bn}</strong>
          </div>

          <div className={s.sumRow}>
            <span>{t('Donor', 'দাতা')}</span>
            <strong>
              {anonymous
                ? t('Anonymous', 'বেনামী')
                : name || t('Your details', 'আপনার তথ্য')}
            </strong>
          </div>

          <div className={s.sumSecure}>
            <LockKeyhole size={15} />
            <span>{t('Encrypted gateway checkout', 'এনক্রিপ্টেড গেটওয়ে চেকআউট')}</span>
          </div>
        </aside>
      </div>

      {error && (
        <div className={s.error} role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={s.submitRow}>
        <div className={s.submitCopy}>
          <ShieldCheck size={17} />
          <span>{t('Protected by SSLCOMMERZ', 'SSLCOMMERZ দ্বারা সুরক্ষিত')}</span>
        </div>

        <button className={s.submit} type="submit" disabled={loading || customTooLow} aria-busy={loading}>
          {loading ? <LogoLoader size="sm" inline label="" /> : <CreditCard size={18} />}

          <span>
            {loading
              ? t('Opening secure checkout…', 'নিরাপদ চেকআউট খোলা হচ্ছে…')
              : `${ui[lang].submitDonation} · ৳ ${fmt(group(validNumber ? numeric : 0))}`}
          </span>

          {!loading && <ArrowRight size={17} />}
        </button>
      </div>

      <p className={s.disclaimer}>
        <MessageCircle size={13} />
        <span>
          {t(
            'Payment channels shown at checkout depend on the active SSLCOMMERZ merchant configuration. Card, bKash, Nagad, Rocket, mobile banking and internet banking availability may vary.',
            'চেকআউটে প্রদর্শিত পেমেন্ট চ্যানেল সক্রিয় SSLCOMMERZ মার্চেন্ট কনফিগারেশনের ওপর নির্ভর করে। কার্ড, বিকাশ, নগদ, রকেট, মোবাইল ব্যাংকিং ও ইন্টারনেট ব্যাংকিংয়ের প্রাপ্যতা পরিবর্তিত হতে পারে।',
          )}
        </span>
      </p>
    </form>
  )
}