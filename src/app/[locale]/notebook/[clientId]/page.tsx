import {Suspense} from 'react';
import {ClientScreen} from './ClientScreen';

// /notebook/[clientId] · One client's month: calendar, edit a day, sharing settings.
export default function Page({params}: PageProps<'/[locale]/notebook/[clientId]'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/notebook/[clientId]'>['params']}) {
  const {clientId} = await params;
  return <ClientScreen clientId={clientId} />;
}
