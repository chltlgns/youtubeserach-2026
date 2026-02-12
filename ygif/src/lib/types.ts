// Shared types for YGIF

export interface VideoResult {
    video_id: string;
    video_url: string;
    video_title: string;
    thumbnail_url: string;
    upload_date: string;
    view_count: number;
    like_count: number;
    duration: string;
    duration_seconds: number;
    channel_id: string;
    channel_title: string;
    channel_url: string;
    subscriber_count: number;
    country_code: string;
    language_code: string;
    original_query: string;
    translated_query: string;
}
