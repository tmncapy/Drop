import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          controller: path.resolve(__dirname, 'controller.html'),
          host: path.resolve(__dirname, 'host.html'),
          player: path.resolve(__dirname, 'player.html'),
          answer: path.resolve(__dirname, 'answer.html'),
          answer1: path.resolve(__dirname, 'answer1.html'),
          answer2: path.resolve(__dirname, 'answer2.html'),
          answer3: path.resolve(__dirname, 'answer3.html'),
          answer4: path.resolve(__dirname, 'answer4.html'),
          projector: path.resolve(__dirname, 'projector.html'),
          bigscreen: path.resolve(__dirname, 'bigscreen.html'),
          bigscreen_complete: path.resolve(__dirname, 'bigscreen_complete.html'),
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
