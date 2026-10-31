import { Redirect } from 'expo-router';

/** iOS and Android: the app opens straight into the farmer Home. The landing page is web only (index.web.tsx). */
export default function Index() {
  return <Redirect href="/farmer" />;
}
