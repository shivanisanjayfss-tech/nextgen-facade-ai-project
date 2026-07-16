/** Default monthly cron: 02:00 on the 1st of every month (UTC / server time). */
export const IMPORT_SCHEDULER_CRON_EXPRESSION = "0 2 1 * *";

export const IMPORT_SCHEDULER_FREQUENCY = "monthly" as const;

export const IMPORT_SCHEDULER_DAY_OF_MONTH = 1;

export const IMPORT_SCHEDULER_HOUR = 2;

export const IMPORT_SCHEDULER_TIMEZONE = "UTC";

/** Maximum retry attempts per manufacturer before moving to the next one. */
export const IMPORT_SCHEDULER_MAX_RETRIES = 3;

/** Single-row primary key for import_scheduler_settings. */
export const IMPORT_SCHEDULER_SETTINGS_ID = "default";
