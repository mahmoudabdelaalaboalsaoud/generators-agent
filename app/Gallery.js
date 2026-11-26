'use client'
import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
const SIZES = { s: [0, 30], m: [30, 100], l: [100, 250], xl: [250, 100000] }
const Row = ({ items, val, set }) => (
  <div className="chips" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
    {items.map(([k, l]) => <button key={k} className={'chip' + (val === k ? ' on' : '')} onClick={() => set(k)}>{l}</button>)}
  </div>
)
export default function Gallery() {
  const [rows, setRows] = useState([]), [kind, setKind] = useState('all'), [deal, setDeal] = useState('all'), [size, setSize] = useState('all'), [city, setCity] = useState(''), [load, setLoad] = useState(true)
  useEffect(() => {
    setLoad(true)
    let q = sb.from('generators').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(60)
    if (kind !== 'all') q = q.eq('kind', kind)
    if (deal !== 'all') q = q.eq('deal', deal)
    if (size !== 'all') q = q.gte('kva', SIZES[size][0]).lt('kva', SIZES[size][1])
    if (city.trim()) q = q.ilike('city', `%${city.trim()}%`)
    q.then(({ data }) => { setRows(data || []); setLoad(false) })
  }, [kind, deal, size, city])
  return (
    <div className="wrap">
      <Row val={kind} set={setKind} items={[['all', 'الكل'], ['generator', '⚡ مولدات'], ['light_tower', '💡 تاور لايت']]} />
      <Row val={deal} set={setDeal} items={[['all', 'بيع وإيجار'], ['sale', 'بيع'], ['rent', 'إيجار']]} />
      <Row val={size} set={setSize} items={[['all', 'كل القدرات'], ['s', 'حتى 30'], ['m', '30–100'], ['l', '100–250'], ['xl', '+250']]} />
      <input className="inbox" style={{ width: '100%', marginTop: 10, padding: 12, outline: 0, background: 'var(--card)', color: 'var(--txt)' }} placeholder="🔍 المدينة (مثلاً طنطا)" value={city} onChange={e => setCity(e.target.value)} />
      {load && <p className="tag">⏳ بيحمّل...</p>}
      {!load && !rows.length && <p className="tag">مفيش إعلانات بالمواصفات دي.</p>}
      <div className="grid">
        {rows.map(g => (
          <div className="card" key={g.id}>
            {g.images?.[0] ? <img src={g.images[0]} /> : <div className="ph">⚡</div>}
            <div className="cb">
              <div>{g.title}</div>
              <div className="tag">{g.kind === 'light_tower' ? 'تاور لايت' : 'مولد'} · {g.kva ? g.kva + ' كيلو · ' : ''}{g.deal === 'rent' ? 'إيجار' : 'بيع'}</div>
              <div className="price">{Number(g.price).toLocaleString('en')} جنيه</div>
              <div className="tag">📍 {g.city}</div>
              <div className="acts"><a href={'tel:' + g.phone}>📞 اتصل</a><a href={'https://wa.me/20' + String(g.phone).replace(/^0/, '')} target="_blank">واتساب</a></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
