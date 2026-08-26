import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-primary ${
        isDark ? 'bg-bg-elevated border border-ui-border' : 'bg-bg-secondary border border-ui-border'
      }`}
      aria-label="Toggle Dark Mode"
    >
      <motion.div
        className={`absolute left-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-white shadow-sm`}
        initial={false}
        animate={{
          x: isDark ? 24 : 0,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5" strokeWidth={2.5} />
        ) : (
          <Sun className="h-3.5 w-3.5" strokeWidth={2.5} />
        )}
      </motion.div>
    </button>
  );
}
