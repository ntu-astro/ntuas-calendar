import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const sharedRules = {
	...tseslint.configs.recommended.rules,
	'@typescript-eslint/no-explicit-any': 'warn',
	'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
	'no-console': ['warn', { allow: ['warn', 'error'] }],
};

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.json' },
		},
		plugins: { '@typescript-eslint': tseslint },
		rules: sharedRules,
	},
	{
		files: ['client/src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.client.json' },
		},
		plugins: { '@typescript-eslint': tseslint },
		rules: {
			...sharedRules,
			// Lock in the existing security discipline: no direct innerHTML writes.
			'no-restricted-syntax': [
				'error',
				{
					selector: "AssignmentExpression[left.property.name='innerHTML']",
					message: 'Direct innerHTML assignment is forbidden. Use createElement/textContent + escapeHTML().',
				},
			],
		},
	},
	{
		ignores: ['node_modules/', '.wrangler/', 'worker-configuration.d.ts', 'public/dist/'],
	},
];
