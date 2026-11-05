import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Um único código-fonte gera três alvos:
//  - web:     app web normal (pode ser hospedado em qualquer lugar)
//  - desktop: carregado pelo Electron (Windows instalável)
//  - mobile:  carregado pelo Capacitor (Android instalável, iOS no futuro)
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'desktop' || mode === 'mobile' ? './' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
