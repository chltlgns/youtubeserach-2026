'use client';

import { useState } from 'react';
import { X, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        } else {
            onAuthSuccess();
            onClose();
        }
        setLoading(false);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage('가입 확인 이메일을 발송했습니다. 이메일을 확인해주세요!');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    {mode === 'login' ? (
                        <>
                            <LogIn className="w-5 h-5" /> 로그인
                        </>
                    ) : (
                        <>
                            <UserPlus className="w-5 h-5" /> 회원가입
                        </>
                    )}
                </h2>

                <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">이메일</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-10 py-3 focus:outline-none focus:border-blue-500"
                                    placeholder="email@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">비밀번호</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-10 py-3 focus:outline-none focus:border-blue-500"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                                {error}
                            </p>
                        )}

                        {message && (
                            <p className="text-green-400 text-sm bg-green-500/10 p-3 rounded-lg">
                                {message}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                        >
                            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
                        </button>
                    </div>
                </form>

                <div className="mt-4 text-center text-sm text-gray-400">
                    {mode === 'login' ? (
                        <p>
                            계정이 없으신가요?{' '}
                            <button
                                onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                                className="text-blue-400 hover:underline"
                            >
                                회원가입
                            </button>
                        </p>
                    ) : (
                        <p>
                            이미 계정이 있으신가요?{' '}
                            <button
                                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                                className="text-blue-400 hover:underline"
                            >
                                로그인
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
