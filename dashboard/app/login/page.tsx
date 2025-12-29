'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { authenticate } from '@/app/lib/actions';
import { Shield, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
    const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined);

    return (
        <main className="flex items-center justify-center md:h-screen bg-[#0a0a0a]">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[128px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[128px] rounded-full mix-blend-screen" />
            </div>

            <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32 z-10">
                <div className="flex w-full items-center justify-center rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 p-3 mb-4 shadow-2xl">
                    <Shield className="h-8 w-8 text-emerald-500 mr-2" />
                    <h1 className="text-xl font-bold text-white tracking-tight">Nuclei Command Center</h1>
                </div>

                <form action={dispatch} className="space-y-3">
                    <div className="flex-1 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 px-6 pb-4 pt-8 shadow-2xl">
                        <h2 className="mb-6 text-2xl font-semibold text-white text-center">Admin Access</h2>

                        <div className="w-full mb-6">
                            <div>
                                <label
                                    className="mb-3 mt-5 block text-xs font-medium text-emerald-500/80 uppercase tracking-widest"
                                    htmlFor="password"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <Input
                                        className="peer block w-full rounded-md border border-white/10 bg-black/50 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 text-white focus:border-emerald-500/50 transition-all font-mono"
                                        id="password"
                                        type="password"
                                        name="password"
                                        placeholder="Enter admin password"
                                        required
                                        minLength={6}
                                    />
                                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-emerald-500 transition-colors" />
                                </div>
                            </div>
                        </div>

                        <LoginButton />

                        <div
                            className="flex h-8 items-end space-x-1"
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            {errorMessage && (
                                <>
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                    <p className="text-sm text-red-500">{errorMessage}</p>
                                </>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}

function LoginButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-6 rounded-md transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]"
            aria-disabled={pending}
            disabled={pending}
        >
            {pending ? 'Verifying...' : 'Authenticate'}
        </Button>
    );
}
