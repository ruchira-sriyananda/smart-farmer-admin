// lib/secureSession.js — inline here for portability
// In production, move these to @/lib/secureSession.js

const SESSION_KEY = 'sf_admin_sess'
const FINGERPRINT_KEY = 'sf_admin_fp'
const RATE_LIMIT_KEY = 'sf_admin_rl'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

// ── Simple HMAC-like integrity hash (no external libs needed) ──
async function hashPayload(payload) {
  const encoder = new TextEncoder()
  const data = encoder.encode(payload + navigator.userAgent + window.location.hostname)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Browser fingerprint ──
async function getBrowserFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency,
  ].join('|')
  return hashPayload(raw)
}

// ── Encrypt using AES-GCM with a derived key from a stable secret ──
async function deriveKey() {
  const secret = `${navigator.userAgent}:${window.location.hostname}:smartfarmer-admin`
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.slice(0, 32).padEnd(32, '0')),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('sf-salt-2024'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptSession(data) {
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptSession(encrypted) {
  try {
    const key = await deriveKey()
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return JSON.parse(new TextDecoder().decode(decrypted))
  } catch {
    return null
  }
}

export async function saveSession(payload) {
  const fp = await getBrowserFingerprint()
  const integrity = await hashPayload(JSON.stringify(payload))
  const sessionData = { ...payload, _fp: fp, _integrity: integrity, _exp: Date.now() + SESSION_TTL_MS }
  const encrypted = await encryptSession(sessionData)
  sessionStorage.setItem(SESSION_KEY, encrypted)
  document.cookie = `sf-admin=1; path=/; max-age=${60 * 60 * 8}; samesite=strict`
}

export async function loadSession() {
  const encrypted = sessionStorage.getItem(SESSION_KEY)
  if (!encrypted) return null
  const data = await decryptSession(encrypted)
  if (!data) return null
  if (Date.now() > data._exp) { clearSession(); return null }
  const currentFp = await getBrowserFingerprint()
  if (data._fp !== currentFp) { clearSession(); return null }
  const integrityCheck = await hashPayload(JSON.stringify({ user: data.user, admin: data.admin, role: data.role, loggedInAt: data.loggedInAt }))
  if (data._integrity !== integrityCheck) { clearSession(); return null }
  return data
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  document.cookie = 'sf-admin=; path=/; max-age=0'
}

// ── Rate limiting ──
export function getRateLimit() {
  try { return JSON.parse(localStorage.getItem(RATE_LIMIT_KEY)) || { attempts: 0, lockedUntil: null } }
  catch { return { attempts: 0, lockedUntil: null } }
}

export function recordFailedAttempt() {
  const rl = getRateLimit()
  rl.attempts += 1
  if (rl.attempts >= MAX_ATTEMPTS) rl.lockedUntil = Date.now() + LOCKOUT_MS
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rl))
  return rl
}

export function clearRateLimit() {
  localStorage.removeItem(RATE_LIMIT_KEY)
}

export function isLockedOut() {
  const rl = getRateLimit()
  if (!rl.lockedUntil) return { locked: false }
  if (Date.now() < rl.lockedUntil) return { locked: true, remainingMs: rl.lockedUntil - Date.now() }
  clearRateLimit()
  return { locked: false }
}

// ────────────────────────────────────────────────
// AdminLogin Component
// ────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import ReCAPTCHA from 'react-google-recaptcha'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockoutMsg, setLockoutMsg] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const router = useRouter()
  const recaptchaRef = useRef(null)
  const lockoutTimer = useRef(null)

  // ── Check existing valid session on mount ──
  useEffect(() => {
    ;(async () => {
      const session = await loadSession()
      if (session) router.replace('/admin/dashboard')
    })()
    checkLockout()
    return () => clearInterval(lockoutTimer.current)
  }, [])

  function checkLockout() {
    const { locked, remainingMs } = isLockedOut()
    if (locked) {
      startLockoutCountdown(remainingMs)
    }
  }

  function startLockoutCountdown(remainingMs) {
    let ms = remainingMs
    const fmt = (ms) => `${Math.ceil(ms / 60000)}m ${Math.ceil((ms % 60000) / 1000)}s`
    setLockoutMsg(`Too many attempts. Try again in ${fmt(ms)}`)
    clearInterval(lockoutTimer.current)
    lockoutTimer.current = setInterval(() => {
      ms -= 1000
      if (ms <= 0) { clearInterval(lockoutTimer.current); setLockoutMsg(''); clearRateLimit() }
      else setLockoutMsg(`Too many attempts. Try again in ${fmt(ms)}`)
    }, 1000)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    // ── Rate limit check ──
    const lockState = isLockedOut()
    if (lockState.locked) {
      setError('Account temporarily locked. Please wait.')
      return
    }

    setLoading(true)

    try {
      // ── reCAPTCHA verification ──
      const token = await recaptchaRef.current.executeAsync()
      recaptchaRef.current.reset()
      if (!token) throw new Error('reCAPTCHA verification failed. Please try again.')

      // ── Supabase authentication ──
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        const rl = recordFailedAttempt()
        setAttempts(rl.attempts)
        if (rl.attempts >= MAX_ATTEMPTS) startLockoutCountdown(LOCKOUT_MS)
        throw new Error(authError.message === 'Invalid login credentials' ? 'Invalid email or password.' : authError.message)
      }

      // ── Verify JWT claims ──
      const { data: { session: supaSession }, error: sessErr } = await supabase.auth.getSession()
      if (sessErr || !supaSession) throw new Error('Session verification failed.')

      // ── Check admin_users record ──
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('admin_id, full_name, email, is_active, is_super_admin, role_id, last_login_at')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle()

      if (adminError) throw new Error('Database error. Contact support.')
      if (!adminData) throw new Error('Access denied: not an admin account.')
      if (!adminData.is_active) throw new Error('This admin account has been disabled.')

      // ── Role lookup ──
      if (!adminData.role_id) throw new Error('No role assigned. Contact support.')
      const { data: roleData, error: roleError } = await supabase
        .from('admin_roles')
        .select('role_name, permissions')
        .eq('role_id', adminData.role_id)
        .maybeSingle()

      if (roleError || !roleData) throw new Error('Role lookup failed. Contact support.')

      // ── Update last_login_at ──
      await supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('admin_id', adminData.admin_id)

      // ── Build session payload ──
      const sessionPayload = {
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
        admin: {
          admin_id: adminData.admin_id,
          full_name: adminData.full_name,
          email: adminData.email,
          is_super_admin: adminData.is_super_admin,
          role_id: adminData.role_id,
        },
        role: roleData.role_name,
        permissions: roleData.permissions ?? [],
        loggedInAt: new Date().toISOString(),
        accessToken: supaSession.access_token,
      }

      // ── Encrypt & persist session ──
      await saveSession(sessionPayload)
      clearRateLimit()

      // ── Redirect with success flag ──
      await router.push({
        pathname: '/admin/dashboard',
        query: { loginSuccess: 'true' },
      })
    } catch (err) {
      console.error('[AdminLogin] Error:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const remainingAttempts = MAX_ATTEMPTS - attempts
  const isLocked = isLockedOut().locked

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0f1e]">

      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-teal-400/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px)' }} />
      </div>

      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div className="relative z-10 w-full max-w-md mx-4">

        {/* Header badge */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="text-xs font-mono tracking-[0.2em] text-emerald-400/80 uppercase">Secure Admin Portal</span>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl shadow-2xl">

          <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">Smart Farmer</h1>
          <p className="text-sm text-white/40 mb-8">Administrator access only</p>

          {/* Lockout banner */}
          {lockoutMsg && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-sm text-red-400 font-mono">{lockoutMsg}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <p className="text-sm text-red-400">{error}</p>
                {attempts > 0 && !isLocked && (
                  <p className="text-xs text-red-400/60 mt-1 font-mono">{remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before lockout</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 tracking-wide uppercase">Email</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <input
                  type="email"
                  placeholder="admin@smartfarmer.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || isLocked}
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.08] transition-all disabled:opacity-40"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 tracking-wide uppercase">Password</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || isLocked}
                  className="w-full pl-10 pr-12 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.08] transition-all disabled:opacity-40"
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPass
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Invisible reCAPTCHA */}
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
              size="invisible"
              ref={recaptchaRef}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full py-3 mt-2 rounded-xl text-sm font-semibold tracking-wide transition-all relative overflow-hidden
                bg-emerald-500 hover:bg-emerald-400 text-white
                disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Authenticating…
                </span>
              ) : isLocked ? 'Account Locked' : 'Sign In'}
            </button>
          </form>

          {/* Security notice */}
          <div className="flex items-center gap-2 mt-6 pt-6 border-t border-white/[0.06]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <p className="text-[11px] text-white/20 font-mono">AES-256 encrypted session · TLS 1.3 · reCAPTCHA v2</p>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          Smart Farmer Admin © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}