<script setup lang="ts">
import { computed, ref } from 'vue'
import { AccountSuspendedError, useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Check, Languages } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const authStore = useAuthStore()
const { locale, setLocale, t } = useI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

const phone = ref('')
const password = ref('')
const remember = ref(false)
const showPass = ref(false)
const isLoading = ref(false)
const formError = ref('')
const fieldErrors = ref({ phone: '', password: '' })
const localeOptions = computed(() =>
  [
    { code: 'ar' as const, label: t('locale.ar') },
    { code: 'en' as const, label: t('locale.en') },
  ] as const,
)

const setLanguage = async (code: 'ar' | 'en') => {
  if (locale.value === code) return
  await setLocale(code)
  reloadNuxtApp()
}

const handleLogin = async () => {
  isLoading.value = true
  formError.value = ''
  fieldErrors.value = { phone: '', password: '' }

  try {
    await authStore.login({
      phone: phone.value,
      password: password.value,
    })
    const name = authStore.user?.name ?? ''
    toast.success(name ? t('auth.welcome_back_named', { name }) : t('auth.welcome_back'))
    await navigateTo('/mainCards')
  }
  catch (e: unknown) {
    if (e instanceof AccountSuspendedError) {
      formError.value = t('auth.account_suspended')
    }
    else if (isValidationError(e)) {
      const fe = getFieldErrors(e)
      fieldErrors.value.phone = fe.phone ?? ''
      fieldErrors.value.password = fe.password ?? ''
    }
    else {
      formError.value = getErrorMessage(e)
    }
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  
  <div class="login-panel">
    <div class="login-card anim-card">
      <div class="mb-3 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="size-8">
              <Languages class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuItem
              v-for="opt in localeOptions"
              :key="opt.code"
              class="gap-2 cursor-pointer"
              @click="setLanguage(opt.code)"
            >
              <Check
                class="size-4 shrink-0"
                :class="locale === opt.code ? 'opacity-100' : 'opacity-0'"
              />
              <span>{{ opt.label }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div class="card-header">
        <div class="card-logo-sm anim-fade-down" style="--delay: 0.2s">
          <img src="/logo.png" alt="KAMU Group" class="logo-img-sm" />
        </div>
        <h2 class="card-title anim-fade-up" style="--delay: 0.3s">{{ t('auth.welcome_back') }}</h2>
        <p class="card-subtitle anim-fade-up" style="--delay: 0.4s">{{ t('auth.subtitle') }}</p>
      </div>

      <div class="login-form">

        <div class="form-group anim-fade-up" style="--delay: 0.5s">
          <label class="form-label">{{ t('auth.phone') }}</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <input
              v-model="phone"
              type="tel"
              inputmode="tel"
              class="form-input"
              :class="{ '!border-red-500': fieldErrors.phone }"
              :placeholder="t('auth.placeholder_phone')"
              @keyup.enter="handleLogin"
              @input="fieldErrors.phone = ''"
            />
          </div>
          <p v-if="fieldErrors.phone" class="text-xs text-red-600 mt-1">{{ fieldErrors.phone }}</p>
        </div>

        <div class="form-group anim-fade-up" style="--delay: 0.6s">
          <div class="label-row">
            <label class="form-label">{{ t('auth.password') }}</label>
          </div>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              class="form-input"
              :class="{ '!border-red-500': fieldErrors.password }"
              :placeholder="t('auth.placeholder_password')"
              @keyup.enter="handleLogin"
              @input="fieldErrors.password = ''"
            />
            <button class="pass-toggle" @click="showPass = !showPass">
              <svg v-if="!showPass" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          </div>
          <p v-if="fieldErrors.password" class="text-xs text-red-600 mt-1">{{ fieldErrors.password }}</p>
        </div>

        <div v-if="formError" class="error-msg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {{ formError }}
        </div>

        <div class="remember-row anim-fade-up" style="--delay: 0.7s">
          <label class="checkbox-wrap">
            <input type="checkbox" v-model="remember" class="checkbox-input" />
            <span class="checkbox-box"></span>
            <span class="checkbox-label">{{ t('auth.remember_me') }}</span>
          </label>
        </div>

        <button class="login-btn anim-fade-up" :class="{ loading: isLoading }"
          @click="handleLogin" :disabled="isLoading">
          <span v-if="!isLoading" class="inline-flex items-center gap-2">
            {{ t('auth.sign_in') }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </span>
          <span v-else class="loading-dots">
            <span></span><span></span><span></span>
          </span>
        </button>

      </div>

      <div class="card-footer anim-fade-up" style="--delay: 0.9s">
        <div class="security-badges">
          <div class="security-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>{{ t('auth.ssl_secure') }}</span>
          </div>
          <div class="security-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>{{ t('auth.data_encrypted') }}</span>
          </div>
        </div>
      </div>

    </div>

    <p class="login-note anim-fade-up" style="--delay: 1s">
      {{ t('auth.footer_register') }} <a href="#" class="login-note-link">{{ t('auth.contact_company') }}</a>
    </p>
  </div>
</template>

<style scoped>
/* ── Login Panel ── */
.login-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  background: #ffffff;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.card-header {
  text-align: center;
  margin-bottom: 36px;
}

.card-logo-sm {
  display: inline-flex;
  align-items: center;
  margin-bottom: 24px;
}

.logo-img-sm {
  height: 36px;
  width: auto;
}

.card-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -1px;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.card-subtitle {
  font-size: 13px;
  color: #6b7280;
  font-weight: 300;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: #4b5563;
}

.forgot-link {
  font-size: 11px;
  color: #215260;
  text-decoration: none;
  transition: color 0.15s;
  position: relative;
}

.forgot-link:hover { color: #2a6678; }

.forgot-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: 0;
  width: 0;
  height: 1px;
  background: currentColor;
  transition: width 0.3s ease;
}

.forgot-link:hover::after { width: 100%; }

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  right: 14px;
  color: #9ca3af;
  pointer-events: none;
}

.form-input {
  width: 100%;
  padding: 12px 44px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 13px;
  color: #1a1a1a;
  font-family: 'Readex Pro', sans-serif;
  outline: none;
  direction: rtl;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.form-input::placeholder { color: #9ca3af; }

.form-input:focus {
  border-color: #215260;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(33, 82, 96, 0.1);
  transform: scale(1.01);
}

.pass-toggle {
  position: absolute;
  left: 14px;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.pass-toggle:hover { color: #6b7280; }

.error-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 12px;
  color: #dc2626;
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.remember-row {
  display: flex;
  align-items: center;
}

.checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-input { display: none; }

.checkbox-box {
  width: 16px;
  height: 16px;
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.checkbox-input:checked + .checkbox-box {
  background: #215260;
  border-color: #215260;
  animation: checkPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.checkbox-input:checked + .checkbox-box::after {
  content: '✓';
  font-size: 10px;
  color: #ffffff;
  font-weight: 700;
}

@keyframes checkPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.checkbox-label {
  font-size: 12px;
  color: #6b7280;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background: #215260;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Readex Pro', sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-direction: row-reverse;
  position: relative;
  overflow: hidden;
}

.login-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.1));
  opacity: 0;
  transition: opacity 0.2s;
}

.login-btn:hover::before { opacity: 1; }

.login-btn::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  transform: scale(0);
  opacity: 0;
  transition: transform 0.5s, opacity 0.3s;
}

.login-btn:active::after {
  transform: scale(2);
  opacity: 1;
  transition: transform 0s, opacity 0s;
}

.login-btn:hover {
  background: #2a6678;
  box-shadow: 0 8px 24px rgba(33, 82, 96, 0.3);
  transform: translateY(-1px);
}

.login-btn:active { transform: translateY(0); }

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.loading-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: #ffffff;
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(.6); opacity: .4; }
  40% { transform: scale(1); opacity: 1; }
}

.card-footer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.security-badges {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.security-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #9ca3af;
  transition: all 0.2s ease;
}

.security-badge:hover {
  color: #6b7280;
  transform: translateY(-1px);
}

.security-badge svg { transition: transform 0.2s ease; }
.security-badge:hover svg { transform: scale(1.1); }

.login-note {
  margin-top: 24px;
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
}

.login-note-link {
  color: #215260;
  text-decoration: none;
  transition: color 0.15s;
  position: relative;
}

.login-note-link:hover { color: #2a6678; }

.login-note-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: 0;
  width: 0;
  height: 1px;
  background: currentColor;
  transition: width 0.3s ease;
}

.login-note-link:hover::after { width: 100%; }

@media (max-width: 900px) {
  .login-panel { padding: 40px 24px; }
}

/* ── Entrance animations ── */
.anim-card {
  animation: cardSlide 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes cardSlide {
  from { opacity: 0; transform: translateY(40px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

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
</style>
