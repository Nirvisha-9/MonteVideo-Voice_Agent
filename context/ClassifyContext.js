import React, { createContext, useContext } from 'react';

export const ClassifyContext = createContext(null);

export function useClassifyContext() {
    const ctx = useContext(ClassifyContext);
    if (!ctx) {
        throw new Error('useClassifyContext must be used within ClassifyProvider');
    }
    return ctx;
}
