export const KINDS = ["Live cohort", "Pre-recorded bootcamp", "Self-paced upgrade"] as const;
export const STATUSES = ["active", "archived"] as const;

/** All dates are India dates, YYYY-MM-DD. A missing date means "not set". */
export const DATE_FIELDS = ["launch", "start", "ic_close", "standard_from", "enrol_close", "waitlist_live"] as const;
/** India price in rupees; HER and LER prices in US dollars. */
export const NUMBER_FIELDS = ["ic_price", "standard_price", "her_ic", "her_std", "ler_ic", "ler_std"] as const;
export const URL_FIELDS = [
  "home_beta", "home_url", "waitlist_beta", "waitlist_url",
  "native_beta", "native_url", "dark_beta", "dark_url",
] as const;
export const TEXT_FIELDS = ["program", "poc", "pm"] as const;

export type Kind = (typeof KINDS)[number];
export type Status = (typeof STATUSES)[number];

export type Cohort = {
  id: string;
  name: string;
  kind: Kind;
  status: Status;
  no_waitlist: boolean;
} & { [K in (typeof TEXT_FIELDS)[number]]?: string } & {
  [K in (typeof DATE_FIELDS)[number]]?: string;
} & { [K in (typeof NUMBER_FIELDS)[number]]?: number } & {
  [K in (typeof URL_FIELDS)[number]]?: string;
};

export type CohortErrors = Partial<Record<keyof Cohort, string>>;
