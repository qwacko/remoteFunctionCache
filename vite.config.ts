import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: true
	},
	test: {
		expect: { requireAssertions: true },
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}', 'src/**/*.svelte.{test,spec}.{js,ts}'],
		exclude: ['src/lib/server/**']
	}
});
