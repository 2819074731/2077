export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  srcDir: 'app',

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots'
  ],

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: '~~/tailwind.config.ts'
  },

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme'
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0e0e0e' },
        { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' },
        { property: 'og:site_name', content: '2077 导航' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'description', content: '2077 导航：可自定义的浏览器起始页，聚合常用站点，支持离线使用与云端同步。' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: '2077' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate', type: 'application/xml', title: 'XML Sitemap', href: '/sitemap.xml' },
        { rel: 'alternate', type: 'text/plain', title: 'LLMs.txt', href: '/llms.txt' }
      ]
    }
  },

  site: {
    url: 'https://my2077.com',
    name: '2077 导航',
    description: '可自定义的浏览器起始页，聚合常用站点导航，并提供独立的分类网站目录'
  },

  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/login', '/register', '/settings', '/share', '/admin', '/admin/**'],
    cacheMaxAgeSeconds: 300
  },

  robots: {
    disallow: ['/login', '/register', '/settings', '/admin', '/api/']
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: '2077 导航',
      short_name: '2077',
      description: '可自定义的浏览器起始页',
      theme_color: '#0e0e0e',
      background_color: '#0e0e0e',
      display: 'standalone',
      lang: 'zh-CN',
      start_url: '/',
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
      ],
      share_target: {
        action: '/share',
        method: 'GET',
        params: { title: 'title', text: 'text', url: 'url' }
      }
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/(icons\.duckduckgo\.com|www\.google\.com\/s2\/favicons|favicon\.im)\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'favicons',
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }
          }
        },
        {
          urlPattern: /\/api\/(config|me|nav).*/i,
          handler: 'NetworkFirst',
          options: { cacheName: 'api', networkTimeoutSeconds: 3 }
        }
      ]
    },
    client: { installPrompt: true }
  },

  runtimeConfig: {
    dbHost: process.env.DB_HOST || '127.0.0.1',
    dbPort: process.env.DB_PORT || '3306',
    dbUser: process.env.DB_USER || 'my2077',
    dbPass: process.env.DB_PASS || '',
    dbName: process.env.DB_NAME || 'my2077',
    sessionSecret: process.env.SESSION_SECRET || 'change-me',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://my2077.com'
    }
  },

  nitro: {
    preset: 'node-server'
  }
})
