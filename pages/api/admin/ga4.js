import { verifyAdmin } from './check'

export const config = { runtime: 'nodejs' }

const GA4_PROPERTY_ID = '533725598'

function getCredentials() {
  // Prefer JSON keyfile (reliable format)
  const fs = require('node:fs')
  const path = require('node:path')
  const keyFile = path.join(process.cwd(), 'ga4-service-account.json')
  if (fs.existsSync(keyFile)) {
    const creds = JSON.parse(fs.readFileSync(keyFile, 'utf8'))
    return { client_email: creds.client_email, private_key: creds.private_key }
  }
  // Fallback: env vars (Vercel)
  if (process.env.GA4_CLIENT_EMAIL && process.env.GA4_PRIVATE_KEY) {
    return {
      client_email: process.env.GA4_CLIENT_EMAIL,
      private_key: process.env.GA4_PRIVATE_KEY.replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
    }
  }
  throw new Error('GA4 credentials not found')
}

function base64url(data) {
  return Buffer.from(data).toString('base64url')
}

let _tokenCache = { token: null, expiry: 0 }

async function getCachedToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiry) return _tokenCache.token
  const crypto = require('node:crypto')
  const creds = getCredentials()
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const signInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signInput)
  const signature = sign.sign(creds.private_key, 'base64url')
  const jwt = `${signInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (data.error) throw new Error(`Token error: ${data.error_description}`)
  _tokenCache = { token: data.access_token, expiry: Date.now() + 50 * 60 * 1000 }
  return data.access_token
}

async function runReport({ startDate, endDate, dimensions = [], metrics = [], orderBys, limit }) {
  const token = await getCachedToken()
  const requestBody = {
    dateRanges: [{ startDate, endDate }],
    metrics: metrics.map(m => ({ name: m })),
  }
  if (dimensions.length) requestBody.dimensions = dimensions.map(d => ({ name: d }))
  if (orderBys) requestBody.orderBys = orderBys
  if (limit) requestBody.limit = limit

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `GA4 API ${res.status}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query

  try {
    const [daily, channels, devices, landingPages, totals, today, utmReport] = await Promise.all([
      // Daily sessions
      runReport({
        startDate: from, endDate: to,
        dimensions: ['date'],
        metrics: ['sessions', 'totalUsers', 'newUsers', 'engagedSessions', 'conversions'],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }).then(data => (data.rows || []).map(r => ({
        date: r.dimensionValues[0].value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        sessions: parseInt(r.metricValues[0].value),
        totalUsers: parseInt(r.metricValues[1].value),
        newUsers: parseInt(r.metricValues[2].value),
        engagedSessions: parseInt(r.metricValues[3].value),
        conversions: parseInt(r.metricValues[4].value),
      }))),
      // By channel
      runReport({
        startDate: from, endDate: to,
        dimensions: ['sessionDefaultChannelGroup'],
        metrics: ['sessions', 'totalUsers', 'newUsers', 'engagedSessions', 'bounceRate', 'averageSessionDuration', 'conversions'],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }).then(data => (data.rows || []).map(r => ({
        channel: r.dimensionValues[0].value,
        sessions: parseInt(r.metricValues[0].value),
        totalUsers: parseInt(r.metricValues[1].value),
        newUsers: parseInt(r.metricValues[2].value),
        engagedSessions: parseInt(r.metricValues[3].value),
        bounceRate: parseFloat(r.metricValues[4].value),
        avgDuration: parseFloat(r.metricValues[5].value),
        conversions: parseInt(r.metricValues[6].value),
      }))),
      // By device
      runReport({
        startDate: from, endDate: to,
        dimensions: ['deviceCategory'],
        metrics: ['sessions', 'totalUsers', 'engagedSessions', 'bounceRate', 'averageSessionDuration'],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }).then(data => (data.rows || []).map(r => ({
        device: r.dimensionValues[0].value,
        sessions: parseInt(r.metricValues[0].value),
        totalUsers: parseInt(r.metricValues[1].value),
        engagedSessions: parseInt(r.metricValues[2].value),
        bounceRate: parseFloat(r.metricValues[3].value),
        avgDuration: parseFloat(r.metricValues[4].value),
      }))),
      // Landing pages
      runReport({
        startDate: from, endDate: to,
        dimensions: ['landingPage'],
        metrics: ['sessions', 'totalUsers', 'engagedSessions', 'bounceRate', 'conversions'],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      }).then(data => (data.rows || []).map(r => ({
        page: r.dimensionValues[0].value,
        sessions: parseInt(r.metricValues[0].value),
        totalUsers: parseInt(r.metricValues[1].value),
        engagedSessions: parseInt(r.metricValues[2].value),
        bounceRate: parseFloat(r.metricValues[3].value),
        conversions: parseInt(r.metricValues[4].value),
      }))),
      // Totals
      runReport({
        startDate: from, endDate: to,
        metrics: ['sessions', 'totalUsers', 'newUsers', 'engagedSessions', 'bounceRate', 'averageSessionDuration', 'conversions'],
      }).then(data => {
        if (!data.rows?.length) return { sessions: 0, totalUsers: 0, newUsers: 0, engagedSessions: 0, bounceRate: 0, avgDuration: 0, conversions: 0 }
        const r = data.rows[0]
        return {
          sessions: parseInt(r.metricValues[0].value),
          totalUsers: parseInt(r.metricValues[1].value),
          newUsers: parseInt(r.metricValues[2].value),
          engagedSessions: parseInt(r.metricValues[3].value),
          bounceRate: parseFloat(r.metricValues[4].value),
          avgDuration: parseFloat(r.metricValues[5].value),
          conversions: parseInt(r.metricValues[6].value),
        }
      }),
      // Today
      runReport({
        startDate: 'today', endDate: 'today',
        metrics: ['sessions', 'totalUsers', 'newUsers'],
      }).then(data => {
        if (!data.rows?.length) return { sessions: 0, totalUsers: 0, newUsers: 0 }
        return {
          sessions: parseInt(data.rows[0].metricValues[0].value),
          totalUsers: parseInt(data.rows[0].metricValues[1].value),
          newUsers: parseInt(data.rows[0].metricValues[2].value),
        }
      }),
      // UTM Report (source/medium/campaign/content)
      runReport({
        startDate: from, endDate: to,
        dimensions: ['sessionSource', 'sessionMedium', 'sessionCampaignName', 'sessionManualAdContent'],
        metrics: ['sessions', 'totalUsers', 'newUsers', 'engagedSessions', 'bounceRate', 'averageSessionDuration'],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 50,
      }).then(data => (data.rows || []).map(r => ({
        source: r.dimensionValues[0].value,
        medium: r.dimensionValues[1].value,
        campaign: r.dimensionValues[2].value,
        content: r.dimensionValues[3].value,
        sessions: parseInt(r.metricValues[0].value),
        totalUsers: parseInt(r.metricValues[1].value),
        newUsers: parseInt(r.metricValues[2].value),
        engagedSessions: parseInt(r.metricValues[3].value),
        bounceRate: parseFloat(r.metricValues[4].value),
        avgDuration: parseFloat(r.metricValues[5].value),
      }))),
    ])

    res.json({ daily, channels, devices, landingPages, totals, today, utmReport })
  } catch (e) {
    console.error('GA4 API error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
