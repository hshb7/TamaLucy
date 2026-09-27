import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { GIFT } from './src/gift.ts'

export default defineConfig({
  // relative paths so the build works from any folder (GitHub Pages, Netlify, a USB stick...)
  base: './',
  plugins: [
    react(),
    { name: 'app-name', transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', GIFT.appName) },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: GIFT.appName,
        short_name: GIFT.appName,
        description: 'A tiny brown fox who helps you focus.',
        theme_color: '#fff4e8',
        background_color: '#fff4e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,woff2}'] },
    }),
  ],
})
