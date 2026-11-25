import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'jsdom',setupFiles:['./tests/setup-offline.js'],include:['tests/*.ui.jsx']}});
