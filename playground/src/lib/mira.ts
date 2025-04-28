import { MiraAnalytics } from 'mira-data-stream';

// Initialize with singleton pattern
let miraInstance: MiraAnalytics | null = null;

export const getMira = () => {
    if (!miraInstance && typeof window !== 'undefined') {
        const anonymousId = localStorage.getItem('mira_anonymous_id') ||
            crypto.randomUUID();
        localStorage.setItem('mira_anonymous_id', anonymousId);

        miraInstance = new MiraAnalytics({
            apiUrl: process.env.NEXT_PUBLIC_MIRA_API_URL,
            writeKey: process.env.NEXT_PUBLIC_MIRA_WRITE_KEY,
            anonymousId
        });
    }
    return miraInstance;
};

// Helper methods
export const trackEvent = (eventName: string, properties = {}) => {
    getMira()?.track(eventName, properties);
};

export const trackPageView = (name = null, properties = {}) => {
    getMira()?.page(name, properties);
};

export const identifyUser = (userId: string, traits = {}) => {
    getMira()?.identify(userId, traits);
};