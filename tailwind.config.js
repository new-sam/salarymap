/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // CSS 변수 기반 (shadcn 호환)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
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
        // 토스식 그레이
        gray: {
          0:   '#FFFFFF',
          50:  '#F9FAFB',
          100: '#F2F4F6',
          200: '#E5E8EB',
          300: '#D1D6DB',
          400: '#B0B8C1',
          500: '#8B95A1',
          600: '#6B7684',
          700: '#4E5968',
          800: '#333D4B',
          900: '#191F28',
        },
      },
      fontFamily: {
        // Pretendard first (ko/en/vi covered with the full glyph set),
        // Inter as a clean Latin fallback before system stack.
        sans: ["'Pretendard Variable'", "'Pretendard'", "'Inter'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", "'Helvetica Neue'", 'sans-serif'],
      },
      fontSize: {
        // Semantic display sizes paired with sensible line-heights and tracking.
        // Use these instead of arbitrary text-[Npx] for hero/section/KPI headers.
        kpi:       ['36px', { lineHeight: '1.2',  letterSpacing: '-0.02em',  fontWeight: '900' }],
        hero:      ['28px', { lineHeight: '1.22', letterSpacing: '-0.022em', fontWeight: '800' }],
        section:   ['20px', { lineHeight: '1.3',  letterSpacing: '-0.015em', fontWeight: '800' }],
        cardTitle: ['15px', { lineHeight: '1.4',  letterSpacing: '-0.01em',  fontWeight: '700' }],
        body:      ['14px', { lineHeight: '1.55', letterSpacing: '-0.005em', fontWeight: '500' }],
        meta:      ['12.5px', { lineHeight: '1.55', letterSpacing: '0',      fontWeight: '500' }],
        caption:   ['11px',  { lineHeight: '1.5',  letterSpacing: '0.02em',  fontWeight: '700' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'soft-xs': '0 1px 2px rgba(17,24,39,0.04)',
        'soft-sm': '0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)',
        'soft-md': '0 4px 12px rgba(17,24,39,0.08), 0 2px 4px rgba(17,24,39,0.04)',
        'soft-lg': '0 10px 25px rgba(17,24,39,0.10), 0 4px 10px rgba(17,24,39,0.05)',
        'soft-xl': '0 20px 50px rgba(17,24,39,0.15)',
        'brand':   '0 6px 16px rgba(234,88,12,0.25)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
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
        // Subtle hover-y for the sidebar to-do counter — draws the eye
        // without feeling spammy.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-2px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        float: 'float 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
