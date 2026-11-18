'use client';

import {useLocale, useTranslations} from 'next-intl';
import screen from '@/components/layout/Screen.module.css';
import blocks from '@/components/layout/Blocks.module.css';
import {SelectField} from '@/components/ui/SelectField';
import {TextField} from '@/components/ui/TextField';
import {Toggle} from '@/components/ui/Toggle';
import {amountToInput, parseAmount} from '@/lib/amount';
import type {RateUnit} from '@/lib/notebook';

export type WorkplaceDraft = {
  name: string;
  rateText: string;
  rateUnit: RateUnit;
  wantsDailyNotice: boolean;
};

export function draftFrom(values: {name: string; rateAmount: number | null; rateUnit: RateUnit; wantsDailyNotice: boolean}, locale: string): WorkplaceDraft {
  return {
    name: values.name,
    rateText: amountToInput(values.rateAmount, locale),
    rateUnit: values.rateUnit,
    wantsDailyNotice: values.wantsDailyNotice,
  };
}

/** Draft → API input; null name means "fix the form first". */
export function readDraft(draft: WorkplaceDraft) {
  const name = draft.name.trim().replace(/\s+/g, ' ');
  return {
    name: name || null,
    rateAmount: parseAmount(draft.rateText),
    rateUnit: draft.rateUnit,
    wantsDailyNotice: draft.wantsDailyNotice,
  };
}

/** Name, rate and the daily-notice wish: the fields of a workplace, for creating and editing. */
export function WorkplaceFields({draft, onChange, nameError}: {draft: WorkplaceDraft; onChange: (draft: WorkplaceDraft) => void; nameError?: string | null}) {
  const t = useTranslations('WorkplaceForm');
  const locale = useLocale();
  const set = (patch: Partial<WorkplaceDraft>) => onChange({...draft, ...patch});

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
          hint={t('rateHint')}
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
      <Toggle
        checked={draft.wantsDailyNotice}
        onChange={(wantsDailyNotice) => set({wantsDailyNotice})}
        title={t('wantsDailyNotice')}
        hint={t('wantsDailyNoticeHint')}
      />
    </div>
  );
}
