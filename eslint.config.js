import { config as defaultConfig } from '@epic-web/config/eslint'
import { globalIgnores } from 'eslint/config'

/** @type {import("eslint").Linter.Config[]} */
export default [
	globalIgnores([
		'node_modules/',
		'build/',
		'temp/',
		'dist/',
		'.yarn/',
	]),
	...defaultConfig,
	{
		rules: {
			'import/order': [0],
		},
	},
]
