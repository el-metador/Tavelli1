import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiUrl = env.VITE_API_URL || env.REACT_APP_API_URL || 'http://localhost:8787/api';
    const supabaseUrl = env.VITE_SUPABASE_URL || env.REACT_APP_SUPABASE_URL || '';
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.REACT_APP_SUPABASE_ANON_KEY || '';
    const apiTarget = apiUrl.replace(/\/api\/?$/, '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: apiTarget,
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.REACT_APP_API_URL': JSON.stringify(apiUrl),
        'process.env.REACT_APP_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
