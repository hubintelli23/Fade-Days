import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 상대 경로로 빌드해 GitHub Pages 하위 경로나 Capacitor에서도 그대로 열리게 함
  base: './',
  server: {
    host: true, // 같은 와이파이의 휴대폰에서 접속 가능
  },
});
