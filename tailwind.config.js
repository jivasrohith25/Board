/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kippo-pink': '#ee1f66',
        'void-black': '#000000',
        'carbon': '#29292a',
        'ash': '#333333',
        'ghost-white': '#ffffff',
      },
      fontFamily: {
        display: ['"Source Code Pro"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        body: ['"Source Code Pro"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        mono: ['"Source Code Pro"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'card': '15px',
        'button': '10px',
        'icon': '50px',
      },
    },
  },
  plugins: [],
}
