const models = () => [...new Set([process.env.MODEL, 'gemini-3.7-flash', 'gemini-3.8-flash'].filter(Boolean))]

async function toPart(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
  const b = Buffer.from(await r.arrayBuffer())
  return { inline_data: { mime_type: r.headers.get('content-type') || 'image/jpeg', data: b.toString('base64') } }
}

export async function checkImages(all) {
  const urls = all.slice(0, 4)
  try {
    const parts = []
    for (const u of urls) parts.push(await toPart(u))
    parts.push({ text: `عندك ${urls.length} صور بالترتيب. لكل صورة قرر: هل فيها مولد كهرباء (ديزل أو بنزين أو غاز، كامل أو جزء واضح منه أو لوحة بياناته)؟ لو فيها لوحة بيانات أو كتابة واضحة، اقرأ الماركة (بالعربي زي بيركنز، كاتربيلر، كامنز) والقدرة بالـ KVA. متخمنش لو مش ظاهر، سيبه null. رجّع JSON array فقط بنفس ترتيب الصور، وكل عنصر بالشكل ده: {"is_generator": true أو false, "what": "وصف قصير جدًا بالعربي للي في الصورة", "brand": "الماركة أو null", "kva": رقم أو null}` })
    const body = JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } })
    for (const m of models()) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(12000)
        })
        if (!r.ok) continue
        const j = await r.json()
        const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')
        const arr = JSON.parse(txt)
        if (Array.isArray(arr)) return urls.map((_, i) => arr[i] || { is_generator: null })
      } catch {}
    }
  } catch {}
  return urls.map(() => ({ is_generator: null }))
}
