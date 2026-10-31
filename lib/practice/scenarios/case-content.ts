import type { PracticeScenario } from '../../../types/practice';

type CaseContent = Omit<PracticeScenario, 'version' | 'brief' | 'diagnostics' | 'hypotheses' | 'requiredDiagnosticIds' | 'estimatedMinutes'> & {
  context: string;
  checks: [id: string, label: string, command: string, output: string, explanation: string][];
  choices: [id: string, label: string, feedback: string][];
};

// Lab-backed cases quote labs/<id>/capture.json; tests/labs.test.mjs keeps them in sync.
export const labCapture = (id: string): NonNullable<PracticeScenario['lab']> => ({ path: `labs/${id}`, kubernetesVersion: 'v1.36.4' });
export const briefIntro = (lab?: PracticeScenario['lab']): string => lab
  ? `Synthetic practice case reproduced on a disposable kind cluster (${lab.path}, Kubernetes ${lab.kubernetesVersion}). Diagnostic outputs are excerpts of real captured kubectl output; no command runs from this page.`
  : 'Synthetic practice case. All diagnostic outputs are simulated excerpts; no command executes.';

// Commands and outputs are never executed by this builder.
export const defineCase = ({ context, checks, choices, ...content }: CaseContent): PracticeScenario => ({
  ...content,
  version: 1,
  estimatedMinutes: 8,
  brief: `${briefIntro(content.lab)} ${context}`,
  diagnostics: checks.map(([id, label, command, output, explanation]) => ({ id, label, command, output, explanation })),
  hypotheses: choices.map(([id, label, feedback]) => ({ id, label, feedback })),
  requiredDiagnosticIds: checks.map(([id]) => id),
});
