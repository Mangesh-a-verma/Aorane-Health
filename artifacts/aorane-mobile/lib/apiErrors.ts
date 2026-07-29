export class APILimitError extends Error {
  public readonly type: "plan_limit" | "daily_limit";
  public readonly used?: number;
  public readonly limit?: number;
  public readonly requiredPlan?: string;
  public readonly feature?: string;

  constructor(
    type: "plan_limit" | "daily_limit",
    message: string,
    opts?: { used?: number; limit?: number; requiredPlan?: string; feature?: string }
  ) {
    super(message);
    this.name = "APILimitError";
    this.type = type;
    this.used = opts?.used;
    this.limit = opts?.limit;
    this.requiredPlan = opts?.requiredPlan;
    this.feature = opts?.feature;
  }
}
