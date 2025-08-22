import { MiraAnalytics } from '@mira-network/mira-data-stream';

// Initialize with singleton pattern
let miraInstance: MiraAnalytics | null = null;

// Fallback UUID generator for insecure contexts
const generateUUID = (): string => {
    // Check if crypto.randomUUID is available (secure context)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback: Generate UUID v4 manually
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const getMira = () => {
    if (!miraInstance && typeof window !== 'undefined') {
        const anonymousId = localStorage.getItem('mira_anonymous_id') || generateUUID();
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