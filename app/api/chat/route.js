import { authorize, chat } from '../../../lib/engine'
export const maxDuration = 60

const clean = s => String(s).replace(/\*\*/g, '').replace(/^\s*\*\s+/gm, '• ').replace(/^#+\s*/gm, '')

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const a = await authorize(token)
  if (a.error) return Response.json({ error: a.error }, { status: a.status })
  try {
    const { messages } = await req.json()
    return Response.json({ reply: clean(await chat(messages, a.user.id)) })
  } catch (e) {
    return Response.json({ reply: 'مش فاهم قصدك 🤔 قولي: بيع ولا إيجار؟ وكام كيلو؟ وفي أنهي مدينة؟' })
  }
}
