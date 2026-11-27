import { createClient } from '@supabase/supabase-js'
import { checkImages } from './vision'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ---------- التطبيع ----------
const norm = s => (s || '').replace(/[\u064B-\u065F\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/(\d),(?=\d{3})/g, '$1').replace(/([ء-ي])\1{2,}/g, '$1$1')
  .replace(/[،؟?!؛:"“”()]/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim()

const NUM = { واحد: 1, اتنين: 2, اثنين: 2, تلاته: 3, تلات: 3, ثلاثه: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6, سبعه: 7, سبع: 7, تمانيه: 8, تمنيه: 8, تمان: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10, حداشر: 11, اتناشر: 12, تلتاشر: 13, اربعتاشر: 14, خمستاشر: 15, ستاشر: 16, سبعتاشر: 17, تمنتاشر: 18, تسعتاشر: 19, عشرين: 20, تلاتين: 30, ثلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70, تمانين: 80, ثمانين: 80, تسعين: 90, ميه: 100, مايه: 100, ميتين: 200, تلتميه: 300, ربعميه: 400, خمسميه: 500, ستميه: 600, سبعميه: 700, تمنميه: 800, تسعميه: 900 }
const UNIT = /^(كيلو|كيلوات|kva|kw|الف|الاف|مليون|ساعه|ساعات|جنيه|حصان)$/
function words2digits(t) {
  const w = t.replace(/(^| )الفين(?= |$)/g, '$1 2 الف').split(' ').filter(Boolean), out = []
  for (let i = 0; i < w.length;) {
    let j = i, sum = 0, ok = false
    while (j < w.length) {
      const x = NUM[w[j]] != null ? w[j] : w[j].replace(/^و/, '')
      if (NUM[x] != null) { sum += NUM[x]; ok = true; j++ }
      else if (w[j] === 'و' && ok && NUM[(w[j + 1] || '').replace(/^و/, '')] != null) j++
      else break
    }
    if (ok && UNIT.test(w[j] || '')) { out.push(String(sum)); i = j } else { out.push(w[i]); i++ }
  }
  return out.join(' ')
}
const prep = s => words2digits(norm(s))

// ---------- المطابقة التقريبية ----------
function lev(a, b) {
  const m = a.length, n = b.length
  if (Math.abs(m - n) > 2) return 9
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}
const close = (w, v, min = 4) => w === v || (v.length >= min && lev(w, v) <= (v.length >= 7 ? 2 : 1))
const toks = t => { const s = new Set(); for (const w of t.split(' ')) { s.add(w); s.add(w.replace(/^(ال|لل|في|ب|ل|و|ف)/, '')) } return [...s].filter(w => w.length > 1) }

// ---------- القواميس ----------
const CITIES = [['القاهرة', 'كايرو', 'قاهره'], ['الجيزة', 'جيزه'], ['الإسكندرية', 'اسكندريه', 'اسكندريا', 'اسكندريه'], ['طنطا'], ['المنصورة', 'منصوره'], ['الزقازيق'], ['أسيوط', 'اسيوط'], ['سوهاج'], ['المنيا'], ['بني سويف', 'بنى سويف'], ['الفيوم'], ['الأقصر', 'اقصر'], ['أسوان', 'اسوان'], ['بورسعيد', 'بور سعيد'], ['السويس'], ['الإسماعيلية', 'اسماعيليه'], ['دمياط'], ['دمنهور'], ['شبين الكوم'], ['بنها'], ['كفر الشيخ'], ['العاشر من رمضان', 'العاشر', 'عاشر رمضان'], ['أكتوبر', '6 اكتوبر', 'ستة اكتوبر'], ['الشيخ زايد', 'زايد'], ['التجمع', 'التجمع الخامس'], ['قنا'], ['المحلة', 'المحله الكبري'], ['العبور'], ['الشروق'], ['مرسى مطروح', 'مطروح', 'مرسي مطروح'], ['الغردقة', 'غردقه'], ['شرم الشيخ', 'شرم'], ['المعادي'], ['الهرم'], ['15 مايو'], ['برج العرب'], ['السادات'], ['العلمين'], ['الساحل الشمالي', 'الساحل'], ['سيناء']]
const CN = CITIES.map(([c, ...al]) => ({ c, names: [c, ...al].map(x => norm(x).replace(/^ال/, '')) }))
const findCity = t => {
  const T = ' ' + t + ' ', tk = toks(t)
  for (const { c, names } of CN) for (const n of names) {
    if (n.includes(' ') || /\d/.test(n) ? (T.includes(' ' + n + ' ') || T.includes(' ال' + n + ' ')) : tk.some(w => w.length >= 3 && close(w, n, 5))) return c
  }
  return null
}
const cityBase = c => norm(c).replace(/^ال/, '')
const cityVars = c => { const b = c.replace(/^ال/, ''); return [...new Set([b, b.replace(/ة/g, 'ه'), b.replace(/[أإ]/g, 'ا'), cityBase(c), b.replace(/^[أإا]/, '')])] }

const BRANDS = { 'بيركنز': ['بيركنز', 'بيركينز', 'perkins'], 'كاتربيلر': ['كاتربيلر', 'كاتر', 'caterpillar', 'cat'], 'كامنز': ['كامنز', 'كمنز', 'cummins'], 'فولفو': ['فولفو', 'volvo'], 'ديوو': ['ديوو', 'daewoo'], 'هيونداي': ['هيونداي', 'hyundai'], 'ايفيكو': ['ايفيكو', 'iveco'], 'ماهيندرا': ['ماهيندرا', 'mahindra'], 'هوندا': ['هوندا', 'honda'], 'ياماها': ['ياماها', 'yamaha'], 'دينيو': ['دينيو', 'denyo'], 'كوبوتا': ['كوبوتا', 'kubota'], 'يانمار': ['يانمار', 'yanmar'], 'ميتسوبيشي': ['ميتسوبيشي', 'mitsubishi'], 'سكانيا': ['سكانيا', 'scania'], 'ايسوزو': ['ايسوزو', 'isuzu'], 'ليستر': ['ليستر', 'lister'], 'دويتس': ['دويتس', 'deutz'], 'ريكاردو': ['ريكاردو', 'ricardo'], 'ويلسون': ['ويلسون', 'wilson'] }
const NB = Object.entries(BRANDS).map(([k, v]) => [k, v.map(norm)])
const findBrand = t => { const tk = toks(t), r = NB.find(([, vs]) => vs.some(v => tk.some(w => close(w, v)))); return r ? r[0] : null }

// ---------- الاستخراج ----------
const kvaOf = t => { const m = t.match(/(\d+(?:\.\d+)?)\s*(?:كيلو|kva|kw|كي في ايه|كيلوات)/); return m ? parseFloat(m[1]) : null }
const hoursOf = t => { const m = t.match(/(\d+)\s*(?:ساعه|ساعات)/); return m ? parseInt(m[1]) : null }
const phoneOf = t => { const m = t.replace(/(?<=\d)[\s-](?=\d)/g, '').match(/01[0125]\d{8}/); return m ? m[0] : null }
const dealOf = t => /ايجار|اجار|استاجر|تاجير|اؤجر|اوجر|هوجر|(^|\s)اجر(\s|$)/.test(t) ? 'rent' : /بيع|ابيع|هبيع|اشتري|شراء|كاش|تقسيط/.test(t) ? 'sale' : null
const kindOf = t => /تاور|لايت|انار[هة]|اضاء[هة]/.test(t) ? 'light_tower' : null
const fuelOf = t => /سولار|ديزل/.test(t) ? 'ديزل' : /بنزين/.test(t) ? 'بنزين' : /غاز/.test(t) ? 'غاز' : null
const condOf = t => /جديد|زيرو/.test(t) ? 'جديد' : /مستعمل|استعمال/.test(t) ? 'مستعمل' : /استيراد/.test(t) ? 'استيراد' : null
const priceOf = t => {
  let m = t.match(/(\d+(?:\.\d+)?)\s*(الف|الاف|مليون)/)
  if (m) return Math.round(parseFloat(m[1]) * (m[2] === 'مليون' ? 1e6 : 1e3))
  m = t.match(/(?:سعر\S*|بسعر|ميزانيت\S*|ميزانيه|حدود|اقصي|لحد|تحت|ب)\s*(\d{4,})/) || t.match(/(\d{4,})\s*جني/)
  return m ? parseInt(m[1]) : null
}

const SUPPLY = /ابيع|هبيع|اعلن|انزل|نزل|ارفع|ضيف|اضيف|اوجر|هوجر|عندي مولد|عندي تاور|معايا مولد|مولدي|سجل/
const BUY = /عايز|عاوز|محتاج|دورلي|ادور|ابحث|اشتري|استاجر|فين|ابغي|اريد|بدي/
const CALC = /احسب|احمال|حملي|استهلاك|يكفي/
const GREET = /^(هلا|اهلا|السلام|سلام|مرحبا|صباح|مساء|ازيك|ايه الاخبار|هاي|hi|hello|يا باشا)/
const THANKS = /^(شكرا|تسلم|متشكر|جزاك|ميرسي|thanks|thx)/
const HELP = /^(مساعده|ساعدني|تقدر تعمل ايه|بتعمل ايه|ازاي استخدم|help)/
const SHOW = /^(اقرب|اي حاجه|اي مولد|المتاح|اعرض|وريني|كله)/
const END = ['✅ تم تسجيل', 'لغيت التسجيل']
const SIZES = [10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 150, 200, 250, 300, 400, 500, 650, 800, 1000]
const n0 = x => Number(x).toLocaleString('en')

async function note(uid, text) { try { await db.from('agent_notes').insert({ user_id: uid, note: text }) } catch {} }
async function unknown(uid, msg) { try { await db.from('unknown_log').insert({ user_id: uid, msg: msg.slice(0, 300) }) } catch {} }

function calc(t) {
  const a = t.match(/(\d+(?:\.\d+)?)\s*(?:كيلو وات|كيلوات|kw|كيلو)/), h = t.match(/(\d+(?:\.\d+)?)\s*حصان/)
  const kw = a ? parseFloat(a[1]) : h ? parseFloat(h[1]) * 0.746 : null
  if (!kw) return 'قولي إجمالي الأحمال بالكيلو وات أو بالحصان، مثلاً: «احسب احمال 24 كيلو وات».'
  const need = kw / 0.8 * 1.25, size = SIZES.find(s => s >= need) || Math.ceil(need / 100) * 100
  return `📐 حمولتك ${kw.toFixed(1)} كيلو وات:\n• القدرة المناسبة: حوالي ${size} KVA (القدرة ÷ 0.8 معامل قدرة + 25% هامش أمان)\n• استهلاك سولار تقريبي: ${(kw * 0.27).toFixed(1)} لتر/ساعة عند الحمل ده\n⚠️ أرقام تقريبية، راجع مهندس قبل الشراء.`
}

const fmt = g => `• ${g.title || 'مولد'}${g.kva ? ' — ' + g.kva + ' كيلو' : ''}${g.fuel ? '، ' + g.fuel : ''}${g.condition ? '، ' + g.condition : ''}\n  💰 ${n0(g.price)} جنيه (${g.deal === 'rent' ? 'إيجار' : 'بيع'}) | 📍 ${g.city} | 📞 ${g.phone}${g.images?.[0] ? '\n  ' + g.images[0] : ''}`

async function search(t, uid) {
  const kind = kindOf(t), deal = dealOf(t), kva = kvaOf(t), city = findCity(t), brand = findBrand(t), maxP = priceOf(t)
  if (!kind && !deal && !kva && !city && !brand && !maxP) return 'تمام! محتاج مولد بيع ولا إيجار؟ وكام كيلو، وفي أنهي مدينة؟'
  let q = db.from('generators').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(40)
  if (kind) q = q.eq('kind', kind)
  if (deal) q = q.eq('deal', deal)
  if (city) q = q.or(cityVars(city).map(v => `city.ilike.%${v}%`).join(','))
  if (brand) q = q.ilike('brand', `%${brand}%`)
  if (maxP) q = q.lte('price', maxP)
  let { data } = await q
  data = data || []
  if (kva) data = data.filter(g => g.kva && g.kva >= kva * 0.8 && g.kva <= kva * 1.5).sort((a, b) => Math.abs(a.kva - kva) - Math.abs(b.kva - kva))
  await note(uid, 'بحث: ' + [kind === 'light_tower' ? 'تاور لايت' : '', deal === 'rent' ? 'إيجار' : deal === 'sale' ? 'شراء' : '', kva && kva + ' كيلو', city, brand, maxP && 'حد أقصى ' + maxP].filter(Boolean).join('، '))
  if (!data.length) return 'مفيش مولد بالمواصفات دي دلوقتي 😕 جرب تغيّر المدينة أو القدرة، أو لو عندك مولد قولي «عندي مولد» وأنزله لك.'
  return `لقيتلك ${Math.min(data.length, 5)} نتيجة:\n\n` + data.slice(0, 5).map(fmt).join('\n\n')
}

async function showAny(uid) {
  const { data } = await db.from('generators').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(5)
  await note(uid, 'طلب عرض المتاح')
  if (!data?.length) return 'مفيش إعلانات متاحة دلوقتي 😕 لو عندك مولد اكتب «عندي مولد» وأنزله لك.'
  return 'ده المتاح دلوقتي:\n\n' + data.map(fmt).join('\n\n')
}

async function priceInfo(t) {
  const kva = kvaOf(t), deal = dealOf(t) || 'sale', mine = priceOf(t)
  if (!kva) return 'قولي القدرة عشان أقدّر السعر، مثلاً: «بكام مولد 100 كيلو للبيع؟»'
  let { data } = await db.from('generators').select('price,kva').eq('status', 'active').eq('deal', deal).gte('kva', kva * 0.8).lte('kva', kva * 1.25).gt('price', 0)
  data = data || []
  if (data.length < 2) return `لسه عندي بيانات قليلة عن مولدات ${kva} كيلو (${data.length} إعلان). كل ما الإعلانات تزيد، تقديري بيبقى أدق.`
  const p = data.map(g => g.price).sort((a, b) => a - b), med = p[Math.floor(p.length / 2)]
  const v = mine ? (mine > med * 1.25 ? '\n⚠️ السعر اللي قلته أعلى من المتوسط.' : mine < med * 0.75 ? '\n👍 السعر اللي قلته أقل من المتوسط.' : '\n✅ السعر اللي قلته قريب من المتوسط.') : ''
  return `📊 مولدات حوالي ${kva} كيلو (${deal === 'rent' ? 'إيجار' : 'بيع'}) من ${p.length} إعلان:\n• الأقل: ${n0(p[0])}\n• المتوسط: ${n0(med)}\n• الأعلى: ${n0(p[p.length - 1])}${v}\n(من إعلانات الموقع بس، مش سعر سوق رسمي.)`
}

async function mine(uid, del) {
  const { data } = await db.from('generators').select('id,title,price,deal,city').eq('user_id', uid).order('created_at', { ascending: false }).limit(20)
  if (!data?.length) return 'مفيش إعلانات ليك لسه.'
  if (del) { const g = data[del - 1]; if (!g) return 'مفيش إعلان بالرقم ده.'; await db.from('generators').delete().eq('id', g.id).eq('user_id', uid); return `🗑️ اتحذف: ${g.title}` }
  return 'إعلاناتك:\n' + data.map((g, i) => `${i + 1}. ${g.title} — ${n0(g.price)} جنيه (${g.deal === 'rent' ? 'إيجار' : 'بيع'}) 📍 ${g.city}`).join('\n') + '\n\nلحذف إعلان اكتب: احذف 2'
}

// ---------- تسجيل الإعلان ----------
async function supplyCore(fm, seg, uid) {
  const lt0 = prep(fm[fm.length - 1].content), lt = NUM[lt0] != null ? String(NUM[lt0]) : lt0
  const pa = norm([...seg].reverse().find(m => m.role !== 'user')?.content || '')
  const latest = fn => { for (let i = fm.length - 1; i >= 0; i--) { const v = fn(prep(fm[i].content)); if (v != null) return v } return null }
  let kva = latest(kvaOf), price = latest(priceOf), hours = latest(hoursOf)
  const bare = lt.match(/^(\d+(?:\.\d+)?)\s*(الف|الاف|مليون)?$/)
  if (bare) {
    const n = parseFloat(bare[1]) * (bare[2] === 'مليون' ? 1e6 : bare[2] ? 1e3 : 1)
    if (pa.includes('القدره')) kva = n; else if (pa.includes('السعر')) price = n; else if (pa.includes('ساعات')) hours = n
  }
  const f = { kind: latest(kindOf) || 'generator', deal: latest(dealOf), kva, city: latest(findCity), price, phone: latest(phoneOf), brand: latest(findBrand), fuel: latest(fuelOf), condition: latest(condOf), hours }
  const images = fm.flatMap(m => m.images || [])
  const ask = [['deal', 'ده إعلان بيع ولا إيجار؟'], ['kva', 'القدرة كام كيلو (KVA)؟'], ['city', 'المولد في أنهي مدينة؟'], ['price', 'السعر المطلوب كام؟ (لو إيجار قولي في اليوم ولا الشهر)'], ['phone', 'رقم التليفون للتواصل؟']].find(([k]) => f[k] == null)
  if (ask) return 'تمام 👍 ' + ask[1]
  const confirm = /^(تاكيد|اكد|سجل|ايوه|ايوا|اه|تمام|موافق|ماشي|نعم|ok|اوكي)/.test(lt) && pa.includes('تاكيد')
  const what = f.kind === 'light_tower' ? 'تاور لايت' : 'مولد'
  if (confirm) {
    const title = what + ' ' + [f.brand, f.kva + ' كيلو', f.fuel, f.condition].filter(Boolean).join(' ')
    const { error } = await db.from('generators').insert({ user_id: uid, kind: f.kind, deal: f.deal, title, brand: f.brand, kva: f.kva, fuel: f.fuel, condition: f.condition, hours: f.hours, price: f.price, city: f.city, phone: f.phone, description: fm.map(m => m.content).join(' | ').slice(0, 400), images })
    if (error) return 'حصلت مشكلة في التسجيل: ' + error.message
    await note(uid, `نزّل إعلان ${f.deal === 'rent' ? 'إيجار' : 'بيع'}: ${title} في ${f.city}`)
    return '✅ تم تسجيل إعلانك! هيظهر لأي حد بيدوّر على مولد زي ده. تحب تضيف إعلان تاني؟'
  }
  return `📋 ده إعلانك:\n• النوع: ${f.deal === 'rent' ? 'إيجار' : 'بيع'}\n• ${what}: ${[f.brand, f.kva + ' كيلو', f.fuel, f.condition].filter(Boolean).join(' ')}${f.hours ? '\n• ساعات التشغيل: ' + f.hours : ''}\n• المدينة: ${f.city}\n• السعر: ${n0(f.price)} جنيه\n• التليفون: ${f.phone}\n• الصور: ${images.length}\n\nتقدر تضيف الماركة أو الحالة أو ساعات التشغيل أو صور 📷، أو اكتب «تأكيد» عشان أنزله.`
}

async function supply(fm, seg, uid) {
  const last = fm[fm.length - 1]
  const prevText = seg.filter(m => m.role !== 'user').map(m => m.content).join('\n')
  const hints = prevText.match(/🔍[^\n]*/g) || []
  const notes = [], bad = new Set(), newImgs = last.images || []
  if (newImgs.length) {
    const res = await checkImages(newImgs)
    let hb = null, hk = null
    res.forEach((r, i) => {
      if (r?.is_generator === false) { bad.add(newImgs[i]); notes.push(`❌ الصورة دي مش مولد (${r.what || 'حاجة تانية'}) ومش هضيفها للإعلان.\n${newImgs[i]}`) }
      else if (r?.is_generator) { hb = hb || r.brand; hk = hk || r.kva }
    })
    if (hb || hk) { const line = `🔍 من الصورة: ${hb ? 'ماركة ' + hb : ''} ${hk ? hk + ' كيلو' : ''}`.trim(); hints.push(line); notes.push(line) }
  }
  const clean = fm.map(m => ({ ...m, images: (m.images || []).filter(u => !bad.has(u) && !prevText.includes(u)) }))
  const pseudo = hints.length ? [{ role: 'user', content: hints.join(' '), images: [] }] : []
  const out = await supplyCore([...pseudo, ...clean], seg, uid)
  return notes.length ? notes.join('\n') + '\n\n' + out : out
}

// ---------- المحرك ----------
export async function brain(messages, uid) {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'user') return null
  const t = prep(last.content)
  let b = 0
  messages.forEach((m, i) => { if (m.role !== 'user' && END.some(e => m.content.includes(e))) b = i + 1 })
  const seg = messages.slice(b), fm = seg.filter(m => m.role === 'user')
  let start = fm.findIndex(m => SUPPLY.test(prep(m.content)))
  if (start < 0) start = fm.findIndex(m => m.images?.length)
  const buyer = BUY.test(t) && /مولد|تاور/.test(t) && !SUPPLY.test(t)
  if (start >= 0 && !buyer) {
    if (/^(الغي|الغاء|بلاش|لا شكرا|كنسل)/.test(t)) return 'تمام، لغيت التسجيل.'
    return supply(fm.slice(start), seg, uid)
  }
  if (/^(اعلاناتي|اعلاني|مولداتي)/.test(t)) return mine(uid)
  const d = t.match(/^(?:احذف|امسح|شيل)\s+(?:اعلان\s+)?(\d+)$/)
  if (d) return mine(uid, parseInt(d[1]))
  if (THANKS.test(t)) return 'العفو يا باشا 🙌 أي خدمة تانية؟'
  if (HELP.test(t)) return 'أقدر:\n• أدوّرلك على مولد أو تاور لايت (بيع/إيجار)\n• أنزّل إعلانك (اكتب «عندي مولد» وابعت صوره)\n• أحسبلك القدرة المناسبة (احسب احمال 24 كيلو وات)\n• أقولك متوسط السعر (بكام مولد 100 كيلو؟)\n• أعرض إعلاناتك (اعلاناتي)'
  if (CALC.test(t) && /\d/.test(t)) return calc(t)
  if (/بكام|متوسط|تقييم سعر|السعر ده/.test(t) && kvaOf(t)) return priceInfo(t)
  if (GREET.test(t) && t.length < 25) return 'أهلا بيك! 👋 أقدر أساعدك تدوّر على مولد (بيع أو إيجار)، أو تنزّل إعلان لمولدك، أو أحسبلك القدرة المناسبة. قولي محتاج إيه؟'
  if (SHOW.test(t)) return showAny(uid)
  if (/مولد|تاور|لايت|ايجار|اجار|كيلو|kva/.test(t) || buyer) return search(t, uid)
  await unknown(uid, last.content)
  return null
}
