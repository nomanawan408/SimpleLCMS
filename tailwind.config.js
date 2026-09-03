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
                /* SIMPLE-CM palette: Vivid #02b88e, Dark #016452 (lighter than #014034), Mid #0097b2, Grey #545454, Coral #ff5757 */
                brand: {
                    50:  '#E6FBF7',
                    100: '#C7F5EA',
                    200: '#8FEBD8',
                    300: '#54DCC2',
                    400: '#02b88e',
                    500: '#02b88e',
                    600: '#0097b2',
                    700: '#007a91',
                    800: '#016452',
                    900: '#016452',
                    950: '#014034',
                    DEFAULT: '#02b88e',
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
                    hover: 'hsl(var(--primary-hover))',
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
                    muted: 'hsl(var(--accent-muted))',
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
                /* Lato, self-hosted (see app.css). The fallbacks are only for
                   the moment before the webfont lands. */
                sans: ['Lato', ...defaultTheme.fontFamily.sans],
                /* Deliberately the same face: reference numbers stay in Lato
                   and rely on tabular-nums to keep their digits aligned. */
                mono: ['Lato', ...defaultTheme.fontFamily.sans],
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
