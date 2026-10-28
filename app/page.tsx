import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'OpsTriage | Practice Kubernetes incident investigation',
  description: 'Explore 10 guided Kubernetes cases and 10 transfer cases. Inspect authored evidence, explain your diagnosis, and keep a personal practice notebook. Start free as a guest.',
};

export default function Home() {
  return <LandingPage />;
}
