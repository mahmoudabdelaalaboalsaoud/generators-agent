'use client'
import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'

export default function Settings({ s, admin, logout, onMine }) {
  const u = s.user, md = u.user_metadata || {}
  const [name, setName] = useState(md.full_name || md.name || ''), [phone, setPhone] = useState(md.phone || '')
  const [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [n, setN] = useState(null)
  useEffect(() => { sb.from('generators').select('id', { count: 'exact', head: true }).eq('user_id', u.id).then(({ count }) => setN(count)) }, [])
  const save = async () => { const { error } = await sb.auth.updateUser({ data: { full_name: name, phone } }); setMsg(error ? '⚠️ ' + error.message : '✅ اتحفظت البيانات') }
  const chpw = async () => {
    if (pw.length < 6) return setMsg('⚠️ الباسورد لازم يكون 6 حروف على الأقل')
    const { error } = await sb.auth.updateUser({ password: pw }); setPw('')
    setMsg(error ? '⚠️ ' + error.message : '✅ اتغير الباسورد')
  }
  return (
    <div className="wrap">
      <h3>⚙️ إعدادات الحساب</h3>
      {msg && <div className="st-msg" onClick={() => setMsg('')}>{msg}</div>}
      <div className="st-card">
        <div>{u.email} <span className="tag">{admin ? '· أدمن 👑' : '· مستخدم'}</span></div>
        <div className="tag">انضممت {new Date(u.created_at).toLocaleDateString('ar-EG')} · إعلاناتي: {n ?? '...'}</div>
        <div className="chips" style={{ justifyContent: 'flex-start' }}>
          <button className="chip" onClick={onMine}>📦 شوف إعلاناتي</button>
          {admin && <button className="chip on" onClick={() => { location.href = '/admin' }}>📊 لوحة التحكم والإحصائيات</button>}
        </div>
      </div>
      <div className="st-card">
        <div className="st-h">البيانات الشخصية</div>
        <input className="st-in" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} />
        <input className="st-in" placeholder="رقم التليفون" value={phone} onChange={e => setPhone(e.target.value)} />
        <button className="pbtn" onClick={save}>حفظ</button>
      </div>
      <div className="st-card">
        <div className="st-h">تغيير الباسورد</div>
        <input className="st-in" type="password" placeholder="باسورد جديد (6 حروف على الأقل)" value={pw} onChange={e => setPw(e.target.value)} />
        <button className="pbtn" onClick={chpw}>تغيير</button>
      </div>
      <button className="pbtn" style={{ background: '#22304a', color: '#fff', marginTop: 16 }} onClick={logout}>تسجيل الخروج</button>
    </div>
  )
}
