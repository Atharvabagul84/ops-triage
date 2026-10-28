export interface PracticeDiagnostic {
  id: string;
  label: string;
  command: string;
  output: string;
  explanation: string;
}

export interface PracticeScenario {
  id: string;
  version: number;
  variantOf?: string;
  hints: string[];
  title: string;
  summary: string;
  difficulty: 'Beginner' | 'Intermediate';
  estimatedMinutes: number;
  brief: string;
  initialEvidence: string;
  diagnostics: PracticeDiagnostic[];
  hypotheses: { id: string; label: string; feedback: string }[];
  correctHypothesisId: string;
  requiredDiagnosticIds: string[];
  debrief: {
    cause: string;
    evidence: string[];
    counterEvidence: string[];
    remediation: string[];
    verification: string[];
    lesson: string;
  };
  sources: { title: string; url: string }[];
}

export interface PracticeAttemptInput {
  hypothesisId: string | null;
  diagnosticIds: string[];
  citedDiagnosticIds: string[];
  reasoning: string;
}

export interface PracticeSubmission extends PracticeAttemptInput {
  submittedAt: string;
}

export interface PracticeAttempt extends PracticeAttemptInput {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
  hintCount: number;
  submissions: PracticeSubmission[];
}

export interface PracticeNotebook {
  version: 2;
  attempts: PracticeAttempt[];
}

export interface PracticeEvaluation {
  correct: boolean;
  hasRequiredEvidence: boolean;
  hasCitedEvidence: boolean;
  hasReasoning: boolean;
  complete: boolean;
  checks: { label: string; passed: boolean }[];
  feedback: string;
}

export interface PracticeImportResult {
  notebook: PracticeNotebook;
  importedCount: number;
  skippedCount: number;
  error?: string;
}
