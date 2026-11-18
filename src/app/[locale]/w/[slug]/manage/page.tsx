import {Suspense} from 'react';
import {ManageScreen} from './ManageScreen';

// /w/[slug]/manage · #<clientToken> · Opening the client link on any device makes it a client device.
export default function Page({params}: PageProps<'/[locale]/w/[slug]/manage'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/w/[slug]/manage'>['params']}) {
  const {slug} = await params;
  return <ManageScreen slug={slug} />;
}
