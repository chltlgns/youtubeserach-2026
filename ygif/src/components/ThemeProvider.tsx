'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ThemeName, THEMES } from '@/lib/constants';

interface ThemeContextType {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
    cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeName>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Check localStorage first
        const stored = localStorage.getItem('ygif-theme') as ThemeName | null;
        if (stored && THEMES[stored]) {
            setThemeState(stored);
            return;
        }

        // Check system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setThemeState('dark');
        } else {
            setThemeState('light');
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const themeConfig = THEMES[theme];
        document.documentElement.style.setProperty('--background', themeConfig.background);
        document.documentElement.style.setProperty('--foreground', themeConfig.foreground);
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ygif-theme', theme);
    }, [theme, mounted]);

    const setTheme = (newTheme: ThemeName) => {
        setThemeState(newTheme);
    };

    const cycleTheme = () => {
        const themeNames = Object.keys(THEMES) as ThemeName[];
        const currentIndex = themeNames.indexOf(theme);
        const nextIndex = (currentIndex + 1) % themeNames.length;
        setThemeState(themeNames[nextIndex]);
    };

    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}

export function ThemeSwitcher() {
    const { theme, cycleTheme } = useTheme();
    const currentTheme = THEMES[theme];

    return (
        <button
            onClick={cycleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={`Current: ${currentTheme.name}. Click to switch.`}
        >
            <span className="text-xl">{currentTheme.icon}</span>
            <span className="text-sm font-medium hidden sm:inline">{currentTheme.name}</span>
        </button>
    );
}
