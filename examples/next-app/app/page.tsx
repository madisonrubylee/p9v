import Link from "next/link";
import { Page } from "./components/ui";

export default function Home() {
  return (
    <Page heading="p9v demo">
      <p style={{ opacity: 0.7, lineHeight: 1.7 }}>
        The same profile screen, built two ways. Both fetch a user, their stats,
        and their posts (each endpoint delayed 400ms).
      </p>
      <ul style={{ lineHeight: 2.2, fontSize: 18 }}>
        <li>
          <Link href="/vanilla/u1">/vanilla/u1</Link> — nested component
          waterfall (sequential)
        </li>
        <li>
          <Link href="/p9v/u1">/p9v/u1</Link> — strict blocking prefetch
        </li>
        <li>
          <Link href="/p9v-streaming/u1">/p9v-streaming/u1</Link> — basic API
          with Suspense streaming
        </li>
        <li>
          <Link href="/client-waterfall/u1">/client-waterfall/u1</Link> —
          browser React Query waterfall for the DevTools panel
        </li>
      </ul>
      <p style={{ opacity: 0.6 }}>
        Run <code>node bench-core.mjs</code> to compare nested, manual TanStack,
        and p9v prefetching.
      </p>
    </Page>
  );
}
