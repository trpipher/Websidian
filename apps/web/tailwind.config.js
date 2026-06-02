/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
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
        'ctp-mauve': '#cba6f7',
        'ctp-green': '#a6e3a1',
        'ctp-peach': '#fab387',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#cdd6f4',
            '--tw-prose-headings': '#cdd6f4',
            '--tw-prose-links': '#89b4fa',
            '--tw-prose-bold': '#cdd6f4',
            '--tw-prose-counters': '#6c7086',
            '--tw-prose-bullets': '#6c7086',
            '--tw-prose-hr': '#313244',
            '--tw-prose-quotes': '#6c7086',
            '--tw-prose-quote-borders': '#45475a',
            '--tw-prose-code': '#cdd6f4',
            '--tw-prose-pre-code': '#cdd6f4',
            '--tw-prose-pre-bg': '#181825',
            '--tw-prose-th-borders': '#313244',
            '--tw-prose-td-borders': '#313244',
            maxWidth: 'none',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '15px',
            lineHeight: '1.75',
            'pre': { borderRadius: '6px', padding: '12px 16px' },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            'code': { background: '#313244', borderRadius: '3px', padding: '1px 5px' },
            'table': { width: '100%' },
            'thead th': { background: '#181825' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
