import type { PracticeScenario } from '../../../types/practice';

type CaseContent = Omit<PracticeScenario, 'version' | 'brief' | 'diagnostics' | 'hypotheses' | 'requiredDiagnosticIds' | 'estimatedMinutes'> & {
  context: string;
  checks: [id: string, label: string, command: string, output: string, explanation: string][];
  choices: [id: string, label: string, feedback: string][];
};

// Authored fixtures only: commands and outputs are never executed by this builder.
export const defineCase = ({ context, checks, choices, ...content }: CaseContent): PracticeScenario => ({
  ...content,
  version: 1,
  estimatedMinutes: 8,
  brief: `Synthetic practice case. All diagnostic outputs are simulated excerpts; no command executes. ${context}`,
  diagnostics: checks.map(([id, label, command, output, explanation]) => ({ id, label, command, output, explanation })),
  hypotheses: choices.map(([id, label, feedback]) => ({ id, label, feedback })),
  requiredDiagnosticIds: checks.map(([id]) => id),
});
