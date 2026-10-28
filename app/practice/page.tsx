import type { Metadata } from 'next';
import { PracticeWorkbench } from '@/components/practice/PracticeWorkbench';

export const metadata: Metadata = {
  title: 'Guided Practice | OpsTriage',
  description: 'Practice Kubernetes incident investigation with simulated evidence, guided diagnostics, and a personal learning notebook.',
};

export default function PracticePage() {
  return <PracticeWorkbench />;
}
