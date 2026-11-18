'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {ActionMenu} from '@/components/ui/ActionMenu';
import {Button, buttonClassName} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {CopyButton} from '@/components/ui/CopyButton';
import {Tag} from '@/components/ui/Tag';
import {TextField} from '@/components/ui/TextField';
import {draftFrom, readDraft, WorkplaceFields, type WorkplaceDraft} from '@/components/workplace/WorkplaceFields';
import {useDeviceStore} from '@/hooks/use-device-store';
import {useLoader} from '@/hooks/use-loader';
import {useOrigin} from '@/hooks/use-origin';
import {useRpcErrorMessage} from '@/i18n/errors';
import {useFormatClock, useFormatMoney} from '@/i18n/format';
import {useRouter} from '@/i18n/navigation';
import {
  addInvite,
  deleteWorkplace,
  getWorkplaceAsClient,
  removeProvider,
  updateWorkplace,
  type ClientWorkplace,
  type Provider,
} from '@/lib/api';
import {forgetWorkplace, updateStoredWorkplaceName} from '@/lib/device-store';
import {buildClientUrl, buildInviteUrl, buildWhatsAppUrl} from '@/lib/share-links';
import {SummariesSection} from './SummariesSection';

export type ActionRunner = (key: string, action: () => Promise<unknown>) => Promise<boolean>;

/** /w/<slug>: everything the client does, on one screen. */
export function WorkplaceScreen({slug}: {slug: string}) {
  const t = useTranslations('Workplace');
  const common = useTranslations('Common');
  const store = useDeviceStore();

  if (store === null) return <StatusScreen message={common('loading')} />;
  const clientToken = store.workplaces[slug]?.clientToken;
  if (!clientToken) return <StatusScreen isError message={t('noClientToken')} />;
  return <WorkplacePanel slug={slug} clientToken={clientToken} />;
}

function WorkplacePanel({slug, clientToken}: {slug: string; clientToken: string}) {
  const t = useTranslations('Workplace');
  const common = useTranslations('Common');
  const rpcErrorMessage = useRpcErrorMessage();
  const formatMoney = useFormatMoney();
  const origin = useOrigin();
  const router = useRouter();
  const {data: workplace, error, isLoading, refresh} = useLoader(`${slug}:${clientToken}`, () => getWorkplaceAsClient(slug, clientToken));

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{key: string; message: string} | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (workplace) {
      updateStoredWorkplaceName(slug, workplace.name);
      document.title = `${workplace.name} · Adsum`;
    }
  }, [workplace, slug]);

  if (isLoading) return <StatusScreen message={common('loading')} />;
  if (!workplace) return <StatusScreen isError message={rpcErrorMessage(error)} />;

  // Runs one change, shows its error next to the section that started it, then reloads.
  const run: ActionRunner = async (key, action) => {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
      await refresh();
      return true;
    } catch (failure) {
      setActionError({key, message: rpcErrorMessage(failure)});
      return false;
    } finally {
      setBusyKey(null);
    }
  };
  const errorFor = (key: string) => (actionError?.key === key ? actionError.message : null);

  const clientUrl = origin ? buildClientUrl(origin, slug, clientToken) : '';
  const rate =
    workplace.rateAmount === null
      ? t('noRate')
      : t('rate', {amount: formatMoney(workplace.rateAmount, workplace.currency), unit: workplace.rateUnit});

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm', {name: workplace!.name}))) return;
    // Not through run(): there is nothing to reload afterwards.
    setBusyKey('delete');
    setActionError(null);
    try {
      await deleteWorkplace(slug, clientToken);
      forgetWorkplace(slug);
      router.replace('/');
    } catch (failure) {
      setActionError({key: 'delete', message: rpcErrorMessage(failure)});
      setBusyKey(null);
    }
  }

  return (
    <main className={screen.screen}>
      <AppHeader />

      <section className={screen.stack}>
        <div className={blocks.split}>
          <h1 className={blocks.title}>{workplace.name}</h1>
          <ActionMenu
            label={t('menu')}
            items={[
              {key: 'edit', label: t('edit'), onSelect: () => setIsEditing(true)},
              {key: 'delete', label: t('delete'), onSelect: () => void handleDelete(), isDanger: true},
            ]}
          />
        </div>
        <p className={blocks.lead}>
          {rate}
          {workplace.wantsDailyNotice && ` · ${t('wantsDailyNotice')}`}
        </p>
        {errorFor('delete') && <p className={screen.formError}>{errorFor('delete')}</p>}
      </section>

      {isEditing && (
        <EditWorkplace
          workplace={workplace}
          error={errorFor('edit')}
          isSaving={busyKey === 'edit'}
          onCancel={() => setIsEditing(false)}
          onSave={async (values) => {
            const isDone = await run('edit', () => updateWorkplace(slug, clientToken, values));
            if (isDone) setIsEditing(false);
          }}
        />
      )}

      <TodaySection workplace={workplace} />

      <ProvidersSection
        workplace={workplace}
        origin={origin}
        busyKey={busyKey}
        errorFor={errorFor}
        onAdd={(name) => run('add', () => addInvite(slug, clientToken, name))}
        onRemove={(provider) => {
          const question = provider.status === 'invited' ? t('cancelInviteConfirm', {name: provider.name}) : t('removeConfirm', {name: provider.name});
          if (window.confirm(question)) void run(`remove:${provider.id}`, () => removeProvider(slug, clientToken, provider.id));
        }}
      />

      <SummariesSection workplace={workplace} slug={slug} clientToken={clientToken} run={run} busyKey={busyKey} errorFor={errorFor} />

      <section className={screen.section}>
        <h2 className={screen.sectionTitle}>{t('adminLinkTitle')}</h2>
        <p className={screen.sectionHint}>{t('adminLinkHint')}</p>
        {clientUrl && (
          <div className={screen.row}>
            <CopyButton text={clientUrl} label={t('copyAdminLink')} variant="secondary" />
            <a
              className={buttonClassName({variant: 'ghost'})}
              href={buildWhatsAppUrl(t('adminLinkMessage', {name: workplace.name, url: clientUrl}))}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('sendAdminLinkToMe')}
            </a>
          </div>
        )}
      </section>

      <footer className={screen.footer}>
        <p className={blocks.notice}>{common('notTimeClock')}</p>
        <LegalLinks />
      </footer>
    </main>
  );
}

function EditWorkplace({
  workplace,
  error,
  isSaving,
  onCancel,
  onSave,
}: {
  workplace: ClientWorkplace;
  error: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (values: {name: string; rateAmount: number | null; rateUnit: ClientWorkplace['rateUnit']; wantsDailyNotice: boolean}) => void;
}) {
  const t = useTranslations('Workplace');
  const form = useTranslations('WorkplaceForm');
  const common = useTranslations('Common');
  const locale = useLocale();
  const [draft, setDraft] = useState<WorkplaceDraft>(() => draftFrom(workplace, locale));
  const [nameError, setNameError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values = readDraft(draft);
    setNameError(values.name ? null : form('nameRequired'));
    if (values.name) onSave({...values, name: values.name});
  }

  return (
    <Card variant="large">
      <form className={screen.stack} onSubmit={handleSubmit} noValidate>
        <h2 className={screen.sectionTitle}>{t('edit')}</h2>
        <WorkplaceFields draft={draft} onChange={setDraft} nameError={nameError} />
        <p className={blocks.muted}>{t('editHint')}</p>
        {error && <p className={screen.formError}>{error}</p>}
        <div className={blocks.choice}>
          <Button variant="secondary" onClick={onCancel}>
            {common('cancel')}
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {common('save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** "Hoje": arrival and leaving notices of the people who chose to share them. Only today's exist. */
function TodaySection({workplace}: {workplace: ClientWorkplace}) {
  const t = useTranslations('Workplace');
  const formatClock = useFormatClock();
  const sharing = workplace.providers.filter((provider) => provider.status === 'active' && provider.sharesDailyNotice);
  if (!workplace.wantsDailyNotice && sharing.length === 0) return null;

  return (
    <section className={screen.section}>
      <h2 className={screen.sectionTitle}>{t('todayTitle')}</h2>
      {sharing.length === 0 ? (
        <p className={screen.sectionHint}>{t('todayEmpty')}</p>
      ) : (
        <Card variant="flush">
          <ul className={blocks.list}>
            {sharing.map((provider) => {
              const arrived = provider.todayNotices.find((notice) => notice.kind === 'check_in');
              const left = [...provider.todayNotices].reverse().find((notice) => notice.kind === 'check_out');
              return (
                <li key={provider.id} className={blocks.listItem}>
                  <span className={blocks.listMain}>
                    <span className={blocks.listTitle}>{provider.name}</span>
                    <span className={blocks.muted}>
                      {arrived ? t('arrivedAt', {time: formatClock(arrived.occurredAt)}) : t('notArrived')}
                      {left && ` · ${t('leftAt', {time: formatClock(left.occurredAt)})}`}
                    </span>
                  </span>
                  {arrived && !left && <Tag tone="brand">{t('here')}</Tag>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className={blocks.muted}>{t('todayHint')}</p>
    </section>
  );
}

function ProvidersSection({
  workplace,
  origin,
  busyKey,
  errorFor,
  onAdd,
  onRemove,
}: {
  workplace: ClientWorkplace;
  origin: string;
  busyKey: string | null;
  errorFor: (key: string) => string | null;
  onAdd: (name: string) => Promise<boolean>;
  onRemove: (provider: Provider) => void;
}) {
  const t = useTranslations('Workplace');
  const [name, setName] = useState('');

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return;
    if (await onAdd(clean)) setName('');
  }

  const visible = workplace.providers.filter((provider) => provider.status !== 'declined');
  const declined = workplace.providers.filter((provider) => provider.status === 'declined');

  return (
    <section className={screen.section}>
      <h2 className={screen.sectionTitle}>{t('peopleTitle')}</h2>
      <p className={screen.sectionHint}>{t('peopleHint')}</p>

      {visible.length > 0 && (
        <Card variant="flush">
          <ul className={blocks.list}>
            {visible.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                workplaceName={workplace.name}
                origin={origin}
                slug={workplace.slug}
                onRemove={() => onRemove(provider)}
                isBusy={busyKey === `remove:${provider.id}`}
                error={errorFor(`remove:${provider.id}`)}
              />
            ))}
          </ul>
        </Card>
      )}

      {declined.length > 0 && (
        <p className={blocks.muted}>{t('declinedList', {names: declined.map((provider) => provider.name).join(', ')})}</p>
      )}

      <form className={screen.stack} onSubmit={handleAdd}>
        <TextField
          label={t('inviteName')}
          hint={t('inviteNameHint')}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          error={errorFor('add')}
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" isLoading={busyKey === 'add'} disabled={!name.trim()}>
          {t('createInvite')}
        </Button>
      </form>
    </section>
  );
}

function ProviderRow({
  provider,
  workplaceName,
  origin,
  slug,
  onRemove,
  isBusy,
  error,
}: {
  provider: Provider;
  workplaceName: string;
  origin: string;
  slug: string;
  onRemove: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  const t = useTranslations('Workplace');
  const inviteUrl = provider.inviteToken && origin ? buildInviteUrl(origin, slug, provider.inviteToken) : '';
  const tone = provider.status === 'active' ? 'brand' : provider.status === 'stopped' ? 'ember' : 'neutral';

  return (
    <li className={blocks.listItem} style={{flexWrap: 'wrap'}}>
      <span className={blocks.listMain}>
        <span className={blocks.listTitle}>{provider.name}</span>
        <span className={blocks.muted}>
          {provider.status === 'active' &&
            (provider.sharesDailyNotice ? t('sharesDailyNotice') : t('sharesSummaryOnly'))}
          {provider.status === 'invited' && t('invitePending')}
          {provider.status === 'stopped' && t('stoppedHint')}
        </span>
        {error && <span className={screen.formError}>{error}</span>}
      </span>
      <Tag tone={tone}>{t('status', {status: provider.status})}</Tag>
      <ActionMenu
        label={t('personMenu', {name: provider.name})}
        items={[
          {
            key: 'remove',
            label: provider.status === 'invited' ? t('cancelInvite') : t('remove'),
            onSelect: onRemove,
            isDanger: true,
          },
        ]}
      />
      {inviteUrl && (
        <div className={screen.row} style={{width: '100%'}}>
          <a
            className={buttonClassName({variant: 'primary'})}
            href={buildWhatsAppUrl(t('inviteMessage', {name: provider.name, workplace: workplaceName, url: inviteUrl}))}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={isBusy || undefined}
          >
            {t('sendInvite')}
          </a>
          <CopyButton text={inviteUrl} label={t('copyInvite')} variant="ghost" />
        </div>
      )}
    </li>
  );
}
