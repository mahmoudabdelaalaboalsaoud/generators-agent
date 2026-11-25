'use client'
import { useState, useEffect } from 'react'
import { sb } from '../../lib/supabase'
export default function Admin() {
  const [rows, setRows] = useState([]), [me, setMe] = useState(null)
  const load = async () => {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return setMe('no')
    const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false })
    setMe(data?.find(r => r.id === session.user.id)?.role === 'admin' ? 'admin' : 'no')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])
  const upd = async (id, v) => { await sb.from('profiles').update(v).eq('id', id); load() }
  if (me === 'no') return <p style={{ padding: 20 }}>مش مسموحلك. <a href="/">رجوع</a></p>
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 12 }}>
      <h3>👥 المستخدمين ({rows.length}) <a href="/" style={{ fontSize: 14 }}>رجوع</a></h3>
      {rows.map(r => (
        <div key={r.id} style={{ background: '#fff', padding: 10, borderRadius: 8, margin: '6px 0' }}>
          <div>{r.email} {r.role === 'admin' && '👑'} {r.banned && '🚫'}</div>
          <button onClick={() => upd(r.id, { banned: !r.banned })}>{r.banned ? 'فك الحظر' : 'حظر'}</button>{' '}
          <button onClick={() => upd(r.id, { role: r.role === 'admin' ? 'user' : 'admin' })}>{r.role === 'admin' ? 'شيل أدمن' : 'خليه أدمن'}</button>
        </div>
      ))}
    </div>
  )
}
