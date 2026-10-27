import 'server-only'
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

export type DataProvider = 'neon' | 'google-drive'
const COOKIE = 'srizony-data-provider'
const DEFAULT_PROVIDER: DataProvider = process.env.DATA_PROVIDER_DEFAULT === 'google-drive' ? 'google-drive' : 'neon'

function secret() {
  const value = process.env.CMS_PROVIDER_COOKIE_SECRET || process.env.CMS_SESSION_SECRET || process.env.AUTH_SECRET
  if (!value || value.length < 32) throw new Error('Set CMS_PROVIDER_COOKIE_SECRET (at least 32 characters) to enable the CMS database selector.')
  return value
}
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url') }
function validProvider(value: string): value is DataProvider { return value === 'neon' || value === 'google-drive' }

export async function getSelectedDataProvider(): Promise<DataProvider> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE)?.value
  if (!raw) return DEFAULT_PROVIDER
  const [provider, signature] = raw.split('.')
  if (!provider || !signature || !validProvider(provider)) return DEFAULT_PROVIDER
  const expected = Buffer.from(sign(provider))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return DEFAULT_PROVIDER
  return provider
}

export async function setSelectedDataProvider(provider: DataProvider) {
  if (!validProvider(provider)) throw new Error('Unsupported data provider.')
  const cookieStore = await cookies()
  cookieStore.set(COOKIE, `${provider}.${sign(provider)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}
