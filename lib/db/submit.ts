import { submissions } from './schema'
import { db } from './index'
export async function saveSubmission(type: 'query', data: {name?:string;email?:string;phone?:string;message?:string;payload?:unknown}) {
  if (!db) throw new Error('Database is not configured')
  await db.insert(submissions).values({ type, ...data })
}
