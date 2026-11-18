import {Suspense} from 'react';
import {InviteScreen} from './InviteScreen';

// /w/[slug]/invite · #<inviteToken> · One person's invite: see what is shared, accept or decline.
export default function Page({params}: PageProps<'/[locale]/w/[slug]/invite'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/w/[slug]/invite'>['params']}) {
  const {slug} = await params;
  return <InviteScreen slug={slug} />;
}
