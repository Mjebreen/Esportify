import type { WorkflowType } from '@prisma/client';

/**
 * Approver roles resolved by the engine:
 *  - TEAM_MANAGER    → the manager of the subject's roster
 *  - ESPORTS_MANAGER → any user with the Leadership role (the approver above team managers)
 * Executor roles are SystemRole names (MERCH, AVIATION, MARCOM, FINANCE, IT, …).
 */
export type StepRole = 'TEAM_MANAGER' | 'ESPORTS_MANAGER';

export interface WorkflowConfig {
  label: string;
  /** Approval steps, in order. Empty = no approval (straight to executor). */
  approverChain: StepRole[];
  /** SystemRole that executes once approved (null = terminal at approval). */
  executorRole: string | null;
}

export const WORKFLOW_CONFIG: Record<WorkflowType, WorkflowConfig> = {
  MERCH_KIT: { label: 'Kit request', approverChain: ['TEAM_MANAGER'], executorRole: 'MERCH' },
  TRAVEL: { label: 'Travel request', approverChain: ['ESPORTS_MANAGER'], executorRole: 'AVIATION' },
  PHOTO: { label: 'Photography request', approverChain: ['ESPORTS_MANAGER'], executorRole: 'MARCOM' },
  // Terminal at Esports Manager approval: an approved adjustment feeds the monthly
  // payroll total Finance sees — there is no per-line Finance execute step.
  SALARY_ADJUSTMENT: { label: 'Salary adjustment', approverChain: ['ESPORTS_MANAGER'], executorRole: null },
  REQUEST: { label: 'Request', approverChain: ['TEAM_MANAGER'], executorRole: null },
};
