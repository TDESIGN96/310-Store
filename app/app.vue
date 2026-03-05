<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center overflow-hidden relative">
    <!-- Animated background orbs -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="orb orb-4"></div>
    </div>

    <!-- Floating particles -->
    <div class="particles">
      <span v-for="n in 20" :key="n" class="particle" :style="particleStyle(n)"></span>
    </div>

    <!-- Main content -->
    <div class="relative z-10 text-center px-6">
      <!-- Logo/Icon -->
      <div class="mb-8 animate-bounce-slow">
        <div class="w-24 h-24 mx-auto bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl rotate-45 flex items-center justify-center shadow-2xl shadow-orange-500/30">
          <span class="text-4xl font-black text-white -rotate-45">310</span>
        </div>
      </div>

      <!-- Welcome text -->
      <h1 class="text-6xl md:text-8xl font-black mb-4 animate-fade-in-up">
        <span class="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
          Welcome to
        </span>
      </h1>
      
      <h2 class="text-5xl md:text-7xl font-black mb-8 animate-fade-in-up animation-delay-200">
        <span class="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent animate-gradient">
          310 Store
        </span>
      </h2>

      <!-- Tagline -->
      <p class="text-xl md:text-2xl text-purple-200/80 mb-12 animate-fade-in-up animation-delay-400 tracking-wide">
        Your Premium Shopping Destination
      </p>

      <!-- CTA Button -->
      <button class="group relative px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full font-bold text-lg text-white shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 animate-fade-in-up animation-delay-600 overflow-hidden">
        <span class="relative z-10 flex items-center gap-2">
          Explore Now
          <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
          </svg>
        </span>
        <div class="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </button>

      <!-- Features icons -->
      <div class="mt-16 flex justify-center gap-8 md:gap-16 animate-fade-in-up animation-delay-800">
        <div class="text-center group cursor-pointer">
          <div class="w-14 h-14 mx-auto mb-3 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-110">
            <svg class="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </div>
          <span class="text-sm text-purple-200/70">Fast Delivery</span>
        </div>
        
        <div class="text-center group cursor-pointer">
          <div class="w-14 h-14 mx-auto mb-3 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-110">
            <svg class="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </div>
          <span class="text-sm text-purple-200/70">Best Quality</span>
        </div>
      </div>
    </div>

    <NuxtRouteAnnouncer />
  </div>
</template>

<script setup>
const particleStyle = (n) => ({
  '--delay': `${Math.random() * 5}s`,
  '--duration': `${15 + Math.random() * 10}s`,
  '--x-start': `${Math.random() * 100}%`,
  '--y-start': `${100 + Math.random() * 20}%`,
  left: `${Math.random() * 100}%`,
})
</script>

<style>
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
}

@keyframes pulse-orb {
  0%, 100% { transform: scale(1) translate(0, 0); }
  50% { transform: scale(1.1) translate(10px, -10px); }
}

@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: pulse-orb 8s ease-in-out infinite;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #f59e0b, #ea580c);
  top: -100px;
  right: -100px;
  animation-delay: 0s;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  bottom: -50px;
  left: -50px;
  animation-delay: 2s;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: linear-gradient(135deg, #ec4899, #f43f5e);
  top: 50%;
  left: 50%;
  animation-delay: 4s;
}

.orb-4 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, #14b8a6, #06b6d4);
  bottom: 20%;
  right: 10%;
  animation-delay: 6s;
}

.particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  bottom: var(--y-start);
  animation: float var(--duration) var(--delay) infinite ease-out;
}

.particle:nth-child(odd) {
  width: 4px;
  height: 4px;
  background: rgba(251, 191, 36, 0.8);
}

.particle:nth-child(3n) {
  width: 8px;
  height: 8px;
  background: rgba(168, 85, 247, 0.6);
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out forwards;
  opacity: 0;
}

.animate-bounce-slow {
  animation: bounce-slow 3s ease-in-out infinite;
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
}

.animation-delay-200 {
  animation-delay: 0.2s;
}

.animation-delay-400 {
  animation-delay: 0.4s;
}

.animation-delay-600 {
  animation-delay: 0.6s;
}

.animation-delay-800 {
  animation-delay: 0.8s;
}
</style>
