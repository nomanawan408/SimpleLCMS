import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/**/*.blade.php',
        './resources/**/*.js',
        './resources/**/*.ts',
        './resources/**/*.jsx',
        './resources/**/*.tsx',
    ],
    theme: {
        extend: {
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                /* Legl teal palette: #01B88E brand primary. */
                brand: {
                    50:  '#E6FBF6',
                    100: '#C7F5EA',
                    200: '#8FEBD8',
                    300: '#54DCC2',
                    400: '#1FC9AC',
                    500: '#01B88E',
                    600: '#019A76',
                    700: '#017A5E',
                    800: '#015C47',
                    900: '#014034',
                    950: '#00241D',
                    DEFAULT: '#01B88E',
                },
                /* Warm magenta accent that pairs with the "Dark Blue" scale. */
                magenta: {
                    50:  '#FFF0FB',
                    100: '#FFE0F6',
                    200: '#FFBDEB',
                    300: '#FF98E0',
                    400: '#FF70D5',
                    500: '#FF40C0',
                    600: '#E6009A',
                    700: '#B8007A',
                    800: '#8C005E',
                    900: '#5D003D',
                    950: '#3A0026',
                    DEFAULT: '#FF40C0',
                },
                turquoise: {
                    50:  '#E0F8FC',
                    100: '#BFF1F5',
                    200: '#9FE8F0',
                    300: '#7EDDE9',
                    400: '#4ED2E1',
                    500: '#1ec8e6',
                    600: '#007A99',
                    700: '#00566E',
                    800: '#004154',
                    900: '#003040',
                    950: '#00202D',
                    DEFAULT: '#1ec8e6',
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                success: {
                    DEFAULT: 'hsl(var(--success))',
                    foreground: 'hsl(var(--success-foreground, 0 0% 100%))',
                },
                warning: {
                    DEFAULT: 'hsl(var(--warning))',
                    foreground: 'hsl(var(--warning-foreground, 0 0% 0%))',
                },
                info: {
                    DEFAULT: 'hsl(var(--info))',
                    foreground: 'hsl(var(--info-foreground, 0 0% 100%))',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: {
                /* Segoe UI everywhere, including tables and reference codes.
                   It ships with Windows only and is not licensed for
                   self-hosting, so the fallbacks matter: -apple-system gives
                   macOS/iOS San Francisco and Roboto covers Android, both far
                   closer to Segoe UI than Arial is. */
                sans: [
                    'Segoe UI',
                    'Segoe UI Variable Text',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Roboto',
                    'Helvetica Neue',
                    'Arial',
                    ...defaultTheme.fontFamily.sans,
                ],
                /* Intentionally the same face: reference numbers stay in Segoe
                   UI and rely on tabular-nums to line their digits up. */
                mono: [
                    'Segoe UI',
                    'Segoe UI Variable Text',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Roboto',
                    'Helvetica Neue',
                    'Arial',
                    ...defaultTheme.fontFamily.sans,
                ],
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
                'shimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'shimmer': 'shimmer 3s infinite',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
};
