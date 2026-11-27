'use client'
import { useState, useEffect, useMemo } from 'react'
import { sb } from '../../lib/supabase'

const TABS = [['home', '📊 نظرة عامة'], ['ads', '📦 الإعلانات'], ['users', '👥 المستخدمين'], ['learn', '🧠 التعلّم']]
const day = d => new Date(d).toLocaleDateString('ar-EG')
const CSS = `.ad{max-width:900px;margin:0 auto;padding:14px 14px 60px}
.ad-top{display:flex;justify-content:space-between;align-items:center;padding:6px 0 14px;font-size:18px}
.ad-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:12px}
.ad-tabs button{white-space:nowrap;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:8px 14px;cursor:pointer}
.ad-tabs button.on{background:var(--acc);color:#111;border-color:var(--acc);font-weight:700}
.ad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.ad-stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}
.ad-stat b{display:block;font-size:26px;color:var(--acc)}
.ad-stat small{color:var(--mut)}
.ad-box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 12px;margin-top:12px}
.ad-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.ad-row:first-child{border-top:0}
.ad-row .t{min-width:0;overflow-wrap:anywhere}
.ad-row small{color:var(--mut);display:block}
.ad-btns{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.ad-btns button{background:#1b2740;border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px}
.ad-btns .danger{color:#f87171}
.ad-in{width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px;outline:0;color:var(--txt);margin-bottom:8px}
.ad-badge{font-size:11px;border-radius:8px;padding:2px 8px;margin-inline-start:6px;background:#1b2740;color:var(--acc)}
.ad-msg{background:#1b2740;border-radius:10px;padding:10px;margin-bottom:10px;cursor:pointer}
.ad-h{margin:16px 0 4px;color:var(--mut);font-size:14px}`

export default function Admin() {
  const [ok, setOk] = useState(null), [me, setMe] = useState(null), [tab, setTab] = useState('home')
  const [users, setUsers] = useState([]), [gens, setGens] = useState([]), [unk, setUnk] = useState([]), [unkErr, setUnkErr] = useState(false)
  const [q, setQ] = useState(''), [st, setSt] = useState('all'), [msg, setMsg] = useState('')

  const load = async () => {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return setOk(false)
    const [p, g, u] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      sb.from('generators').select('*').order('created_at', { ascending: false }).limit(300),
      sb.from('unknown_log').select('*').order('created_at', { ascending: false }).limit(300)
    ])
    const prof = p.data || []
    if (prof.find(r => r.id === session.user.id)?.role !== 'admin') return setOk(false)
    setMe(session.user.id); setUsers(prof); setGens(g.data || []); setUnk(u.data || []); setUnkErr(!!u.error); setOk(true)
  }
  useEffect(() => { load() }, [])

  const run = async (fn, m) => { const { error } = await fn(); setMsg(error ? '⚠️ ' + error.message : '✅ ' + m); load() }
  const upUser = (id, v, m) => run(() => sb.from('profiles').update(v).eq('id', id), m)
  const upGen = (id, v, m) => run(() => sb.from('generators').update(v).eq('id', id), m)
  const delGen = g => confirm('حذف «' + g.title + '» نهائيًا؟') && run(() => sb.from('generators').delete().eq('id', g.id), 'اتحذف الإعلان')
  const delUnk = m => run(() => sb.from('unknown_log').delete().eq('msg', m), 'اتمسحت الجملة')

  const email = useMemo(() => Object.fromEntries(users.map(u => [u.id, u.email])), [users])
  const S = useMemo(() => {
    const a = gens.filter(g => g.status === 'active'), wk = Date.now() - 7 * 864e5, c = {}
    a.forEach(g => { c[g.city] = (c[g.city] || 0) + 1 })
    return { active: a.length, hidden: gens.length - a.length, sale: a.filter(g => g.deal === 'sale').length, rent: a.filter(g => g.deal === 'rent').length, tower: a.filter(g => g.kind === 'light_tower').length, newU: users.filter(u => new Date(u.created_at) > wk).length, banned: users.filter(u => u.banned).length, top: Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 5) }
  }, [gens, users])
  const U = useMemo(() => {
    const m = {}
    unk.forEach(r => { m[r.msg] = m[r.msg] || { msg: r.msg, n: 0, at: r.created_at }; m[r.msg].n++ })
    return Object.values(m).sort((a, b) => b.n - a.n)
  }, [unk])

  const ql = q.toLowerCase()
  const fg = gens.filter(g => (st === 'all' || g.status === st) && (!q || [g.title, g.city, g.phone, g.brand, email[g.user_id]].join(' ').toLowerCase().includes(ql)))
  const fu = users.filter(u => !q || (u.email || '').toLowerCase().includes(ql))

  if (ok === null) return <div className="ad"><style>{CSS}</style><p className="ad-h">⏳ بيحمّل...</p></div>
  if (!ok) return <div className="ad"><style>{CSS}</style><p>مش مسموحلك تدخل هنا. <a href="/">رجوع</a></p></div>

  const stats = [['👥', 'المستخدمين', users.length, '+' + S.newU + ' آخر 7 أيام'], ['📦', 'الإعلانات النشطة', S.active, S.hidden + ' مخفي'], ['🏷️', 'بيع / إيجار', S.sale + ' / ' + S.rent, ''], ['💡', 'تاور لايت', S.tower, ''], ['🚫', 'محظورين', S.banned, ''], ['🧠', 'جمل لم تُفهم', U.length, '']]

  return (
    <div className="ad">
      <style>{CSS}</style>
      <div className="ad-top"><b>⚡ لوحة التحكم</b><a href="/">← رجوع للموقع</a></div>
      <div className="ad-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setQ(''); setSt('all') }}>{l}</button>)}</div>
      {msg && <div className="ad-msg" onClick={() => setMsg('')}>{msg}</div>}

      {tab === 'home' && <>
        <div className="ad-grid">{stats.map(([i, l, v, s]) => <div className="ad-stat" key={l}><span>{i} {l}</span><b>{v}</b><small>{s || '\u00a0'}</small></div>)}</div>
        <div className="ad-h">أكتر المدن إعلانات</div>
        <div className="ad-box">{S.top.length ? S.top.map(([c, n]) => <div className="ad-row" key={c}><span>📍 {c}</span><b>{n}</b></div>) : <p className="ad-h">لسه مفيش إعلانات.</p>}</div>
        <div className="ad-h">آخر الإعلانات</div>
        <div className="ad-box">{gens.slice(0, 5).map(g => <div className="ad-row" key={g.id}><div className="t">{g.title}<small>{g.city} · {day(g.created_at)}</small></div><b>{Number(g.price).toLocaleString('en')}</b></div>)}</div>
      </>}

      {tab === 'ads' && <>
        <input className="ad-in" placeholder="🔍 ابحث (عنوان، مدينة، تليفون، إيميل)" value={q} onChange={e => setQ(e.target.value)} />
        <div className="ad-tabs">{[['all', 'الكل'], ['active', 'نشط'], ['hidden', 'مخفي']].map(([k, l]) => <button key={k} className={st === k ? 'on' : ''} onClick={() => setSt(k)}>{l}</button>)}</div>
        <div className="ad-box">
          {!fg.length && <p className="ad-h">مفيش إعلانات.</p>}
          {fg.map(g => (
            <div className="ad-row" key={g.id}>
              <div className="t">{g.title}{g.status !== 'active' && <span className="ad-badge">مخفي</span>}
                <small>{Number(g.price).toLocaleString('en')} جنيه · {g.deal === 'rent' ? 'إيجار' : 'بيع'} · 📍 {g.city} · 📞 {g.phone}</small>
                <small>{email[g.user_id] || '—'} · {day(g.created_at)}</small></div>
              <div className="ad-btns">
                <button onClick={() => upGen(g.id, { status: g.status === 'active' ? 'hidden' : 'active' }, g.status === 'active' ? 'اتخفى' : 'اتظهر')}>{g.status === 'active' ? 'إخفاء' : 'إظهار'}</button>
                <button className="danger" onClick={() => delGen(g)}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      </>}

      {tab === 'users' && <>
        <input className="ad-in" placeholder="🔍 ابحث بالإيميل" value={q} onChange={e => setQ(e.target.value)} />
        <div className="ad-box">
          {fu.map(u => (
            <div className="ad-row" key={u.id}>
              <div className="t">{u.email}{u.role === 'admin' && <span className="ad-badge">أدمن</span>}{u.banned && <span className="ad-badge">محظور</span>}<small>انضم {day(u.created_at)}</small></div>
              {u.id !== me && <div className="ad-btns">
                <button onClick={() => upUser(u.id, { banned: !u.banned }, u.banned ? 'اتفك الحظر' : 'اتحظر')}>{u.banned ? 'فك الحظر' : 'حظر'}</button>
                <button onClick={() => upUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }, 'اتغيرت الصلاحية')}>{u.role === 'admin' ? 'شيل أدمن' : 'خليه أدمن'}</button>
              </div>}
            </div>
          ))}
        </div>
      </>}

      {tab === 'learn' && <>
        <p className="ad-h">الجمل اللي المحرك ماعرفهاش (اتبعتت لـ Gemini). أكتر جملة تتكرر هي أولى بالإضافة في «طور».</p>
        {unkErr && <div className="ad-msg">⚠️ جدول unknown_log مش جاهز، نفّذ SQL الخاص بيه في Supabase.</div>}
        <div className="ad-box">
          {!U.length && !unkErr && <p className="ad-h">مفيش جمل لسه 👌</p>}
          {U.map(r => <div className="ad-row" key={r.msg}><div className="t">{r.msg}<small>{r.n} مرة · آخر مرة {day(r.at)}</small></div><div className="ad-btns"><button className="danger" onClick={() => delUnk(r.msg)}>مسح</button></div></div>)}
        </div>
      </>}
    </div>
  )
}
