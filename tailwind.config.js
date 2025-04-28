/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3A8DFF',
          50: '#FFFFFF',
          100: '#F3F8FF',
          200: '#C6DDFF',
          300: '#99C2FF',
          400: '#6DA7FF',
          500: '#3A8DFF',
          600: '#0072FF',
          700: '#0058C7',
          800: '#003F8F',
          900: '#002557',
        },
        carbon: {
          black: '#0C0F1E',
          dark: '#1A1D2E',
          medium: '#1F2233',
        },
        neon: {
          cyan: 'rgba(0, 255, 255, 0.75)',
          cyan_glow: 'rgba(0, 255, 255, 0.25)',
          magenta: 'rgba(255, 0, 255, 0.75)',
          magenta_glow: 'rgba(255, 0, 255, 0.25)',
          blue: 'rgba(58, 141, 255, 0.75)',
          blue_glow: 'rgba(58, 141, 255, 0.25)',
          violet: 'rgba(138, 43, 226, 0.75)',
          violet_glow: 'rgba(138, 43, 226, 0.25)',
        },
        success: {
          DEFAULT: 'rgba(16, 233, 128, 0.9)',
          glow: 'rgba(16, 233, 128, 0.25)',
        },
        danger: {
          DEFAULT: 'rgba(255, 61, 113, 0.9)',
          glow: 'rgba(255, 61, 113, 0.25)',
        },
        warning: {
          DEFAULT: 'rgba(255, 170, 0, 0.9)',
          glow: 'rgba(255, 170, 0, 0.25)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
        'glass-sm': '0 4px 12px 0 rgba(31, 38, 135, 0.15)',
        'glass-hover': '0 8px 32px 0 rgba(31, 38, 135, 0.3)',
        'neon-glow': '0 0 10px rgba(0, 255, 255, 0.2)',
        'success-glow': '0 0 10px rgba(16, 233, 128, 0.2)',
        'danger-glow': '0 0 10px rgba(255, 61, 113, 0.2)',
      },
      backgroundImage: {
        'bg-gradient': 'linear-gradient(135deg, var(--tw-colors-carbon-black), var(--tw-colors-carbon-dark))',
        'primary-gradient': 'linear-gradient(135deg, rgba(0, 255, 255, 0.7), rgba(138, 43, 226, 0.7))',
        'upload-gradient': 'linear-gradient(to bottom right, rgba(255, 255, 255, 0.03), rgba(0, 255, 255, 0.03))',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-glassmorphism')
  ],
}

