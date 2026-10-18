import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {bintvProxyPlugin, watchPartyPlugin} from './vite.plugins';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), bintvProxyPlugin(), watchPartyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 4207,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: true,
      proxy: {
        '/api/iptv': {
          target: 'https://iptv.rdnutz.us',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/iptv/, ''),
        },
        '/api/smutt': {
          target: 'https://iptv.rdnutz.us',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/smutt/, ''),
        },
        '/api/eporner': {
          target: 'https://www.eporner.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/eporner/, ''),
        },
        '/api/ytmusic': {
          target: 'https://music.youtube.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/ytmusic/, ''),
        },
        '/api/deezer': {
          target: 'https://api.deezer.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/deezer/, ''),
        },
        '/api/music': {
          target: 'http://localhost:8765',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/music/, '/api/music'),
        },
      },
    },
  };
});
