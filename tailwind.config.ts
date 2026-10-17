import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        card2: 'var(--card-2)',
        header: 'var(--header)',
        line: 'var(--border)',
        line2: 'var(--border-strong)',
        ink: 'var(--text)',
        ink2: 'var(--text-2)',
        ink3: 'var(--text-3)',
        accent: 'var(--accent)',
        accentsoft: 'var(--accent-soft)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        warning: 'var(--warning)'
      },
      borderRadius: {
        card: '16px',
        sm2: '10px'
      },
      boxShadow: {
        soft: 'var(--shadow)',
        pop: 'var(--shadow-hover)'
      },
      maxWidth: {
        wrap: '1240px'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        }
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.22,1,.36,1) both',
        float: 'float 7s ease-in-out infinite'
      }
    }
  }
}
