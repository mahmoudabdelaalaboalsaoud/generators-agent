import { authorize, chat } from '../../../lib/engine'
export const maxDuration = 60

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const a = await authorize(token)
  if (a.error) return Response.json({ error: a.error }, { status: a.status })
  try {
    const { messages } = await req.json()
    return Response.json({ reply: await chat(messages, a.user.id) })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
