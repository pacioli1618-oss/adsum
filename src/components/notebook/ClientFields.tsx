'use client';

import {useLocale, useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {SelectField} from '@/components/ui/SelectField';
import {TextField} from '@/components/ui/TextField';
import {amountToInput} from '@/lib/amount';
import type {RateUnit} from '@/lib/notebook';

export type ClientDraft = {name: string; rateText: string; rateUnit: RateUnit};

/** Name and rate of a client in the notebook. */
export function ClientFields({draft, onChange, nameError}: {draft: ClientDraft; onChange: (draft: ClientDraft) => void; nameError?: string | null}) {
  const t = useTranslations('ClientForm');
  const locale = useLocale();
  const set = (patch: Partial<ClientDraft>) => onChange({...draft, ...patch});

  return (
    <div className={screen.stack}>
      <TextField
        label={t('name')}
        hint={t('nameHint')}
        value={draft.name}
        maxLength={80}
        onChange={(event) => set({name: event.target.value})}
        error={nameError}
        autoComplete="off"
      />
      <div className={blocks.timeRow}>
        <TextField
          label={t('rate')}
          value={draft.rateText}
          inputMode="decimal"
          placeholder={amountToInput(150, locale)}
          onChange={(event) => set({rateText: event.target.value})}
        />
        <SelectField
          label={t('rateUnit')}
          value={draft.rateUnit}
          onChange={(event) => set({rateUnit: event.target.value as RateUnit})}
          options={[
            {value: 'day', label: t('perDay')},
            {value: 'hour', label: t('perHour')},
          ]}
        />
      </div>
    </div>
  );
}
