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
	},
	// Tell Vitest to use the `browser` entry points in `package.json` files, even though it's running in Node
	resolve: process.env.VITEST
		? {
				conditions: ['browser']
		  }
		: undefined
});
