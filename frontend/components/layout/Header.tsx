// ============================================
// components/layout/Header.tsx (UPDATED - Show User Info)
// ============================================
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuthContext } from '@/hooks/useAuth';

export default function Header() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout } = useAuthContext();

    let navLinks = [
        { href: '/', label: 'Home' },
        { href: '/reports', label: 'Reports' },
        { href: '/officials', label: 'Officials' },
    ];
    // console.log(user);
    // Add conditional links based on user role
    if (user) {
        navLinks.push({ href: '/dashboard', label: 'Dashboard' });
        if (user.role === 'admin') {
            navLinks.push({ href: '/admin/officials', label: 'Admin' });
        }else if(user.role === 'official') {
            navLinks = navLinks.filter(link => link.href !== '/dashboard' && link.href !== '/' &&link.href !== '/reports');
            navLinks.push({ href: '/dashboard/official', label: 'MyDashboard' });


        }
    }

    return (
        <header className="bg-white shadow-sm sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">CT</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">CivicTrack</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-6">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm font-medium transition ${
                                    pathname === link.href
                                        ? 'text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center gap-3">
                        {user ? (
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.role}</p>
                                </div>
                                <button
                                    onClick={logout}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <>
                                <Link
                                    href="/auth/login"
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden text-gray-600"
                    >
                        {mobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-gray-200">
                        <nav className="flex flex-col gap-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`text-sm font-medium ${
                                        pathname === link.href
                                            ? 'text-blue-600'
                                            : 'text-gray-600'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            {user ? (
                                <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="text-xs text-gray-500 mb-2">{user.role}</p>
                                    <button
                                        onClick={() => {
                                            logout();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="px-4 py-2 text-center border border-gray-300 rounded-lg text-sm"
                                    >
                                        Logout
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 mt-4">
                                    <Link
                                        href="/auth/login"
                                        className="px-4 py-2 text-center border border-gray-300 rounded-lg"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        href="/auth/register"
                                        className="px-4 py-2 text-center bg-blue-600 text-white rounded-lg"
                                    >
                                        Sign Up
                                    </Link>
                                </div>
                            )}
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}