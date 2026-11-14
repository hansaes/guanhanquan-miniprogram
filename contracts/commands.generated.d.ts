// Generated from architecture-v1.json by npm run contracts. Do not edit by hand.

export interface ReviewJobInput {
  pass: boolean;
  expectedVersion: number;
  reason?: string;
}

export interface PaidCommandInput {
  idempotencyKey: string;
}

export interface ApplyJobInput {
  coverLetter?: string;
}
