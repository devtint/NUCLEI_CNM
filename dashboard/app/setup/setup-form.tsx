'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SetupForm() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, confirmPassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Setup failed');
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <main className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
                <div className="fixed inset-0 z-0">
                    <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[128px] rounded-full mix-blend-screen" />
                    <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[128px] rounded-full mix-blend-screen" />
                </div>
                <div className="relative z-10 text-center">
                    <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
                    <p className="text-gray-400">Redirecting to login...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[128px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[128px] rounded-full mix-blend-screen" />
            </div>

            <div className="relative mx-auto flex w-full max-w-[450px] flex-col space-y-2.5 p-4 z-10">
                {/* Header */}
                <div className="flex w-full items-center justify-center rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 p-3 mb-4 shadow-2xl">
                    <Shield className="h-8 w-8 text-emerald-500 mr-2" />
                    <h1 className="text-xl font-bold text-white tracking-tight">Nuclei Command Center</h1>
                </div>

                {/* Setup Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex-1 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 px-6 pb-6 pt-8 shadow-2xl">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-semibold text-white">Initial Setup</h2>
                            <p className="text-gray-400 text-sm mt-2">Create your admin password to get started</p>
                        </div>

                        {/* Password Field */}
                        <div className="mb-4">
                            <label
                                className="mb-2 block text-xs font-medium text-emerald-500/80 uppercase tracking-widest"
                                htmlFor="password"
                            >
                                Admin Password
                            </label>
                            <div className="relative">
                                <Input
                                    className="peer block w-full rounded-md border border-white/10 bg-black/50 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 text-white focus:border-emerald-500/50 transition-all"
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Minimum 8 characters"
                                    required
                                    minLength={8}
                                />
                                <Lock className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-emerald-500 transition-colors" />
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="mb-6">
                            <label
                                className="mb-2 block text-xs font-medium text-emerald-500/80 uppercase tracking-widest"
                                htmlFor="confirmPassword"
                            >
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Input
                                    className="peer block w-full rounded-md border border-white/10 bg-black/50 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 text-white focus:border-emerald-500/50 transition-all"
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    required
                                    minLength={8}
                                />
                                <Lock className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-emerald-500 transition-colors" />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-6 rounded-md transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                'Complete Setup'
                            )}
                        </Button>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 mt-4 p-3 rounded-md bg-red-500/10 border border-red-500/20">
                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                <p className="text-sm text-red-500">{error}</p>
                            </div>
                        )}

                        {/* Info Box */}
                        <div className="mt-6 p-4 rounded-md bg-blue-500/10 border border-blue-500/20">
                            <p className="text-xs text-blue-400">
                                <strong>Note:</strong> This setup is only shown on first run. Your credentials will be securely stored and persisted across container restarts.
                            </p>
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}
