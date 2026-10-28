export type DomainType = 'kubernetes' | 'aws';

export type Severity = 'P1 - Critical' | 'P2 - High' | 'P3 - Medium' | 'P4 - Low';

export type CommandRisk = 'Safe / Read-Only' | 'State-Modifying' | 'Destructive';

export interface IncidentInput {
  domain: DomainType;
  title: string;
  severity: Severity;
  component: string;
  problemType: string;
  symptoms: string;
  evidence: string;
}

export interface IncidentTemplate {
  id: string;
  name: string;
  domain: DomainType;
  severity: Severity;
  component: string;
  problemType: string;
  title: string;
  symptoms: string;
  evidence: string;
  summary: string;
}

export interface DiagnosticCommand {
  cmd: string;
  purpose: string;
  risk: CommandRisk;
}

export interface RootCauseItem {
  cause: string;
  probability: number; // 0 to 100
  rationale: string;
}

export interface RemediationStep {
  step: number;
  action: string;
  details: string;
  command?: string;
}

export interface TriageRunbook {
  title: string;
  domain: DomainType;
  severity: Severity;
  blastRadius: string;
  executiveSummary: string;
  rootCauses: RootCauseItem[];
  diagnostics: DiagnosticCommand[];
  remediationSteps: RemediationStep[];
  prevention: {
    alerts: string[];
    architecturalFix: string;
  };
  rawMarkdown: string;
  isSimulated: boolean;
}
