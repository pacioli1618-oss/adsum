'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {useRpcErrorMessage} from '@/i18n/errors';
import {useRouter} from '@/i18n/navigation';
import {getWorkplaceAsClient} from '@/lib/api';
import {rememberWorkplace} from '@/lib/device-store';
import {readTokenFromHash} from '@/lib/share-links';

/**
 * Reads the client token from the #fragment, checks it against the database, saves it on this
 * device and opens the panel. The token is never stored before the database accepts it.
 */
export function ManageScreen({slug}: {slug: string}) {
  const t = useTranslations('Manage');
  const rpcErrorMessage = useRpcErrorMessage();
  const router = useRouter();
  const [failure, setFailure] = useState<'missing-token' | {error: unknown} | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const clientToken = readTokenFromHash(window.location.hash);

    async function openAsClient() {
      if (!clientToken) {
        setFailure('missing-token');
        return;
      }
      try {
        const workplace = await getWorkplaceAsClient(slug, clientToken);
        if (isCancelled) return;
        rememberWorkplace({slug, name: workplace.name, clientToken});
        // Drop the token from the address bar and history before moving on.
        window.history.replaceState(null, '', window.location.pathname);
        router.replace(`/w/${slug}`);
      } catch (error) {
        if (!isCancelled) setFailure({error});
      }
    }

    void openAsClient();
    return () => {
      isCancelled = true;
    };
  }, [slug, router]);

  if (failure === null) return <StatusScreen message={t('checking')} />;
  return <StatusScreen isError message={failure === 'missing-token' ? t('missingToken') : rpcErrorMessage(failure.error)} />;
}
