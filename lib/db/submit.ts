import type { ExternalValue } from '@/types/json'
import { submissions } from './schema'
import { db } from './index'
export async function saveSubmission(type: 'query', data: {name?:string;email?:string;phone?:string;message?:string;payload?: ExternalValue}) {
  if (!db) throw new Error('Database is not configured')
  await db.insert(submissions).values({ type, ...data })
}
