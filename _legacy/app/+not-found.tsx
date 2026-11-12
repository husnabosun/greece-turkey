import { Redirect } from 'expo-router';

/** A wrong link goes back to the start (the landing page on the web, the farmer app on a phone). */
export default function NotFound() {
  return <Redirect href="/" />;
}
