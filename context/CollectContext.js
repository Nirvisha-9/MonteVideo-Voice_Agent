import React, { createContext, useContext } from 'react';

export const CollectContext = createContext(null);

export function useCollectContext() {
    const ctx = useContext(CollectContext);
    if (!ctx) {
        throw new Error('useCollectContext must be used within CollectProvider');
    }
    return ctx;
}
