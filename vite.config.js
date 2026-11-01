import {defineConfig} from 'vite';
export default defineConfig(({command})=>({
  plugins:[{name:'local-csp',transformIndexHtml(html){return html.replace('__DEV_CONNECT__',command==='serve'?'http://127.0.0.1:8080 http://127.0.0.1:9099 ws://127.0.0.1:5173 ws://127.0.0.1:5174':'');}}],
  build:{chunkSizeWarningLimit:800}
}));
