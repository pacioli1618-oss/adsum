import {Suspense} from 'react';
import {SendScreen} from './SendScreen';

// /notebook/[clientId]/send/[month] · Review a month and send its summary to the client.
export default function Page({params}: PageProps<'/[locale]/notebook/[clientId]/send/[month]'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/notebook/[clientId]/send/[month]'>['params']}) {
  const {clientId, month} = await params;
  return <SendScreen clientId={clientId} month={month} />;
}
