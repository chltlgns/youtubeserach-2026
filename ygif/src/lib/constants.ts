// Country and language configuration
export const SUPPORTED_COUNTRIES = [
    { code: 'IR', name: 'Iran', language: 'fa', languageName: 'Persian (Farsi)' },
    { code: 'PK', name: 'Pakistan', language: 'ur', languageName: 'Urdu' },
    { code: 'IN', name: 'India', language: 'hi', languageName: 'Hindi' },
    { code: 'RU', name: 'Russia', language: 'ru', languageName: 'Russian' },
    { code: 'VN', name: 'Vietnam', language: 'vi', languageName: 'Vietnamese' },
    { code: 'ID', name: 'Indonesia', language: 'id', languageName: 'Indonesian' },
] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]['code'];
export type LanguageCode = (typeof SUPPORTED_COUNTRIES)[number]['language'];

// Theme configuration
export const THEMES = {
    light: {
        name: 'Light',
        icon: '☀️',
        background: '#FFFFFF',
        foreground: '#000000',
    },
    dark: {
        name: 'Dark',
        icon: '🌙',
        background: '#000000',
        foreground: '#FFFFFF',
    },
    navy: {
        name: 'Navy',
        icon: '⭐',
        background: '#0D1B2A',
        foreground: '#FFFFFF',
    },
} as const;

export type ThemeName = keyof typeof THEMES;

// AVP Color coding
export const AVP_COLORS = {
    low: { range: [0, 50], color: '#EF4444', label: 'Low' },      // Red
    medium: { range: [50, 80], color: '#EAB308', label: 'Medium' }, // Yellow
    high: { range: [80, 100], color: '#22C55E', label: 'High' },   // Green
    excellent: { range: [100, Infinity], color: '#3B82F6', label: 'Excellent' }, // Blue
} as const;

// Pagination options
export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
