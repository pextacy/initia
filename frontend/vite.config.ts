import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      process: 'process/browser',
    },
    // Force a single instance of these packages so React context works
    // across both our code and the interwovenkit bundle
    dedupe: ['wagmi', '@wagmi/core', 'viem', '@tanstack/react-query', 'react', 'react-dom'],
  },
})
