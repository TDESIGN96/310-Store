import type Echo from 'laravel-echo'

declare module '#app' {
  interface NuxtApp {
    $echo: Echo<'reverb'>
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $echo: Echo<'reverb'>
  }
}

export {}
