/** A prior side effect may have committed externally and needs reconciliation. */
export class EffectRecoveryRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EffectRecoveryRequiredError';
  }
}
