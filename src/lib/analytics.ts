import posthog from 'posthog-js';

export const ANALYTICS_EVENTS = {
	AUTH_SIGN_IN: 'auth_sign_in',
	AUTH_SIGN_UP: 'auth_sign_up',
	AUTH_SIGN_OUT: 'auth_sign_out',
	AUTH_SUBMIT_CLICKED: 'auth_submit_clicked',
	AUTH_GOOGLE_SIGN_IN_CLICKED: 'auth_google_sign_in_clicked',
	AUTH_SESSION_CHANGE: 'auth_session_change',

	CHECKOUT_INITIATED: 'checkout_initiated',
	CHECKOUT_SUCCESS: 'checkout_success',
	CHECKOUT_CANCELED: 'checkout_canceled',

	BILLING_PORTAL_OPEN_CLICKED: 'billing_portal_open_clicked',
	BILLING_PORTAL_RETURNED: 'billing_portal_returned',

	AGENT_RUN_STARTED: 'agent_run_started',
	AGENT_RUN_UPDATED: 'agent_run_updated',
	AGENT_RUN_COMPLETED: 'agent_run_completed',
	AGENT_RUN_FAILED: 'agent_run_failed',

	JOB_SEARCH_RUN: 'job_search_run',
	RESUME_OPTIMIZATION_RUN: 'resume_optimization_run',
	COVER_LETTER_RUN: 'cover_letter_run',
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;

export function track(eventName: AnalyticsEventName, properties?: Record<string, any>) {
	posthog.capture(ANALYTICS_EVENTS[eventName], properties);
}

export function identify(userId: string, properties?: Record<string, any>) {
	posthog.identify(userId, properties);
}

export function reset() {
	posthog.reset();
}
