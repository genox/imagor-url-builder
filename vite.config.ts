/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'
import packageJson from './package.json'

const getPackageName = (): string => {
	return packageJson.name as string
}

const getPackageNameCamelCase = (): string => {
	try {
		return getPackageName().replace(/-./g, (char) => char[1].toUpperCase())
	} catch (err) {
		console.error(err)
		throw new Error('Name property in package.json is missing.')
	}
}

export default defineConfig({
	base: './',
	build: {
		outDir: './build/dist',
		lib: {
			entry: path.resolve(__dirname, 'src/index.ts'),
			name: getPackageNameCamelCase(),
			formats: ['es', 'cjs'],
			fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
		},
		minify: true,
		ssr: true,
	},
	test: {
		globals: true,
		watch: false,
		setupFiles: ['./test/setup.ts'],
		globalSetup: ['./test/global-setup.ts'],
	},
	resolve: {
		alias: {
			'~': path.resolve(__dirname, 'src'),
		},
	},
})
