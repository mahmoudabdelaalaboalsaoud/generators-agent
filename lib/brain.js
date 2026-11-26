import { checkImages } from './vision'
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const norm = s => (s || '').replace(/[\u064B-\u065F\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/(\d),(?=\d{3})/g, '$1').replace(/[،؟?!]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim()

const CITIES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'طنطا', 'المنصورة', 'الزقازيق', 'أسيوط', 'سوهاج', 'المنيا', 'بني سويف', 'الفيوم', 'الأقصر', 'أسوان', 'بورسعيد', 'السويس', 'الإسماعيلية', 'دمياط', 'دمنهور', 'شبين الكوم', 'بنها', 'كفر الشيخ', 'العاشر من رمضان', 'أكتوبر', 'التجمع', 'قنا', 'المحلة', 'العبور', 'الشروق', 'مرسى مطروح', 'الغردقة', 'شرم الشيخ']
const cityBase = c => norm(c).replace(/^ال/, '')
const findCity = t => CITIES.find(c => t.includes(cityBase(c))) || null
const cityVars = c => { const b = c.replace(/^ال/, ''); return [...new Set([b, b.replace(/ة/g, 'ه'), b.replace(/[أإ]/g, 'ا'), cityBase(c)])] }

const BRANDS = { 'بيركنز': ['بيركنز', 'perkins'], 'كاتربيلر': ['كاتربيلر', 'كاتر', 'caterpillar', 'cat'], 'كامنز': ['كامنز', 'cummins'], 'فولفو': ['فولفو', 'volvo'], 'ديوو': ['ديوو', 'daewoo'], 'هيونداي': ['هيونداي', 'hyundai'], 'ايفيكو': ['ايفيكو', 'iveco'], 'ماهيندرا': ['ماهيندرا', 'mahindra'], 'هوندا': ['هوندا', 'honda'], 'ياماها': ['ياماها', 'yamaha'] }
const findBrand = t => { const w = new Set([...t.split(' '), ...t.split(' ').map(x => x.replace(/^(ال|ل|ب|و)/, ''))]); return Object.keys(BRANDS).find(k => BRANDS[k].some(v => w.has(norm(v)))) || null }

const kvaOf = t => { const m = t.match(/(\d+(?:\.\d+)?)\s*(?:كيلو|kva|kw|كي في ايه|كيلوات)/); return m ? parseFloat(m[1]) : null }
const hoursOf = t => { const m = t.match(/(\d+)\s*(?:ساعه|ساعات)/); return m ? parseInt(m[1]) : null }
const phoneOf = t => { const m = t.replace(/(?<=\d)[\s-](?=\d)/g, '').match(/01[0125]\d{8}/); return m ? m[0] : null }
const dealOf = t => /ايجار|اجار|استاجر|تاجير|اؤجر|اوجر|(^|\s)اجر(\s|$)/.test(t) ? 'rent' : /بيع|اشتري|شراء|كاش|تقسيط/.test(t) ? 'sale' : null
const fuelOf = t => /سولار|ديزل/.test(t) ? 'ديزل' : /بنزين/.test(t) ? 'بنزين' : /غاز/.test(t) ? 'غاز' : null
const condOf = t => /جديد|زيرو/.test(t) ? 'جديد' : /مستعمل|استعمال/.test(t) ? 'مستعمل' : /استيراد/.test(t) ? 'استيراد' : null
const priceOf = t => {
  let m = t.match(/(\d+(?:\.\d+)?)\s*(الف|الاف|مليون)/)
  if (m) return Math.round(parseFloat(m[1]) * (m[2] === 'مليون' ? 1e6 : 1e3))
  m = t.match(/(?:سعر\S*|بسعر|ميزانيت\S*|ميزانيه|حدود|اقصي|لحد|تحت|ب)\s*(\d{4,})/) || t.match(/(\d{4,})\s*جني/)
  return m ? parseInt(m[1]) : null
}

const SUPPLY = /ابيع|اعلن|انزل اعلان|اضيف|اوجر|اؤجر|عندي مولد|مولدي/
const BUY = /عايز|عاوز|محتاج|دورلي|ادور|ابحث|اشتري|استاجر|فين/
const CALC = /احسب|احمال|حملي|استهلاك|يكفي/
const GREET = /^(هلا|اهلا|السلام|مرحبا|صباح|مساء|ازيك|هاي|hi|hello)/
const END = ['✅ تم تسجيل', 'لغيت التسجيل']
const SIZES = [10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 150, 200, 250, 300, 400, 500, 650, 800, 1000]
const n0 = x => Number(x).toLocaleString('en')

async function note(uid, text) { try { await db.from('agent_notes').insert({ user_id: uid, note: text }) } catch {} }

function calc(t) {
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:كيلو|kw|كيلوات)/)
  if (!m) return 'قولي إجمالي الأحمال بالكيلوات، مثلاً: «احسب احمال 24 كيلو وات».'
  const kw = parseFloat(m[1]), need = kw / 0.8 * 1.25
  const size = SIZES.find(s => s >= need) || Math.ceil(need / 100) * 100
  return `📐 حمولتك ${kw} كيلو وات:\n• القدرة المناسبة: حوالي ${size} KVA (القدرة ÷ 0.8 معامل قدرة + 25% هامش أمان)\n• استهلاك سولار تقريبي: ${(kw * 0.27).toFixed(1)} لتر/ساعة عند الحمل ده\n⚠️ أرقام تقريبية، راجع مهندس قبل الشراء.`
}

const fmt = g => `• ${g.title || 'مولد'}${g.kva ? ' — ' + g.kva + ' كيلو' : ''}${g.fuel ? '، ' + g.fuel : ''}${g.condition ? '، ' + g.condition : ''}\n  💰 ${n0(g.price)} جنيه (${g.deal === 'rent' ? 'إيجار' : 'بيع'}) | 📍 ${g.city} | 📞 ${g.phone}${g.images?.[0] ? '\n  ' + g.images[0] : ''}`

async function search(t, uid) {
  const deal = dealOf(t), kva = kvaOf(t), city = findCity(t), brand = findBrand(t), maxP = priceOf(t)
  if (!deal && !kva && !city && !brand && !maxP) return 'تمام! محتاج مولد بيع ولا إيجار؟ وكام كيلو، وفي أنهي مدينة؟'
  let q = db.from('generators').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(40)
  if (deal) q = q.eq('deal', deal)
  if (city) q = q.or(cityVars(city).map(v => `city.ilike.%${v}%`).join(','))
  if (brand) q = q.ilike('brand', `%${brand}%`)
  if (maxP) q = q.lte('price', maxP)
  let { data } = await q
  data = data || []
  if (kva) data = data.filter(g => g.kva && g.kva >= kva * 0.8 && g.kva <= kva * 1.5).sort((a, b) => Math.abs(a.kva - kva) - Math.abs(b.kva - kva))
  await note(uid, 'بحث: ' + [deal === 'rent' ? 'إيجار' : deal === 'sale' ? 'شراء' : '', kva && kva + ' كيلو', city, brand, maxP && 'حد أقصى ' + maxP].filter(Boolean).join('، '))
  if (!data.length) return 'مفيش مولد بالمواصفات دي دلوقتي 😕 جرب تغيّر المدينة أو القدرة، أو لو عندك مولد قولي «عندي مولد» وأنزله لك.'
  return `لقيتلك ${Math.min(data.length, 5)} نتيجة:\n\n` + data.slice(0, 5).map(fmt).join('\n\n')
}

async function supplyCore(fm, seg, uid) {
  const lt = norm(fm[fm.length - 1].content)
  const pa = norm([...seg].reverse().find(m => m.role !== 'user')?.content || '')
  const latest = fn => { for (let i = fm.length - 1; i >= 0; i--) { const v = fn(norm(fm[i].content)); if (v != null) return v } return null }
  let kva = latest(kvaOf), price = latest(priceOf), hours = latest(hoursOf)
  const bare = lt.match(/^(\d+(?:\.\d+)?)\s*(الف|الاف|مليون)?$/)
  if (bare) {
    const n = parseFloat(bare[1]) * (bare[2] === 'مليون' ? 1e6 : bare[2] ? 1e3 : 1)
    if (pa.includes('القدره')) kva = n; else if (pa.includes('السعر')) price = n; else if (pa.includes('ساعات')) hours = n
  }
  const f = { deal: latest(dealOf), kva, city: latest(findCity), price, phone: latest(phoneOf), brand: latest(findBrand), fuel: latest(fuelOf), condition: latest(condOf), hours }
  const images = fm.flatMap(m => m.images || [])
  const ask = [['deal', 'ده إعلان بيع ولا إيجار؟'], ['kva', 'القدرة كام كيلو (KVA)؟'], ['city', 'المولد في أنهي مدينة؟'], ['price', 'السعر المطلوب كام؟ (لو إيجار قولي في اليوم ولا الشهر)'], ['phone', 'رقم التليفون للتواصل؟']].find(([k]) => f[k] == null)
  if (ask) return 'تمام 👍 ' + ask[1]
  const confirm = /^(تاكيد|اكد|سجل|ايوه|ايوا|اه|تمام|موافق|ماشي|نعم|ok|اوكي)/.test(lt) && pa.includes('تاكيد')
  if (confirm) {
    const title = 'مولد ' + [f.brand, f.kva + ' كيلو', f.fuel, f.condition].filter(Boolean).join(' ')
    const { error } = await db.from('generators').insert({ user_id: uid, deal: f.deal, title, brand: f.brand, kva: f.kva, fuel: f.fuel, condition: f.condition, hours: f.hours, price: f.price, city: f.city, phone: f.phone, description: fm.map(m => m.content).join(' | ').slice(0, 400), images })
    if (error) return 'حصلت مشكلة في التسجيل: ' + error.message
    await note(uid, `نزّل إعلان ${f.deal === 'rent' ? 'إيجار' : 'بيع'}: ${title} في ${f.city}`)
    return '✅ تم تسجيل إعلانك! هيظهر لأي حد بيدوّر على مولد زي ده. تحب تضيف إعلان تاني؟'
  }
  return `📋 ده إعلانك:\n• النوع: ${f.deal === 'rent' ? 'إيجار' : 'بيع'}\n• المولد: ${[f.brand, f.kva + ' كيلو', f.fuel, f.condition].filter(Boolean).join(' ')}${f.hours ? '\n• ساعات التشغيل: ' + f.hours : ''}\n• المدينة: ${f.city}\n• السعر: ${n0(f.price)} جنيه\n• التليفون: ${f.phone}\n• الصور: ${images.length}\n\nتقدر تضيف الماركة أو الحالة أو ساعات التشغيل أو صور 📷، أو اكتب «تأكيد» عشان أنزله.`
}

export async function brain(messages, uid) {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'user') return null
  const t = norm(last.content)
  let b = 0
  messages.forEach((m, i) => { if (m.role !== 'user' && END.some(e => m.content.includes(e))) b = i + 1 })
  const seg = messages.slice(b)
  const fm = seg.filter(m => m.role === 'user')
  const start = fm.findIndex(m => SUPPLY.test(norm(m.content)))
  const buyer = BUY.test(t) && /مولد/.test(t) && !SUPPLY.test(t)
  if (start >= 0 && !buyer) {
    if (/^(الغي|الغاء|بلاش|لا شكرا)/.test(t)) return 'تمام، لغيت التسجيل.'
    return supply(fm.slice(start), seg, uid)
  }
  if (CALC.test(t) && /\d/.test(t)) return calc(t)
  if (GREET.test(t) && t.length < 25) return 'أهلا بيك! 👋 أقدر أساعدك تدوّر على مولد (بيع أو إيجار)، أو تنزّل إعلان لمولدك، أو أحسبلك القدرة المناسبة. قولي محتاج إيه؟'
  if (/مولد|ايجار|اجار|كيلو|kva/.test(t) || buyer) return search(t, uid)
  return null
}

async function supply(fm, seg, uid) {
  const last = fm[fm.length - 1]
  const prevText = seg.filter(m => m.role !== 'user').map(m => m.content).join('\n')
  const hints = prevText.match(/🔍[^\n]*/g) || []
  const notes = []
  const bad = new Set()
  const newImgs = last.images || []
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
