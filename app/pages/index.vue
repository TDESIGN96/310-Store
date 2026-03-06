<script setup>
const loading = ref(false)
import { ref } from 'vue'

const username = ref('')
const password = ref('')
const remember = ref(false)
const showPass = ref(false)
const isLoading = ref(false)
const error = ref('')

const modulePills = [
  'نقاط البيع', 'المخزون', 'الفواتير',
  'المندوبين', 'الشحن', 'المحاسبة', 'الصلاحيات'
]

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = 'يرجى إدخال اسم المستخدم وكلمة المرور'
    return
  }
  error.value = ''
  isLoading.value = true
  await new Promise(r => setTimeout(r, 1800))
  isLoading.value = false
  // await navigateTo('/dashboard')
}
</script>


<template>
    <div class="kamu-root" dir="rtl">
      <!-- Background -->
      <div class="bg-noise"></div>
      <div class="bg-glow-teal"></div>
      <div class="bg-glow-lime"></div>
      <div class="floating-particles">
        <div class="particle p1"></div>
        <div class="particle p2"></div>
        <div class="particle p3"></div>
        <div class="particle p4"></div>
      </div>
  
      <!-- Split Layout -->
      <div class="split-layout">
  
        <!-- Left Panel — Branding -->
        <div class="brand-panel">
          <div class="brand-panel-inner">
  
            <!-- Logo -->
            <div class="kamu-logo anim-fade-down" style="--delay: 0.1s">
              <img src="/logo.png" alt="KAMU Group" class="logo-img" />
            </div>
  
            <!-- Main Brand Message -->
            <div class="brand-content">
              <div class="brand-eyebrow anim-fade-right" style="--delay: 0.2s">نظام إدارة المتجر</div>
              <h1 class="brand-headline anim-fade-right" style="--delay: 0.3s">
                تحكم كامل
                <span class="headline-accent anim-glow">بعملك.</span>
              </h1>
              <p class="brand-tagline anim-fade-right" style="--delay: 0.4s">
                منصة متكاملة لنقاط البيع، إدارة المخزون،
                والمحاسبة — كل شيء في مكان واحد.
              </p>
  
              <!-- Stats -->
              <div class="brand-stats anim-fade-up" style="--delay: 0.5s">
                <div class="brand-stat">
                  <span class="brand-stat-value counter" data-target="7">٧</span>
                  <span class="brand-stat-label">وحدات متكاملة</span>
                </div>
                <div class="brand-stat-sep"></div>
                <div class="brand-stat">
                  <span class="brand-stat-value">٩٩.٩٪</span>
                  <span class="brand-stat-label">وقت التشغيل</span>
                </div>
                
                
              </div>
            </div>
  
            <!-- Module Pills -->
            <div class="module-pills">
              <div class="pill anim-pop" v-for="(m, i) in modulePills" :key="m" :style="`--delay: ${0.6 + i * 0.08}s`">{{ m }}</div>
            </div>
  
            <!-- Bottom Brand Bar -->
            <div class="brand-footer anim-fade-up" style="--delay: 1s">
              <div class="status-dot-wrap">
                <span class="status-dot"></span>
                <span>جميع الأنظمة تعمل بشكل طبيعي</span>
              </div>
              <span class="brand-footer-copy">© 2026 KAMU</span>
            </div>
          </div>
  
          <!-- Decorative -->
          <div class="panel-grid anim-grid"></div>
          <div class="corner-deco">
            <div class="corner-ring ring-1 anim-ring"></div>
            <div class="corner-ring ring-2 anim-ring"></div>
            <div class="corner-ring ring-3 anim-ring"></div>
          </div>
          <div class="shimmer-overlay"></div>
        </div>
  
        <!-- Right Panel — Login -->
        <div class="login-panel">
          <div class="login-card anim-card">
  
            <div class="card-header">
              <div class="card-logo-sm anim-fade-down" style="--delay: 0.2s">
                <img src="/logo.png" alt="KAMU Group" class="logo-img-sm" />
              </div>
              <h2 class="card-title anim-fade-up" style="--delay: 0.3s">مرحباً بعودتك</h2>
              <p class="card-subtitle anim-fade-up" style="--delay: 0.4s">سجّل دخولك للوصول إلى لوحة التحكم</p>
            </div>
  
            <div class="login-form">
  
              <div class="form-group anim-fade-up" style="--delay: 0.5s">
                <label class="form-label">اسم المستخدم</label>
                <div class="input-wrap">
                  <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input v-model="username" type="text" class="form-input" placeholder="أدخل اسم المستخدم" @keyup.enter="handleLogin" />
                </div>
              </div>
  
              <div class="form-group anim-fade-up" style="--delay: 0.6s">
                <div class="label-row">
                  <label class="form-label">كلمة المرور</label>
                  <a href="#" class="forgot-link">نسيت كلمة المرور؟</a>
                </div>
                <div class="input-wrap">
                  <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input v-model="password" :type="showPass ? 'text' : 'password'" class="form-input" placeholder="أدخل كلمة المرور" @keyup.enter="handleLogin" />
                  <button class="pass-toggle" @click="showPass = !showPass">
                    <svg v-if="!showPass" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
              </div>
  
              <div v-if="error" class="error-msg">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {{ error }}
              </div>
  
              <div class="remember-row anim-fade-up" style="--delay: 0.7s">
                <label class="checkbox-wrap">
                  <input type="checkbox" v-model="remember" class="checkbox-input" />
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">تذكرني</span>
                </label>
              </div>
  
              <button class="login-btn anim-fade-up" style="--delay: 0.8s" :class="{ loading: isLoading }" @click="handleLogin" :disabled="isLoading">
                <span v-if="!isLoading" class="inline-flex items-center gap-2">
                  تسجيل الدخول
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
                </span>
                <span v-else class="loading-dots">
                  <span></span><span></span><span></span>
                </span>
              </button>
  
            </div>
  
            <div class="card-footer anim-fade-up" style="--delay: 0.9s">
              <div class="security-badges">
                <div class="security-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>اتصال آمن SSL</span>
                </div>
                <div class="security-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>بيانات مشفرة</span>
                </div>
              </div>
            </div>

          </div>
  
          <p class="login-note anim-fade-up" style="--delay: 1s">
            هل تحتاج مساعدة؟
            <a href="#" class="login-note-link">تواصل مع الدعم الفني</a>
          </p>
        </div>
  
      </div>
    </div>
  </template>
<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap');

:root {
  --kamu-teal:  #215260;
  --kamu-lime:  #8BA506;
  --kamu-light: #f8f9fa;
  --teal-light: #2a6678;
  --border:     rgba(0,0,0,0.08);
  --text-main:  #1a1a1a;
  --text-muted: #5a6a60;
  --text-dim:   #9ca3af;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.kamu-root {
  font-family: 'Readex Pro', sans-serif;
  background: #ffffff;
  color: #1a1a1a;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  direction: rtl;
}

.bg-noise {
  position: fixed; inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  pointer-events: none; z-index: 0;
}
.bg-glow-teal {
  position: fixed; width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(33,82,96,0.08) 0%, transparent 70%);
  top: -200px; right: -200px;
  pointer-events: none; z-index: 0;
}
.bg-glow-lime {
  position: fixed; width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(139,165,6,0.06) 0%, transparent 70%);
  bottom: -100px; left: 200px;
  pointer-events: none; z-index: 0;
}

.split-layout {
  position: relative; z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

/* ── Brand Panel ── */
.brand-panel {
  position: relative;
  background: linear-gradient(145deg, rgba(33,82,96,0.95) 0%, rgba(33,82,96,0.85) 60%, rgba(42,102,120,0.9) 100%);
  border-left: 1px solid rgba(255,255,255,0.1);
  overflow: hidden;
}
.panel-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}
.corner-deco { position: absolute; bottom: -80px; left: -80px; pointer-events: none; }
.corner-ring { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); }
.ring-1 { width: 240px; height: 240px; border: 1px solid rgba(255,255,255,0.1); }
.ring-2 { width: 380px; height: 380px; border: 1px solid rgba(255,255,255,0.06); }
.ring-3 { width: 520px; height: 520px; border: 1px solid rgba(255,255,255,0.03); }

.brand-panel-inner {
  position: relative; z-index: 2;
  display: flex; flex-direction: column;
  height: 100%; padding: 48px;
}

.kamu-logo { display: flex; align-items: center; margin-bottom: auto; }
.logo-img {
  height: 48px;
  width: auto;
  filter: brightness(0) invert(1);
}

.brand-content { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 60px 0; padding-right: 32px; }
.brand-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 500; color: #CFE030;
  letter-spacing: 2px; text-transform: uppercase;
  margin-bottom: 20px; opacity: 0.9;
}
.brand-eyebrow::before {
  content: ''; display: inline-block;
  width: 24px; height: 1px; background: #CFE030; opacity: 0.6;
}
.brand-headline {
  font-size: clamp(44px, 5vw, 68px); font-weight: 700;
  line-height: 1.5; letter-spacing: -2.5px;
  color: #ffffff; margin-bottom: 20px;
}
.headline-accent {
  display: block; color: #CFE030;
  text-shadow: 0 0 60px rgba(207,224,48,0.4);
}
.brand-tagline {
  font-size: 15px; line-height: 1.8; color: rgba(255,255,255,0.7);
  max-width: 360px; margin-bottom: 40px; font-weight: 300;
}

.brand-stats { display: flex; align-items: center; gap: 28px; }
.brand-stat { text-align: center; }
.brand-stat-value { display: block; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -1px; }
.brand-stat-label { display: block; font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.brand-stat-sep { width: 1px; height: 36px; background: rgba(255,255,255,0.15); }

.module-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 40px; }
.pill {
  padding: 5px 12px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 100px; font-size: 11px;
  color: rgba(207,224,48,0.9); font-weight: 400;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}
.pill:hover { background: rgba(255,255,255,0.15); border-color: rgba(207,224,48,0.4); color: #CFE030; }

.brand-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); }
.status-dot-wrap { display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.5); }
.status-dot { width: 7px; height: 7px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px rgba(34,197,94,0.6); animation: pulse 2.5s infinite; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
.brand-footer-copy { font-size: 11px; color: rgba(255,255,255,0.5); }

/* ── Login Panel ── */
.login-panel {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 48px 40px;
  background: #ffffff;
}
.login-card {
  width: 100%; max-width: 420px;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 20px; padding: 40px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  animation: slideIn 0.5s ease both;
}
@keyframes slideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

.card-header { text-align: center; margin-bottom: 36px; }
.card-logo-sm {
  display: inline-flex; align-items: center;
  margin-bottom: 24px;
}
.logo-img-sm {
  height: 36px;
  width: auto;
}
.card-title { font-size: 24px; font-weight: 700; letter-spacing: -1px; color: #1a1a1a; margin-bottom: 8px; }
.card-subtitle { font-size: 13px; color: #6b7280; font-weight: 300; }

.login-form { display: flex; flex-direction: column; gap: 20px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.label-row { display: flex; align-items: center; justify-content: space-between; }
.form-label { font-size: 12px; font-weight: 500; color: #4b5563; }
.forgot-link { font-size: 11px; color: #215260; text-decoration: none; transition: color 0.15s; }
.forgot-link:hover { color: #2a6678; }

.input-wrap { position: relative; display: flex; align-items: center; }
.input-icon { position: absolute; right: 14px; color: #9ca3af; pointer-events: none; }
.form-input {
  width: 100%; padding: 12px 44px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px; font-size: 13px;
  color: #1a1a1a; font-family: 'Readex Pro', sans-serif;
  outline: none; transition: all 0.2s; direction: rtl;
}
.form-input::placeholder { color: #9ca3af; }
.form-input:focus {
  border-color: #215260;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(33,82,96,0.1);
}
.pass-toggle {
  position: absolute; left: 14px; background: none; border: none;
  color: #9ca3af; cursor: pointer; padding: 0;
  display: flex; align-items: center; transition: color 0.15s;
}
.pass-toggle:hover { color: #6b7280; }

.error-msg {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px; font-size: 12px; color: #dc2626;
  animation: shake 0.3s ease;
}
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }

.remember-row { display: flex; align-items: center; }
.checkbox-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.checkbox-input { display: none; }
.checkbox-box {
  width: 16px; height: 16px;
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 4px; display: flex;
  align-items: center; justify-content: center; transition: all 0.15s;
}
.checkbox-input:checked + .checkbox-box { background: #215260; border-color: #215260; }
.checkbox-input:checked + .checkbox-box::after { content: '✓'; font-size: 10px; color: #ffffff; font-weight: 700; }
.checkbox-label { font-size: 12px; color: #6b7280; }

.login-btn {
  width: 100%; padding: 14px;
  background: #215260; color: #ffffff;
  border: none; border-radius: 10px;
  font-size: 14px; font-weight: 600;
  font-family: 'Readex Pro', sans-serif;
  cursor: pointer; transition: all 0.2s;
  display: flex; align-items: center;
  justify-content: center; gap: 8px;
  flex-direction: row-reverse;
  position: relative; overflow: hidden;
}
.login-btn::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent, rgba(255,255,255,0.1));
  opacity: 0; transition: opacity 0.2s;
}
.login-btn:hover::before { opacity: 1; }
.login-btn:hover { background: #2a6678; box-shadow: 0 8px 24px rgba(33,82,96,0.3); transform: translateY(-1px); }
.login-btn:active { transform: translateY(0); }
.login-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

.loading-dots { display: flex; align-items: center; gap: 4px; }
.loading-dots span { width: 6px; height: 6px; background: #ffffff; border-radius: 50%; animation: bounce 1.2s infinite; }
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1);opacity:1} }

.card-footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #f3f4f6; }
.security-badges { display: flex; align-items: center; justify-content: center; gap: 20px; }
.security-badge { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #9ca3af; }

.login-note { margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center; }
.login-note-link { color: #215260; text-decoration: none; transition: color 0.15s; }
.login-note-link:hover { color: #2a6678; }

@media (max-width: 900px) {
  .split-layout { grid-template-columns: 1fr; }
  .brand-panel { min-height: 45vh; border-left: none; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .brand-panel-inner { padding: 32px; }
  .brand-content { padding: 32px 0; }
  .brand-headline { font-size: 40px; }
  .login-panel { padding: 40px 24px; }
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS
═══════════════════════════════════════════════════════════════ */

/* Floating particles */
.floating-particles {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.particle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.4;
  animation: float 20s ease-in-out infinite;
}
.p1 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(33,82,96,0.15) 0%, transparent 70%);
  top: 10%; right: 20%;
  animation-delay: 0s;
}
.p2 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(139,165,6,0.1) 0%, transparent 70%);
  bottom: 20%; left: 10%;
  animation-delay: -5s;
}
.p3 {
  width: 150px; height: 150px;
  background: radial-gradient(circle, rgba(33,82,96,0.12) 0%, transparent 70%);
  top: 60%; right: 60%;
  animation-delay: -10s;
}
.p4 {
  width: 100px; height: 100px;
  background: radial-gradient(circle, rgba(207,224,48,0.08) 0%, transparent 70%);
  top: 30%; left: 30%;
  animation-delay: -15s;
}
@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -30px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(20px, 10px) scale(1.02); }
}

/* Shimmer overlay on brand panel */
.shimmer-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255,255,255,0.03) 45%,
    rgba(255,255,255,0.05) 50%,
    rgba(255,255,255,0.03) 55%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: shimmer 8s ease-in-out infinite;
  pointer-events: none;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Grid animation */
.anim-grid {
  animation: gridFade 1.5s ease-out both;
}
@keyframes gridFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Ring animations */
.anim-ring {
  animation: ringPulse 4s ease-in-out infinite, ringExpand 1s ease-out both;
}
.ring-1.anim-ring { animation-delay: 0s, 0.3s; }
.ring-2.anim-ring { animation-delay: 1.3s, 0.5s; }
.ring-3.anim-ring { animation-delay: 2.6s, 0.7s; }
@keyframes ringPulse {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); }
}
@keyframes ringExpand {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  to { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
}

/* Fade animations */
.anim-fade-up {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeUp 0.6s ease-out forwards;
  animation-delay: var(--delay, 0s);
}
@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}

.anim-fade-down {
  opacity: 0;
  transform: translateY(-20px);
  animation: fadeDown 0.6s ease-out forwards;
  animation-delay: var(--delay, 0s);
}
@keyframes fadeDown {
  to { opacity: 1; transform: translateY(0); }
}

.anim-fade-right {
  opacity: 0;
  transform: translateX(30px);
  animation: fadeRight 0.7s ease-out forwards;
  animation-delay: var(--delay, 0s);
}
@keyframes fadeRight {
  to { opacity: 1; transform: translateX(0); }
}

/* Pop animation for pills */
.anim-pop {
  opacity: 0;
  transform: scale(0.8);
  animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  animation-delay: var(--delay, 0s);
}
@keyframes popIn {
  to { opacity: 1; transform: scale(1); }
}

/* Glow animation for accent text */
.anim-glow {
  animation: textGlow 3s ease-in-out infinite;
}
@keyframes textGlow {
  0%, 100% { text-shadow: 0 0 40px rgba(207,224,48,0.3); }
  50% { text-shadow: 0 0 80px rgba(207,224,48,0.5), 0 0 120px rgba(207,224,48,0.2); }
}

/* Card entrance animation */
.anim-card {
  animation: cardSlide 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes cardSlide {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Enhanced input focus animation */
.form-input {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.form-input:focus {
  transform: scale(1.01);
}

/* Button ripple effect */
.login-btn {
  position: relative;
  overflow: hidden;
}
.login-btn::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  transform: scale(0);
  opacity: 0;
  transition: transform 0.5s, opacity 0.3s;
}
.login-btn:active::after {
  transform: scale(2);
  opacity: 1;
  transition: transform 0s, opacity 0s;
}

/* Pill hover effect */
.pill {
  position: relative;
  overflow: hidden;
}
.pill::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s;
}
.pill:hover::before {
  transform: translateX(100%);
}

/* Checkbox animation */
.checkbox-box {
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.checkbox-input:checked + .checkbox-box {
  animation: checkPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes checkPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* Status dot enhanced pulse */
.status-dot {
  animation: statusPulse 2s ease-in-out infinite;
}
@keyframes statusPulse {
  0%, 100% { 
    box-shadow: 0 0 0 0 rgba(34,197,94,0.4), 0 0 8px rgba(34,197,94,0.6);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 0 8px rgba(34,197,94,0), 0 0 12px rgba(34,197,94,0.4);
    transform: scale(0.9);
  }
}

/* Link hover underline animation */
.forgot-link, .login-note-link {
  position: relative;
}
.forgot-link::after, .login-note-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: 0;
  width: 0;
  height: 1px;
  background: currentColor;
  transition: width 0.3s ease;
}
.forgot-link:hover::after, .login-note-link:hover::after {
  width: 100%;
}

/* Security badge hover */
.security-badge {
  transition: all 0.2s ease;
}
.security-badge:hover {
  color: #6b7280;
  transform: translateY(-1px);
}
.security-badge svg {
  transition: transform 0.2s ease;
}
.security-badge:hover svg {
  transform: scale(1.1);
}

/* Stats counter animation */
.brand-stat-value {
  display: inline-block;
}
.brand-stat:hover .brand-stat-value {
  animation: countPulse 0.4s ease;
}
@keyframes countPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
</style>