'use client'
import { useState, useEffect, useRef } from 'react'
import { sb } from '../lib/supabase'
const btn = { padding: '10px 14px', border: 0, borderRadius: 8, background: '#0b6e4f', color: '#fff', fontSize: 16 }
const inp = { padding: 10, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', marginBottom: 8 }

export default function Home() {
  const [s, setS] = useState(null), [ready, setReady] = useState(false)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setS(data.session); setReady(true) })
    const { data } = sb.auth.onAuthStateChange((_e, x) => setS(x))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return null
  return s ? <Chat s={s} /> : <Login />
}

function Login() {
  const [e, setE] = useState(''), [p, setP] = useState(''), [m, setM] = useState('')
  const go = async up => {
    const { error } = up ? await sb.auth.signUp({ email: e, password: p, options: { emailRedirectTo: location.origin } }) : await sb.auth.signInWithPassword({ email: e, password: p })
    setM(error ? error.message : up ? 'اتبعتلك إيميل تأكيد، افتحه وبعدين ادخل' : '')
  }
  return (
    <div style={{ maxWidth: 380, margin: '60px auto', padding: 16 }}>
      <h2>⚡ وكيل المولدات</h2>
      <button style={{ ...btn, width: '100%', marginBottom: 12, background: '#db4437' }} onClick={() => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })}>دخول بجوجل</button>
      <input style={inp} placeholder="الإيميل" value={e} onChange={x => setE(x.target.value)} />
      <input style={inp} type="password" placeholder="الباسورد" value={p} onChange={x => setP(x.target.value)} />
      <button style={btn} onClick={() => go(false)}>دخول</button>{' '}
      <button style={{ ...btn, background: '#555' }} onClick={() => go(true)}>حساب جديد</button>
      <p style={{ color: 'crimson' }}>{m}</p>
    </div>
  )
}

function Chat({ s }) {
  const [msgs, setMsgs] = useState([]), [t, setT] = useState(''), [files, setFiles] = useState([]), [busy, setBusy] = useState(false), [admin, setAdmin] = useState(false)
  const end = useRef()
  useEffect(() => { sb.from('profiles').select('role').eq('id', s.user.id).single().then(({ data }) => setAdmin(data?.role === 'admin')) }, [])
  useEffect(() => { end.current?.scrollIntoView() }, [msgs])

  const send = async () => {
    if (busy || (!t && !files.length)) return
    setBusy(true)
    const images = []
    for (const [i, f] of files.entries()) {
      const path = `${s.user.id}/${Date.now()}-${i}.jpg`
      const { error } = await sb.storage.from('generators').upload(path, f, { contentType: f.type })
      if (!error) images.push(sb.storage.from('generators').getPublicUrl(path).data.publicUrl)
    }
    const next = [...msgs, { role: 'user', content: t || 'شوف الصور', images }]
    setMsgs(next); setT(''); setFiles([])
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ messages: next }) })
      const j = await r.json()
      setMsgs([...next, { role: 'assistant', content: j.reply || j.error || 'حصل خطأ', images: [] }])
    } catch { setMsgs([...next, { role: 'assistant', content: 'حصل خطأ، جرب تاني', images: [] }]) }
    setBusy(false)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12, paddingBottom: 110 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <b>⚡ وكيل المولدات</b>
        <span>{admin && <a href="/admin" style={{ marginInlineEnd: 12 }}>لوحة التحكم</a>}<a href="#" onClick={() => sb.auth.signOut()}>خروج</a></span>
      </div>
      {!msgs.length && <p style={{ color: '#666' }}>اكتبلي: «عايز مولد ٣٠ كيلو للإيجار في طنطا» أو «عندي مولد بيركنز للبيع» وابعت صوره.</p>}
      {msgs.map((m, i) => {
        const urls = m.role === 'user' ? m.images : (m.content.match(/https?:\/\/\S+\.(jpg|jpeg|png|webp)/gi) || [])
        return (
          <div key={i} style={{ background: m.role === 'user' ? '#d1fae5' : '#fff', padding: 10, borderRadius: 10, margin: '8px 0', whiteSpace: 'pre-wrap' }}>
            {m.content}
            <div>{urls.map(u => <img key={u} src={u} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8, margin: 4 }} />)}</div>
          </div>
        )
      })}
      {busy && <p>⏳ بيكتب...</p>}
      <div ref={end} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', padding: 10, borderTop: '1px solid #ddd' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 26 }}>📷<input type="file" accept="image/*" multiple hidden onChange={e => setFiles([...e.target.files])} /></label>
          <input style={{ ...inp, marginBottom: 0 }} placeholder={files.length ? files.length + ' صور مرفقة...' : 'اكتب هنا'} value={t} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
          <button style={btn} onClick={send}>إرسال</button>
        </div>
      </div>
    </div>
  )
}
