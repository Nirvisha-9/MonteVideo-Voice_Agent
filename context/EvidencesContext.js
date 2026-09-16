import React, { createContext, useContext } from 'react';

export const EvidencesContext = createContext(null);

export function useEvidencesContext() {
    const ctx = useContext(EvidencesContext);
    if (!ctx) {
        throw new Error('useEvidencesContext must be used within EvidencesProvider');
    }
    return ctx;
}
