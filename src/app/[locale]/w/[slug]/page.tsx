import {Suspense} from 'react';
import {WorkplaceScreen} from './WorkplaceScreen';

// /w/[slug] · The client's panel: people, today's notices, month summaries. Needs the client
// token saved on this device (/w/[slug]/manage puts it there).
export default function Page({params}: PageProps<'/[locale]/w/[slug]'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/w/[slug]'>['params']}) {
  const {slug} = await params;
  return <WorkplaceScreen slug={slug} />;
}
