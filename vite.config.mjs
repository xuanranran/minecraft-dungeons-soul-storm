import {defineConfig} from 'vite';
export default defineConfig({
 root:'src',publicDir:'../public',base:'./',
 build:{outDir:'../dist',emptyOutDir:true,target:'es2022',manifest:true,cssCodeSplit:true,chunkSizeWarningLimit:300},
 server:{fs:{allow:['.']}},
});
