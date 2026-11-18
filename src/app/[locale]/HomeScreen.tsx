'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import {ChevronRight} from '@/components/layout/ChevronRight';
import screen from '@/components/layout/Screen.module.css';
import {Card} from '@/components/ui/Card';
import {useDeviceStore} from '@/hooks/use-device-store';
import {Link} from '@/i18n/navigation';
import {listWorkplaces} from '@/lib/device-store';
import {WorkplaceForm} from './WorkplaceForm';

/** The two doors of the home page, plus the workplaces already managed on this device. */
export function HomeScreen() {
  const t = useTranslations('Home');
  const store = useDeviceStore();
  const [isCreating, setIsCreating] = useState(false);
  const workplaces = store ? listWorkplaces(store) : [];
  const clientCount = store?.clients.length ?? 0;

  return (
    <>
      {workplaces.length > 0 && (
        <section className={screen.section}>
          <h2 className={screen.sectionTitle}>{t('myWorkplaces')}</h2>
          <Card variant="flush">
            <ul className={blocks.list}>
              {workplaces.map((workplace) => (
                <li key={workplace.slug}>
                  <Link href={`/w/${workplace.slug}`} className={`${blocks.listItem} ${blocks.listLink}`}>
                    <span className={blocks.listMain}>
                      <span className={blocks.listTitle}>{workplace.name}</span>
                    </span>
                    <ChevronRight />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section className={blocks.paths} aria-label={t('pathsLabel')}>
        <button type="button" className={blocks.path} aria-pressed={isCreating} onClick={() => setIsCreating((value) => !value)}>
          <span className={blocks.pathTitle}>{t('clientPath')}</span>
          <span className={blocks.pathHint}>{t('clientPathHint')}</span>
        </button>
        {isCreating && <WorkplaceForm />}
        <Link href="/notebook" className={blocks.path}>
          <span className={blocks.pathTitle}>{t('providerPath')}</span>
          <span className={blocks.pathHint}>
            {clientCount > 0 ? t('providerPathOpen', {count: clientCount}) : t('providerPathHint')}
          </span>
        </Link>
      </section>
    </>
  );
}
