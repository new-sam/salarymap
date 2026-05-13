import { DATA_KEYS } from '../constants/dashboard'

export function getDoD(daily, dataKey) {
  if (!daily || daily.length < 2) return null
  const last = daily[daily.length - 1][dataKey]
  const prev = daily[daily.length - 2][dataKey]
  if (last === null || last === undefined || prev === null || prev === undefined) return null
  if (prev === 0) return last > 0 ? 100 : 0
  return Math.round(((last - prev) / prev) * 100)
}

export function aggregateDaily(daily, mode) {
  if (!daily || mode === '1d') return daily
  const buckets = {}
  const firstDate = daily.length > 0 ? new Date(daily[0].date) : new Date()
  for (const d of daily) {
    let key
    if (mode === '3d') {
      const dt = new Date(d.date)
      const diff = Math.floor((dt - firstDate) / (3 * 86400000))
      const bucket = new Date(firstDate.getTime() + diff * 3 * 86400000)
      key = bucket.toISOString().slice(0, 10)
    } else if (mode === 'weekly') {
      const dt = new Date(d.date)
      const day = dt.getDay()
      const mon = new Date(dt)
      mon.setDate(dt.getDate() - ((day + 6) % 7))
      key = mon.toISOString().slice(0, 10)
    } else {
      key = d.date.slice(0, 7)
    }
    if (!buckets[key]) buckets[key] = { date: key }
    for (const k of DATA_KEYS) {
      const val = d[k]
      if (val === null || val === undefined) continue
      buckets[key][k] = (buckets[key][k] || 0) + val
    }
  }
  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date))
}

export function localDate(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function sumDailyFrom(daily, keys, since) {
  const filtered = daily.filter(d => d.date >= since)
  const sums = {}
  for (const k of keys) {
    sums[k] = filtered.reduce((acc, d) => acc + (d[k] || 0), 0)
  }
  return sums
}
