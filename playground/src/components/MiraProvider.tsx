// src/components/MiraProvider.tsx
'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '../lib/mira';

function MiraAnalytics() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Track page views
    useEffect(() => {
        trackPageView(null, {
            path: pathname,
            url: window.location.href
        });
    }, [pathname, searchParams]);

    return null;
}

export function MiraProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Suspense fallback={null}>
                <MiraAnalytics />
            </Suspense>
            {children}
        </>
    );
}