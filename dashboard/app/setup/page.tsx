import { isSetupRequired } from '@/lib/setup';
import { redirect } from 'next/navigation';
import SetupForm from './setup-form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
    // If setup is NOT required (i.e., already done), redirect to login
    if (!isSetupRequired()) {
        redirect('/login');
    }

    return <SetupForm />;
}
