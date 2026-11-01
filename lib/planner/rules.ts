import type { Kind } from "./types.ts";

/** A date on the cohort that a step is counted from. */
export type Anchor = "launch" | "waitlist" | "standard" | "close" | "start" | "started";

export type Step = {
  /** Stable id. Task keys are `<cohort id>:<step id>`, so never rename one in use. */
  id: string;
  page: string;
  label: string;
  anchor: Anchor;
  /** Days from the anchor. Negative is before. */
  offset: number;
  /** A go-live step keeps its date even on a day off. */
  goLive: boolean;
  /** Placeholders: {cohort} {pm} {poc} {ic} {std} {next} {launch} {start} {ic_close} {std_from} {close} */
  text: string;
  /** Whose name goes on the task. Empty means no owner. */
  owner: "poc" | "pm" | "";
};

export type Rules = Record<Kind, Step[]>;

const s = (
  id: string, page: string, label: string, anchor: Anchor, offset: number,
  text: string, owner: Step["owner"] = "poc", goLive = false,
): Step => ({ id, page, label, anchor, offset, goLive, text, owner });

const waitlist = [
  s("waitlist-request", "Waitlist LP", "Request", "waitlist", -6, "Request the {cohort} waitlist page"),
  s("waitlist-beta", "Waitlist LP", "Beta", "waitlist", -2, "Check the {cohort} waitlist page on beta"),
  s("waitlist-live", "Waitlist LP", "Live", "waitlist", 0, "Publish the {cohort} waitlist page", "poc", true),
];

const lp = (id: string, page: string, withSeo: boolean): Step[] => [
  s(`${id}-request`, page, "Request", "launch", -9,
    `Request the {cohort} ${page}. Inner circle price {ic}, standard price {std}, classes start {start}`),
  s(`${id}-build`, page, "Build done", "launch", -3, `The {cohort} ${page} build is done`),
  s(`${id}-beta`, page, "Beta", "launch", -1, `Review the {cohort} ${page} on beta`),
  ...(withSeo ? [s(`${id}-seo`, page, "SEO metadata", "launch", -1, `Add SEO metadata to the {cohort} ${page}`)] : []),
  s(`${id}-live`, page, "Live", "launch", 0, `Publish the {cohort} ${page}. Enrolments open`, "poc", true),
];

const standardPricing = [
  s("standard-request", "Standard pricing", "Request", "standard", -2, "Request the standard price change for {cohort}: {std}"),
  s("standard-beta", "Standard pricing", "Beta", "standard", -1, "Check the {cohort} standard price on beta"),
  s("standard-live", "Standard pricing", "Live", "standard", 0,
    "Publish the {cohort} standard price {std}, from {std_from}", "poc", true),
];

const enrolmentClose = [
  s("close-confirm", "Enrolment close", "Confirm", "close", -3, "Confirm that {cohort} enrolment closes on {close}"),
  s("close-beta", "Enrolment close", "Beta", "close", -2, "Check the {cohort} enrolment close on beta"),
  s("close-live", "Enrolment close", "Live", "close", 0, "Close {cohort} enrolment on the website", "poc", true),
];

/**
 * The default steps for each kind of cohort. Offsets, texts and owners are
 * starting values. Later they can be replaced from settings without code changes.
 */
export const DEFAULT_RULES: Rules = {
  "Live cohort": [
    ...waitlist,
    ...lp("dark", "Dark LP", true),
    ...lp("native", "Native LP", false),
    s("onboarding-channels", "Onboarding", "Channels", "launch", -3, "Set up the onboarding channels for {cohort}", "pm"),
    s("onboarding-admin", "Onboarding", "Admin panel", "launch", -1, "Set up the {cohort} admin panel", "pm"),
    s("tools-send", "Tools 1-pager", "Send", "launch", -1, "Send the tools 1-pager to {cohort} learners", "pm"),
    s("started-live", "Classes start", "Live", "started", 0,
      "Show {cohort} as started on the website. Classes began {start}", "poc", true),
    ...standardPricing,
    ...enrolmentClose,
  ],
  "Pre-recorded bootcamp": [
    ...lp("dark", "Dark LP", true),
    ...lp("native", "Native LP", false),
    ...standardPricing,
  ],
  "Self-paced upgrade": [
    s("upgrade-request", "Upgrade LP", "Request", "launch", -9,
      "Request the {cohort} Upgrade LP. Price {std}, classes start {start}"),
    s("upgrade-build", "Upgrade LP", "Build done", "launch", -3, "The {cohort} Upgrade LP build is done"),
    s("upgrade-beta", "Upgrade LP", "Beta", "launch", -1, "Review the {cohort} Upgrade LP on beta"),
    s("upgrade-live", "Upgrade LP", "Live", "launch", 0, "Publish the {cohort} Upgrade LP. Enrolments open", "poc", true),
    s("close-request", "Enrolment close", "Request", "close", -2, "Request the {cohort} enrolment close for {close}"),
    s("close-beta", "Enrolment close", "Beta", "close", -1, "Check the {cohort} enrolment close on beta"),
    s("close-live", "Enrolment close", "Live", "close", 0, "Close {cohort} enrolment on the website", "poc", true),
  ],
};
