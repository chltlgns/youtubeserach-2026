'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeSwitcher } from './ThemeProvider';
import { Search, Download, Scissors, ShoppingCart, Youtube } from 'lucide-react';

const navItems = [
    { href: '/', label: 'Search', icon: Search },
    { href: '/download', label: 'Download', icon: Download },
    { href: '/edit', label: 'Edit', icon: Scissors },
    { href: '/coupang', label: 'Coupang', icon: ShoppingCart },
];

export function Header() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 backdrop-blur-lg bg-[var(--background)]/80 border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:shadow-red-500/40 transition-shadow">
                            <Youtube className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">YGIF</h1>
                            <p className="text-[10px] text-gray-400 -mt-1">Global Insight Finder</p>
                        </div>
                    </Link>

                    {/* Navigation */}
                    <nav className="flex items-center gap-1">
                        {navItems.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Theme Switcher */}
                    <ThemeSwitcher />
                </div>
            </div>
        </header>
    );
}
