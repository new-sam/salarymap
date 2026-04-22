import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

// SVG Characters inline (from mockup)
const Char1 = () => (
  <svg width="100%" viewBox="0 0 268 233" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'block'}}>
    <mask id="m1a" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="0" y="0" width="268" height="233"><rect width="268" height="233" rx="23" fill="#F1FFD2"/></mask>
    <g mask="url(#m1a)"><mask id="m1b" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="-131" y="88" width="441" height="268"><path d="M26.47 150.85C-49.12 90.38-110 125.66-131 150.85V248.48L-33.37 355.56C36.97 352.41 192.75 341.7 253.22 324.07C313.69 306.43 314.11 255.83 306.76 232.74C300.46 169.75 284.09 54.48 268.97 97.31C250.07 150.85 120.95 226.44 26.47 150.85Z" fill="#B3FF00"/></mask><g mask="url(#m1b)"><circle cx="83.16" cy="79.86" r="188.96" fill="#B3FF00"/></g>
    <path d="M129.76 41.37C135.44 41.17 141.02 40.38 146.59 39.25C151.69 39.48 156.72 39.53 161.8 40.14C163.57 40.36 166.43 41.23 168.05 40.59C169.93 41.05 171.85 41.45 173.66 42.13L174.41 42.51C178.9 44.77 183.87 46.01 188.35 48.35C204.66 56.83 215.72 71.53 221.61 88.76C227.78 106.81 225.14 128.35 216.83 145.28C207.86 163.81 191.88 177.99 172.45 184.67C152.52 191.35 127.96 190.47 109.06 180.86C96.57 174.52 85.63 163.66 79.13 151.23C73.85 156.45 66.1 156.95 59.05 156.89C49.57 156.81 36.81 154.21 29.89 147.2C26.08 143.35 23.83 137.89 24.01 132.46C24.21 126.31 26.83 118.91 31.5 114.81C33.77 112.82 35.93 112.37 38.42 110.99C37.57 106.28 38.24 101.2 41.06 97.22C42.38 95.37 44.33 93.71 46.66 93.45C49.16 93.16 51.87 94.42 53.7 96.07C55.83 97.99 56.45 100.83 56.51 103.59C56.61 108.42 54.83 118.67 58.51 122.16C61 124.53 65.28 124.43 68.5 124.34L70.18 123.41L70.66 123.34C71.55 121.7 70.24 113.59 70.43 110.91C71.09 101.24 73.06 92 76.97 83.12C84.2 66.68 99.54 52.78 115.91 45.8C120.15 43.99 124.83 43.35 129.08 41.65L129.76 41.37Z" fill="#3794FE"/>
    <path d="M104.71 76.67C115.75 76.27 127.06 76.86 138.07 77.76C142.55 78.13 146.99 78.77 151.47 79C162.09 79.54 172.75 78.89 183.33 79.43C185.2 79.53 187.57 79.61 189.28 80.39C190.86 82.28 191.16 84.07 190.95 86.5C190.33 93.82 187.49 101.3 181.78 106.11C177.5 109.72 171.95 112.53 166.25 112.02C162.23 111.32 158.62 110.42 155.23 107.99C149.86 104.14 146.86 98.58 146.38 92C146.24 90.14 146.37 88.27 146.07 86.42C145.07 85.81 144.47 86.05 143.34 86.13C140.93 88.83 139.71 95.59 137.66 99.19C135.16 103.56 131.49 106.76 126.56 108C121.61 109.24 116.07 108.1 111.75 105.45C107.44 102.81 103.82 98.34 102.69 93.33C101.52 88.15 101.85 81.24 104.71 76.67Z" fill="#4A4A4A"/>
    <path d="M162.97 84.74C163.54 85.23 164.21 85.55 164.4 86.31C165.2 89.69 162.76 95.28 161.14 98.26C160.03 100.28 159.44 101.13 157.21 101.79C156.34 100.84 155.28 99.71 155.2 98.35C154.96 94.25 160.17 87.45 162.97 84.74Z" fill="#FFFEF8"/>
    <path d="M118.53 84.8C119.57 84.96 119.72 84.88 120.57 85.57C120.93 86.79 120.93 87.78 120.78 89.05C120.32 93.11 118.59 97.91 115.29 100.46C114.84 100.23 114.21 99.96 113.79 99.65C112.85 98.91 112.54 98.45 112.37 97.25C111.85 93.54 116.39 87.7 118.53 84.8Z" fill="#FFFEF8"/>
    <path d="M120.3 116.8C126.5 116.65 128.98 124.89 136.43 128.06C139.21 129.24 142.22 129.8 145.24 129.7C155.56 129.39 155.82 121.35 162.51 119.19C163.7 118.81 164.2 119.02 165.27 119.57C165.64 120.17 165.96 120.73 166.1 121.43C166.54 123.69 165.95 124.97 164.78 126.84C160.58 131.68 155.6 135.22 149.23 136.48C140.9 138.13 132.42 135.29 125.55 130.56C121.88 128.03 118.58 125 117.71 120.44C118.09 118.83 119.18 117.95 120.3 116.8Z" fill="#4A4A4A"/></g></g>
  </svg>
)

const Char2 = () => (
  <svg width="100%" viewBox="0 0 268 233" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'block'}}>
    <mask id="m2a" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="0" y="0" width="268" height="233"><rect width="268" height="233" rx="23" fill="#F1FFD2"/></mask>
    <g mask="url(#m2a)"><mask id="m2b" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="-131" y="88" width="441" height="268"><path d="M26.47 150.85C-49.12 90.38-110 125.66-131 150.85V248.48L-33.37 355.56C36.97 352.41 192.75 341.7 253.22 324.07C313.69 306.43 314.11 255.83 306.76 232.74C300.46 169.75 284.09 54.48 268.97 97.31C250.07 150.85 120.95 226.44 26.47 150.85Z" fill="#B3FF00"/></mask><g mask="url(#m2b)"><circle cx="83.16" cy="79.86" r="188.96" fill="#B3FF00"/></g>
    <path d="M135.5 63.23C137.7 52.56 142.73 40.29 152.2 34.03C155 32.18 158.95 30.7 162.37 31.29C163.85 31.55 165.19 32.37 165.97 33.67C170.7 41.54 163.93 68.45 161.78 77.05C169.69 66.8 178.04 58.44 191.59 56.81C195.7 56.32 202.45 56.46 205.87 59.1C206.91 59.91 207.55 61.02 207.69 62.33C208.03 65.52 205.95 68.79 203.91 71.06C199.47 76.01 193.46 79.62 188.52 84.06C192.17 86.79 195.01 89.96 196.51 94.33C199.38 102.7 196.21 110.45 192.48 117.9C198.27 117.72 203.03 118.03 208.08 121.14C212.33 123.75 215.58 127.79 216.65 132.7C217.53 136.71 216.74 140.91 214.47 144.34C210.63 150.23 204.15 152.51 197.6 153.95C199.86 157.39 201.85 160.87 203.01 164.84C204.72 170.73 204.6 177.16 201.53 182.59C198.98 187.12 194.7 190.21 189.7 191.56C181.45 193.8 173.92 191.55 166.71 187.45C166.22 191.12 165.43 194.82 163.71 198.12C160.42 204.4 154.66 208.48 147.92 210.47C139.08 213.08 128.29 212.44 120.16 207.9C112.63 203.69 109.5 197.45 107.19 189.5C102.61 192.64 97.98 194.89 92.37 195.44C86.71 196 80.86 194.51 76.49 190.77C73.1 187.92 71.03 183.81 70.75 179.39C70.28 171.56 74.59 165.52 79.52 159.95C74.63 159.27 70.18 158.48 66.13 155.46C62.64 152.84 60.37 149.07 59.86 144.72C59.29 139.62 60.8 134.51 64.04 130.52C68.86 124.59 75.24 123.05 82.52 122.27C78.67 119.08 75.78 115.4 74.37 110.53C72.97 105.67 73.35 100.14 75.85 95.69C78.23 91.48 82.25 88.65 86.91 87.45C94.59 85.47 100.99 88.27 107.5 92.01C107.48 89.25 107.52 86.5 107.91 83.77C109.17 74.88 113.61 69.48 120.53 64.25C122.85 63.12 125.65 62.68 128.17 62.1C130.72 62.27 133.03 62.58 135.5 63.23Z" fill="#3794FE"/>
    <path d="M135.5 63.23C137.7 52.56 142.73 40.29 152.2 34.03C155 32.18 158.95 30.7 162.37 31.29C163.85 31.55 165.19 32.37 165.97 33.67C170.7 41.54 163.93 68.45 161.78 77.05C169.69 66.8 178.04 58.44 191.59 56.81C195.7 56.32 202.45 56.46 205.87 59.1C206.91 59.91 207.55 61.02 207.69 62.33C208.03 65.52 205.95 68.79 203.91 71.06C199.47 76.01 193.46 79.62 188.52 84.06C183.98 81.95 179.44 80.67 174.37 80.85C165.19 81.19 159.14 86.08 153.21 92.5C153.33 86.9 152.72 81.4 150.32 76.27C147.24 69.69 142.24 65.7 135.5 63.23Z" fill="#02CF99"/>
    <circle cx="116" cy="134" r="17" fill="white"/>
    <circle cx="154" cy="134" r="15" fill="white"/>
    <circle cx="113" cy="135" r="7" fill="#4A4A4A"/>
    <circle cx="153" cy="134" r="6" fill="#4A4A4A"/>
    <path d="M123 165C127 170 141 172 149 165" stroke="#4A4A4A" strokeWidth="3" strokeLinecap="round"/></g></g>
  </svg>
)

const Char3 = () => (
  <svg width="100%" viewBox="0 0 268 233" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'block'}}>
    <mask id="m3a" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="0" y="0" width="268" height="233"><rect width="268" height="233" rx="23" fill="#F1FFD2"/></mask>
    <g mask="url(#m3a)"><mask id="m3b" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="-131" y="88" width="441" height="268"><path d="M26.47 150.85C-49.12 90.38-110 125.66-131 150.85V248.48L-33.37 355.56C36.97 352.41 192.75 341.7 253.22 324.07C313.69 306.43 314.11 255.83 306.76 232.74C300.46 169.75 284.09 54.48 268.97 97.31C250.07 150.85 120.95 226.44 26.47 150.85Z" fill="#B3FF00"/></mask><g mask="url(#m3b)"><circle cx="83.16" cy="79.86" r="188.96" fill="#B3FF00"/></g>
    <path d="M124.24 26.19C128.14 25.8 132.22 25.98 135.99 27.06C142.58 28.93 146.62 32.95 149.87 38.86C151.76 36.93 153.75 35.22 156.23 34.12C161.81 31.63 168.22 31.96 173.8 34.23C178.85 36.29 183.5 40.08 185.54 45.29C187.37 49.98 186.62 54.05 184.66 58.53C187.08 58.15 189.52 57.86 191.96 57.66C198.28 57.17 205.32 58.69 210.17 62.99C214.2 66.56 216.37 71.72 216.6 77.08C216.85 83.11 214.9 88.26 210.85 92.63C215.78 94.79 219.87 97.74 222.76 102.41C225.91 107.47 226.75 113.91 225.34 119.68C223.84 125.78 220.26 129.45 215.03 132.55C217.49 136.2 219.05 139.47 219.71 143.87C220.86 151.54 217.77 161.47 210.41 165.16C208.89 165.92 201 166.68 200.6 167.66C200.38 168.2 200.52 169.78 200.49 170.41C200.24 175.29 199.16 179.03 196.19 183.01C192.99 187.3 188.23 189.84 182.96 190.47C175.19 191.4 169.18 188.32 163.27 183.59C161.21 188.32 158.61 192.39 154.04 194.98C149.32 197.66 144.18 197.37 139.15 195.88C134.02 193.06 130.83 189.97 127.8 184.94C127.42 185.42 127.06 185.92 126.69 186.41C122.42 191.96 116.37 195.41 109.42 196.25C104.41 196.86 99.16 195.9 95.16 192.65C91.01 189.29 89.63 184.99 89.07 179.84C86.16 182.47 83.25 184.56 79.52 185.85C74.8 187.49 69.5 187.55 64.99 185.22C61.56 183.45 59.09 180.35 57.98 176.64C55.87 169.66 58.31 162.76 61.56 156.6C61.18 156.57 60.79 156.54 60.41 156.5C54.51 155.93 48.9 153.4 45.15 148.65C41.76 144.35 40.52 138.84 41.16 133.44C42.14 125.29 46.36 118.98 52.59 113.94C49.66 109.52 47.79 104.62 47.34 99.3C46.74 92.24 48.52 84.94 53.21 79.53C58.13 73.86 64.11 72.22 71.31 71.68C70.1 64.26 70.07 57.36 73.43 50.47C76.58 43.99 81.96 39.04 88.77 36.75C96.48 34.15 103.7 34.98 110.87 38.6C111.49 37.09 112.1 35.55 112.88 34.13C115.51 29.31 119.18 27.62 124.24 26.19Z" fill="#005DBA"/>
    <path d="M92.6 81.68C93.99 81.97 95.26 82.47 96.58 83.01C101.37 85 125.84 95.76 127.01 99.51C127.21 100.13 127.22 100.01 126.92 100.57C124.89 104.43 112.77 106.44 108.58 107.53C106.53 108.17 104.46 108.84 102.33 109.16C100.45 109.44 98.81 109.27 97.26 108.13C97.24 107.36 97.18 107.29 97.56 106.53C99.87 101.93 107.31 100.42 111.76 99.09C105.72 95.77 98.6 93.97 92.84 90.16C90.85 88.84 90.02 87.87 89.56 85.53C90.09 83.62 91.13 82.86 92.6 81.68Z" fill="white"/>
    <path d="M175.91 81.02C177.41 81.03 178.41 81.35 179.77 81.97C180.64 83.28 180.58 83.35 180.47 84.83C177.57 89.91 162.61 96.14 156.99 99.02C160.95 100.22 165.09 101.28 168.91 102.87C171.11 103.78 173.14 104.71 174.12 107.02C173.67 108.58 173.45 108.71 172.28 109.73C170.12 110.34 168.23 109.68 166.11 109.16C159.48 107.13 148.41 106.62 143.12 102.28C142.88 101.46 142.67 101.25 142.98 100.4C144.74 95.62 170.22 83.98 175.91 81.02Z" fill="white"/>
    <path d="M130.28 113.59C136.84 113.19 142.56 113.72 148.33 117.21C152.55 119.77 157.2 124.42 158.24 129.46C158.49 130.67 158.46 130.85 157.81 131.86C152.49 132.63 144.16 122.8 138.37 120.65L137.7 120.41C121.25 117.61 120.36 132.24 111.62 132.43C110.81 131.9 110.54 131.95 110.22 130.97C109.68 129.27 110.37 127.2 111.24 125.73C115.4 118.73 122.69 115.21 130.28 113.59Z" fill="white"/></g></g>
  </svg>
)

export default function NextStepSheet({ role, experience, percentile, topCompanies }) {
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState(null) // null | 'open' | 'selective' | 'none'
  const [jobs, setJobs] = useState([])
  const router = useRouter()
  const userSalary = typeof window !== 'undefined' ? parseInt(localStorage.getItem('fyi_salary')) || 0 : 0

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch('/api/jobs')
        if (!res.ok) return
        const data = await res.json()
        setJobs(data.filter(j => j.salary_min > userSalary).slice(0, 3))
      } catch {}
    }
    fetchJobs()
  }, [userSalary])

  if (!visible) return null

  const jobCount = jobs.length
  const bgColors = ['#e8ecf5', '#f0ece8', '#e8f0ec']

  const handleSelect = (intent) => {
    setSelected(intent)
    if (typeof window !== 'undefined') localStorage.setItem('fyi_intent', intent)
    // Scroll to post content
    setTimeout(() => {
      document.getElementById('ns-post')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  const cardStyle = (intent) => ({
    display: 'flex', flexDirection: 'column', cursor: 'pointer', borderRadius: 16, overflow: 'hidden',
    border: selected === intent
      ? (intent === 'none' ? '1.5px solid #aaa' : '1.5px solid #0080FF')
      : '1.5px solid #ebebeb',
    background: '#fff', transition: 'all .18s cubic-bezier(.16,1,.3,1)',
    boxShadow: selected === intent
      ? (intent === 'none' ? '0 0 0 3px rgba(0,0,0,0.06)' : '0 0 0 3px rgba(0,128,255,0.15), 0 6px 20px rgba(0,128,255,0.15)')
      : '0 2px 8px rgba(0,0,0,0.06)',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  })

  return (
    <>
      <div onClick={() => setVisible(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '28px 28px 0 0',
        zIndex: 500, boxShadow: '0 -20px 80px rgba(0,0,0,0.4)',
        animation: 'nsSlideUp 0.4s cubic-bezier(.16,1,.3,1)',
        maxHeight: '85vh', overflowY: 'auto',
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}>
        <style>{`
          @keyframes nsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>

        {/* Handle */}
        <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '14px auto 0' }} />

        <div style={{ padding: '14px 18px 28px' }}>

          {/* Title */}
          <div style={{ fontSize: 19, fontWeight: 800, color: '#111', lineHeight: 1.35, textAlign: 'center', marginBottom: 8 }}>
            Do you want us to connect<br/>you with a <span style={{ color: '#0080FF' }}>better-paying</span> company?
          </div>
          <div style={{ fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
            We helped <b style={{ color: '#0080FF' }}>3,000+</b> engineers earn more than <b style={{ color: '#0080FF' }}>10%</b> of their current salary.
          </div>

          {/* 3 Intent cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {/* Card 1 */}
            <div style={cardStyle('open')} onClick={() => handleSelect('open')}>
              <div><Char1 /></div>
              <div style={{ padding: '10px 8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: selected === 'open' ? '#005ecc' : '#0080FF', textAlign: 'center', lineHeight: 1.3, border: 'none', background: 'none', cursor: 'pointer' }}>
                  Yes, available for<br/>better job offers
                </div>
                <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center', lineHeight: 1.4 }}>I want to find a fit job now</div>
              </div>
            </div>

            {/* Card 2 */}
            <div style={cardStyle('selective')} onClick={() => handleSelect('selective')}>
              <div><Char2 /></div>
              <div style={{ padding: '10px 8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: selected === 'selective' ? '#005ecc' : '#0080FF', textAlign: 'center', lineHeight: 1.3 }}>
                  Open if it's<br/>the right fit
                </div>
                <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center', lineHeight: 1.4 }}>I'd consider it for the right role and salary</div>
              </div>
            </div>

            {/* Card 3 */}
            <div style={cardStyle('none')} onClick={() => handleSelect('none')}>
              <div><Char3 /></div>
              <div style={{ padding: '10px 8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#888', textAlign: 'center', lineHeight: 1.3 }}>Not right now</div>
                <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center', lineHeight: 1.4 }}>I'm happy where I am</div>
              </div>
            </div>
          </div>

          {/* Maybe later */}
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <button onClick={() => setVisible(false)}
              style={{ padding: 8, background: 'transparent', border: 'none', fontSize: 11, color: '#ccc', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", letterSpacing: '.01em' }}>
              Maybe later
            </button>
          </div>

          {/* Post-select content */}
          <div id="ns-post">
            {/* Opt 1 or 2: Jobs preview */}
            {(selected === 'open' || selected === 'selective') && (
              <div>
                {/* Match message */}
                {jobCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0fff4', border: '1px solid #86efac', borderRadius: 10, padding: '9px 12px', marginBottom: 12 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: '#444', lineHeight: 1.4 }}>
                      We found <b style={{ color: '#111' }}>{jobCount} jobs</b> that pay more than you right now
                    </div>
                  </div>
                )}

                {/* Blurred jobs preview */}
                {jobCount > 0 && (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', marginBottom: 14 }}>
                    <div style={{ display: 'flex', filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' }}>
                      {jobs.map((job, i) => {
                        const initials = job.company_initials || (job.company || '').slice(0, 2).toUpperCase()
                        const bump = Math.round(((job.salary_min - userSalary) / userSalary) * 100)
                        return (
                          <div key={i} style={{ flex: i === 2 ? '0 0 30%' : '0 0 52%', borderRight: '1px solid #f0f0f0', opacity: i === 2 ? 0.6 : 1, background: '#fff' }}>
                            <div style={{ height: 72, background: `url(${job.images?.[0] || job.image_url || ''}) center/cover no-repeat, ${bgColors[i % 3]}`, position: 'relative' }}>
                              <div style={{ position: 'absolute', bottom: 8, left: 8, width: 26, height: 26, borderRadius: 5, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#333' }}>
                                {initials}
                              </div>
                            </div>
                            <div style={{ padding: '8px 10px 10px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{job.title}</div>
                              <div style={{ fontSize: 10, color: '#aaa', marginBottom: 5 }}>{job.company} · {job.location}</div>
                              <div style={{ fontSize: 10, color: '#bbb', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ textDecoration: 'line-through' }}>{userSalary}M</span>
                                <span>→</span>
                                <span style={{ color: '#111', fontWeight: 700 }}>{Math.round(job.salary_min / 1e6)}–{Math.round(job.salary_max / 1e6)}M</span>
                                {bump > 0 && <span style={{ background: '#fff4f0', color: '#ff4400', fontWeight: 700, padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>+{bump}%</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: 20 }}>🔒</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Sign in to see & apply</span>
                    </div>
                    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, transparent, #fff)', pointerEvents: 'none' }} />
                  </div>
                )}

                <button onClick={() => router.push('/jobs')}
                  style={{ width: '100%', padding: 13, background: '#0080FF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", boxShadow: '0 4px 16px rgba(0,128,255,0.25)', marginBottom: 8 }}>
                  See all jobs →
                </button>
                <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center' }}>🔒 No spam. We only reach out when it's worth your time.</div>
              </div>
            )}

            {/* Opt 3: Browse freely */}
            {selected === 'none' && (
              <div>
                <button onClick={() => setVisible(false)}
                  style={{ width: '100%', padding: 13, background: '#111', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: 8 }}>
                  Browse salary data →
                </button>
                <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center' }}>No sign-up needed. Explore all company salaries freely.</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
