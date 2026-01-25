import { isSetupRequired } from '@/lib/setup';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
    // Check if setup is required
    if (isSetupRequired()) {
        redirect('/setup');
    }

    // Check if already logged in
    const session = await auth();
    if (session?.user) {
        redirect('/');
    }

    return <LoginForm />;
}
