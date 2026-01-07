// Types for Shorts Clip Editor

export interface UploadedVideo {
    id: string;           // 'a', 'b', 'c', 'd', 'e'
    file: File;
    url: string;          // Object URL for playback
    name: string;
    duration: number;     // in seconds
    thumbnail?: string;   // Generated thumbnail
}

export interface Clip {
    id: string;           // 'a1', 'a2', 'b1', etc.
    videoId: string;      // Reference to UploadedVideo.id
    startTime: number;    // Start time in seconds
    endTime: number;      // End time in seconds (startTime + 1.5)
    duration: number;     // Always 1.5 seconds
    color: string;        // Color for visualization
}

export interface GenerationSettings {
    targetDuration: number;  // 15-60 seconds
    count: number;           // 1-10 videos to generate
    format: 'mp4' | 'webm';
}

export interface GeneratedVideo {
    id: string;
    clips: Clip[];
    duration: number;
    blob?: Blob;
    url?: string;
    filename: string;
}

// Video ID to Color mapping
export const VIDEO_COLORS: Record<string, string> = {
    'a': '#3B82F6', // Blue
    'b': '#10B981', // Green
    'c': '#F59E0B', // Orange
    'd': '#EF4444', // Red
    'e': '#8B5CF6', // Purple
};

export const VIDEO_LABELS = ['A', 'B', 'C', 'D', 'E'];

export const CLIP_DURATION = 1.5; // seconds
