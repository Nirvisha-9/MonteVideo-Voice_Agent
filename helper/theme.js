export const COLORS = {
    // Primary green tones for ecology/recycling
    primary: '#10B981',       // Emerald 500
    primaryLight: '#34D399',  // Emerald 400
    primaryDark: '#059669',   // Emerald 600
    primaryBg: '#ECFDF5',     // Emerald 50
    
    // Secondary navy/blue colors for structured UI
    secondary: '#3B54A5',     // Current main brand blue
    secondaryLight: '#5C74C4',
    secondaryDark: '#2C3E82',
    
    // Status/Utility Colors
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',

    // Grayscale
    white: '#FFFFFF',
    bgLight: '#F8FAFC',       // Slate 50
    bgCard: '#FFFFFF',
    borderLight: 'rgba(255, 255, 255, 0.25)',
    borderDark: 'rgba(0, 0, 0, 0.08)',
    
    // Text levels
    textDark: '#0F172A',      // Slate 900
    textMedium: '#334155',    // Slate 700
    textLight: '#64748B',     // Slate 500
    textWhite: '#FFFFFF',
    
    // Opaque card backgrounds for layering on images
    glassLight: 'rgba(255, 255, 255, 0.90)',
    glassMedium: 'rgba(255, 255, 255, 0.70)',
    glassDark: 'rgba(15, 23, 42, 0.75)',
    overlayDark: 'rgba(0, 0, 0, 0.35)',
};

export const SHADOWS = {
    light: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    medium: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    heavy: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    }
};

export const BORDER_RADIUS = {
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 24,
    round: 9999,
};
