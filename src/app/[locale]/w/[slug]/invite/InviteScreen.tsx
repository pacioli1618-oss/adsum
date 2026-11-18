'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Toggle} from '@/components/ui/Toggle';
import {useLoader} from '@/hooks/use-loader';
import {useRpcErrorMessage} from '@/i18n/errors';
import {useFormatMoney} from '@/i18n/format';
import {Link, useRouter} from '@/i18n/navigation';
import {acceptInvite, declineInvite, getInvite, type InviteView} from '@/lib/api';
import {getDeviceId, linkClient} from '@/lib/device-store';
import {readTokenFromHash} from '@/lib/share-links';

/** /w/<slug>/invite#<inviteToken>: what the client asks to see, and the person's answer. */
export function InviteScreen({slug}: {slug: string}) {
  const t = useTranslations('Invite');
  const common = useTranslations('Common');
  // The token lives in the fragment; read it once in the browser.
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fragment only exists in the browser
    setInviteToken(readTokenFromHash(window.location.hash));
  }, []);

  if (inviteToken === null) return <StatusScreen message={common('loading')} />;
  if (!inviteToken) return <StatusScreen isError message={t('missingToken')} />;
  return <InviteDetails slug={slug} inviteToken={inviteToken} />;
}

function InviteDetails({slug, inviteToken}: {slug: string; inviteToken: string}) {
  const t = useTranslations('Invite');
  const common = useTranslations('Common');
  const rpcErrorMessage = useRpcErrorMessage();
  const formatMoney = useFormatMoney();
  const router = useRouter();
  const {data: invite, error, isLoading, refresh} = useLoader(`${slug}:${inviteToken}`, () => getInvite(slug, inviteToken));
  const [sharesDailyNotice, setSharesDailyNotice] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <StatusScreen message={common('loading')} />;
  if (!invite) return <StatusScreen isError message={rpcErrorMessage(error)} />;

  const {workplace} = invite;

  function openInNotebook(view: InviteView, shares: boolean) {
    const clientId = linkClient({
      name: view.workplace.name,
      rateAmount: view.workplace.rateAmount,
      rateUnit: view.workplace.rateUnit,
      currency: view.workplace.currency,
      link: {
        slug,
        inviteToken,
        sharesDailyNotice: shares,
        clientWantsDailyNotice: view.workplace.wantsDailyNotice,
        status: view.status === 'stopped' ? 'stopped' : 'active',
      },
    });
    // The token is now in the notebook; drop it from the address bar and history.
    window.history.replaceState(null, '', window.location.pathname);
    router.replace(`/notebook/${clientId}`);
  }

  async function handleAccept() {
    setBusy('accept');
    setActionError(null);
    try {
      const shares = sharesDailyNotice && workplace.wantsDailyNotice;
      await acceptInvite(slug, inviteToken, shares, getDeviceId());
      openInNotebook({...invite!, status: 'active'}, shares);
    } catch (failure) {
      setActionError(rpcErrorMessage(failure));
      setBusy(null);
    }
  }

  async function handleDecline() {
    if (!window.confirm(t('declineConfirm', {workplace: workplace.name}))) return;
    setBusy('decline');
    setActionError(null);
    try {
      await declineInvite(slug, inviteToken);
      await refresh();
    } catch (failure) {
      setActionError(rpcErrorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  const rate =
    workplace.rateAmount === null ? null : t('rate', {amount: formatMoney(workplace.rateAmount, workplace.currency), unit: workplace.rateUnit});

  return (
    <main className={screen.screen}>
      <AppHeader />

      <section className={screen.stack}>
        <p className={blocks.muted}>{t('greeting', {name: invite.providerName})}</p>
        <h1 className={blocks.title}>{t('title', {workplace: workplace.name})}</h1>
        {rate && <p className={blocks.lead}>{rate}</p>}
      </section>

      {invite.status === 'active' || invite.status === 'stopped' ? (
        <Card variant="large">
          <div className={screen.stack}>
            <p className={blocks.lead}>{invite.status === 'active' ? t('alreadyAccepted') : t('alreadyStopped')}</p>
            <Button size="cta" isFullWidth onClick={() => openInNotebook(invite, invite.sharesDailyNotice)}>
              {t('openNotebook')}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <section className={screen.section}>
            <h2 className={screen.sectionTitle}>{t('sharedTitle')}</h2>
            <Card variant="large">
              <ul className={screen.stack} style={{margin: 0, paddingLeft: 18}}>
                <li>{t('sharedSummary')}</li>
                <li>{t('sharedChoice')}</li>
              </ul>
            </Card>
            {workplace.wantsDailyNotice && (
              <Toggle
                checked={sharesDailyNotice}
                onChange={setSharesDailyNotice}
                title={t('dailyNotice')}
                hint={t('dailyNoticeHint')}
              />
            )}
          </section>

          <section className={screen.section}>
            <h2 className={screen.sectionTitle}>{t('notSharedTitle')}</h2>
            <p className={screen.sectionHint}>{t('notShared')}</p>
          </section>

          {invite.status === 'declined' && <p className={blocks.notice}>{t('declinedBefore')}</p>}
          <p className={blocks.notice}>{t('youDecide')}</p>
          {actionError && (
            <p role="alert" className={screen.formError}>
              {actionError}
            </p>
          )}

          <div className={screen.stack}>
            <Button size="cta" isFullWidth isLoading={busy === 'accept'} disabled={busy !== null} onClick={() => void handleAccept()}>
              {t('accept')}
            </Button>
            {invite.status === 'invited' && (
              <Button variant="ghost" isFullWidth isLoading={busy === 'decline'} disabled={busy !== null} onClick={() => void handleDecline()}>
                {t('decline')}
              </Button>
            )}
            <p className={blocks.muted}>
              {t.rich('acceptTerms', {
                terms: (chunks) => <Link href="/terms">{chunks}</Link>,
                privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
              })}
            </p>
          </div>
        </>
      )}

      <footer className={screen.footer}>
        <p className={blocks.notice}>{common('notTimeClock')}</p>
        <LegalLinks />
      </footer>
    </main>
  );
}
