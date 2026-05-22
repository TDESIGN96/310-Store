<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { navItems } from '@/config/navigation'

definePageMeta({
  layout: 'auth',
  langauge_switcher : true 
})

const { t } = useI18n()
const { dir } = useDocumentDir()

const authStore = useAuthStore()
if (authStore.isLoggedIn) {
  await navigateTo('/mainCards', { replace: true })


}

const modulePills = computed(() =>
  navItems
    .flatMap(group => group.items)
    .filter(item => item.path !== '/mainCards')
    .map(item => t(item.labelKey)),
)
</script>

<template>
  <div class="font-['Readex_Pro',sans-serif] bg-white text-[#1a1a1a] min-h-screen relative overflow-hidden" :dir="dir">

    <!-- Decorative backgrounds -->
    <div class="kamu-bg-noise"></div>
    <div class="kamu-glow-teal"></div>
    <div class="kamu-glow-lime"></div>
    

    <!-- Floating particles -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div class="kamu-particle kamu-p1"></div>
      <div class="kamu-particle kamu-p2"></div>
      <div class="kamu-particle kamu-p3"></div>
      <div class="kamu-particle kamu-p4"></div>
      <div class="kamu-particle kamu-p5"> $t('make it inside the creative products of the the')</div> 
    </div>

    <!-- Split layout: brand left / login right -->
    <div class="relative z-[1] grid grid-cols-2 min-h-screen max-[900px]:grid-cols-1">

      <!-- ── Left Panel — Branding ── -->
      <div class="kamu-brand-panel relative overflow-hidden max-[900px]:min-h-[45vh]">
        <div class="relative z-[2] flex flex-col h-full p-12 max-[900px]:p-8">

          <!-- Logo -->
          <div class="flex items-center mb-auto kamu-anim-fade-down" style="--delay: 0.1s">
            <img src="/logo.png" alt="KAMU Group" class="h-12 w-auto brightness-0 invert" />
          </div>

          <!-- Brand message -->
          <div class="flex-1 flex flex-col justify-center py-[60px] pr-8 max-[900px]:py-8 max-[900px]:pr-0">
            <div class="kamu-eyebrow kamu-anim-fade-right" style="--delay: 0.2s">{{ t('landing.eyebrow') }}</div>

            <h1 class="kamu-headline kamu-anim-fade-right" style="--delay: 0.3s">
              {{ t('landing.headline') }}
              <span class="kamu-headline-accent kamu-anim-glow">{{ t('landing.headline_accent') }}</span>
            </h1>

            <p class="text-[15px] leading-[1.8] text-white/70 max-w-[360px] mb-10 font-light kamu-anim-fade-right"
              style="--delay: 0.4s">
              {{ t('landing.description') }}
            </p>

            <!-- Stats -->
            <!-- <div class="flex items-center gap-7 kamu-anim-fade-up" style="--delay: 0.5s">
              <div class="text-center group">
                <span class="kamu-stat-value block text-[26px] font-bold text-white tracking-[-1px] counter"
                  data-target="7">{{ t('landing.stat_units_value') }}</span>
                <span class="block text-[11px] text-white/50 mt-0.5">{{ t('landing.stat_units') }}</span>
              </div>
              <div class="w-px h-9 bg-white/15 shrink-0"></div>
              <div class="text-center group">
                <span class="kamu-stat-value block text-[26px] font-bold text-white tracking-[-1px]">{{ t('landing.stat_uptime_value') }}</span>
                <span class="block text-[11px] text-white/50 mt-0.5">{{ t('landing.stat_uptime') }}</span>
              </div>
            </div> -->
          </div>

          <!-- Module pills -->
          <div class="flex flex-wrap gap-2 mb-10">
            <div
              class="kamu-pill kamu-anim-pop"
              v-for="(m, i) in modulePills"
              :key="m"
              :style="`--delay: ${0.6 + i * 0.08}s`"
            >{{ m }}</div>
          </div>

          <!-- Footer bar -->
          <div class="flex items-center justify-between pt-6 border-t border-white/10 kamu-anim-fade-up"
            style="--delay: 1s">
            <div class="flex items-center gap-2 text-[11px] text-white/50">
              <span class="kamu-status-dot"></span>
              <span>{{ t('landing.systems_ok') }}</span>
            </div>
            <span class="text-[11px] text-white/50">© 2026 KAMU</span>
          </div>
        </div>

        <!-- Decorative overlays -->
        <div class="kamu-panel-grid kamu-anim-grid"></div>

        <div class="absolute -bottom-20 -left-20 pointer-events-none">
          <div class="absolute rounded-full -translate-x-1/2 -translate-y-1/2 w-60 h-60 border border-white/10 kamu-anim-ring"
            style="animation-delay: 0s, 0.3s"></div>
          <div class="absolute rounded-full -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] border border-white/[0.06] kamu-anim-ring"
            style="animation-delay: 1.3s, 0.5s"></div>
          <div class="absolute rounded-full -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] border border-white/[0.03] kamu-anim-ring"
            style="animation-delay: 2.6s, 0.7s"></div>
        </div>

        <div class="kamu-shimmer-overlay"></div>
      </div>

      <!-- ── Right Panel — Login form ── -->
      <AuthLoginForm />

    </div>
  </div>
</template>
