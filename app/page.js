'use client'
import { useState, useEffect, useRef } from 'react'
import { sb } from '../lib/supabase'
import Gallery from './Gallery'

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
    <div className="login">
      <div className="hero" style={{ marginTop: 0 }}><div className="bolt">⚡</div><h2>وكيل المولدات</h2></div>
      <button className="gbtn" onClick={() => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })}>دخول بجوجل</button>
      <input placeholder="الإيميل" value={e} onChange={x => setE(x.target.value)} />
      <input type="password" placeholder="الباسورد" value={p} onChange={x => setP(x.target.value)} />
      <button className="pbtn" onClick={() => go(false)}>دخول</button>{' '}
      <button className="pbtn" style={{ background: '#22304a', color: '#fff' }} onClick={() => go(true)}>حساب جديد</button>
      <p style={{ color: '#f87171' }}>{m}</p>
    </div>
  )
}

function Chat({ s }) {
  const [tab, setTab] = useState('chat'), [msgs, setMsgs] = useState([]), [t, setT] = useState(''), [files, setFiles] = useState([]), [busy, setBusy] = useState(false), [admin, setAdmin] = useState(false)
  const end = useRef()
  useEffect(() => { sb.from('profiles').select('role').eq('id', s.user.id).single().then(({ data }) => setAdmin(data?.role === 'admin')) }, [])
  useEffect(() => { end.current?.scrollIntoView() }, [msgs, tab])

  const send = async txt => {
    const text = typeof txt === 'string' ? txt : t
    if (busy || (!text && !files.length)) return
    setBusy(true)
    const images = []
    for (const [i, f] of files.entries()) {
      const path = `${s.user.id}/${Date.now()}-${i}.jpg`
      const { error } = await sb.storage.from('generators').upload(path, f, { contentType: f.type })
      if (!error) images.push(sb.storage.from('generators').getPublicUrl(path).data.publicUrl)
    }
    const next = [...msgs, { role: 'user', content: text || 'شوف الصور', images }]
    setMsgs(next); setT(''); setFiles([])
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ messages: next }) })
      const j = await r.json()
      setMsgs([...next, { role: 'assistant', content: j.reply || j.error || 'حصل خطأ', images: [] }])
    } catch { setMsgs([...next, { role: 'assistant', content: 'حصل خطأ، جرب تاني', images: [] }]) }
    setBusy(false)
  }

  const re = /https?:\/\/\S+\.(jpg|jpeg|png|webp)/gi
  return (
    <>
      <div className="top">
        <span className="logo">⚡ وكيل المولدات</span>
        <span>{admin && <a href="/admin" style={{ marginInlineEnd: 12 }}>لوحة التحكم</a>}<a href="#" onClick={() => sb.auth.signOut()}>خروج</a></span>
      </div>
      {tab === 'gallery' ? <Gallery /> : (
        <div className="wrap">
          {!msgs.length && (
            <div className="hero">
              <div className="bolt">⚡</div>
              <h2>أهلاً بيك</h2>
              <div className="tag">دوّر على مولد أو تاور لايت، أو انزل إعلانك</div>
              <div className="chips">
                <button className="chip" onClick={() => setT('عايز مولد ')}>🔍 دوّر على مولد</button>
                <button className="chip" onClick={() => send('عايز تاور لايت للايجار')}>💡 تاور لايت</button>
                <button className="chip" onClick={() => send('انزل اعلان')}>📢 انزل إعلان</button>
                <button className="chip" onClick={() => setT('احسب احمال  كيلو وات')}>📐 احسب القدرة</button>
              </div>
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user'
            ? <div key={i} className="u">{m.content}<div className="imgs">{m.images?.map(u => <img key={u} src={u} />)}</div></div>
            : <div key={i} className="a">{m.content.replace(re, '')}<div className="imgs">{(m.content.match(re) || []).map(u => <img key={u} src={u} />)}</div></div>)}
          {busy && <div className="a">بيكتب...</div>}
          <div ref={end} />
        </div>
      )}
      <div className="dock">
        {tab === 'chat' && (
          <div className="box">
            {files.length > 0 && <div className="tag" style={{ marginBottom: 4 }}>📷 {files.length} صور مرفقة</div>}
            <div className="inbox">
              <label className="ic">📷<input type="file" accept="image/*" multiple hidden onChange={e => setFiles([...e.target.files])} /></label>
              <input type="text" placeholder="اكتب هنا..." value={t} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
              <button className="send" onClick={send}>↑</button>
            </div>
          </div>
        )}
        <div className="nav">
          <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>💬 المحادثة</button>
          <button className={tab === 'gallery' ? 'on' : ''} onClick={() => setTab('gallery')}>🏭 المعرض</button>
        </div>
      </div>
    </>
  )
}
