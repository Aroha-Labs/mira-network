// src/components/MiraProvider.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '../lib/mira';

export function MiraProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Track page views
    useEffect(() => {
        trackPageView(null, {
            path: pathname,
            url: window.location.href
        });
    }, [pathname, searchParams]);

    return <>{children}</>;
}