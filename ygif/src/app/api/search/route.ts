import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

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

// Parse ISO 8601 duration to seconds and formatted string
function parseDuration(isoDuration: string): { seconds: number; formatted: string } {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return { seconds: 0, formatted: '0:00' };

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    let formatted: string;
    if (hours > 0) {
        formatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    return { seconds: totalSeconds, formatted };
}

// Format large numbers (e.g., 1234567 -> 1,234,567)
function formatNumber(num: number): string {
    return num.toLocaleString();
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            translations,
            maxResults = 10,
            order = 'relevance', // relevance, date, viewCount, rating
            publishedAfter,
            publishedBefore,
        } = body;

        if (!YOUTUBE_API_KEY) {
            return NextResponse.json(
                { error: 'YouTube API key not configured' },
                { status: 500 }
            );
        }

        if (!translations || !Array.isArray(translations)) {
            return NextResponse.json(
                { error: 'Translations array is required' },
                { status: 400 }
            );
        }

        const allVideos: VideoResult[] = [];
        const errors: { country: string; error: string }[] = [];
        const channelCache: Map<string, { title: string; subscribers: number }> = new Map();

        for (const translation of translations) {
            const { translated_query, original_query, country_code, language_code } = translation;

            // Search for videos
            const searchParams: Record<string, string> = {
                part: 'snippet',
                q: translated_query,
                type: 'video',
                maxResults: maxResults.toString(),
                order,
                key: YOUTUBE_API_KEY,
                regionCode: country_code,
                relevanceLanguage: language_code,
            };

            if (publishedAfter) {
                searchParams.publishedAfter = new Date(publishedAfter).toISOString();
            }
            if (publishedBefore) {
                searchParams.publishedBefore = new Date(publishedBefore).toISOString();
            }

            try {
                console.log(`[Search] Searching for country ${country_code}:`, translated_query);

                const searchResponse = await axios.get(YOUTUBE_SEARCH_URL, { params: searchParams });
                const searchItems = searchResponse.data.items || [];

                console.log(`[Search] Found ${searchItems.length} videos for ${country_code}`);

                if (searchItems.length === 0) continue;

                // Get video details (views, likes, duration)
                const videoIds = searchItems.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');
                const videosResponse = await axios.get(YOUTUBE_VIDEOS_URL, {
                    params: {
                        part: 'statistics,contentDetails',
                        id: videoIds,
                        key: YOUTUBE_API_KEY,
                    },
                });

                const videoDetails = new Map<string, { views: number; likes: number; duration: string }>();
                for (const video of videosResponse.data.items || []) {
                    videoDetails.set(video.id, {
                        views: parseInt(video.statistics?.viewCount || '0'),
                        likes: parseInt(video.statistics?.likeCount || '0'),
                        duration: video.contentDetails?.duration || 'PT0S',
                    });
                }

                // Get unique channel IDs
                const channelIds = [...new Set(searchItems.map((item: { snippet: { channelId: string } }) => item.snippet.channelId))] as string[];
                const uncachedChannelIds = channelIds.filter((id) => !channelCache.has(id));

                if (uncachedChannelIds.length > 0) {
                    const channelsResponse = await axios.get(YOUTUBE_CHANNELS_URL, {
                        params: {
                            part: 'statistics,snippet',
                            id: uncachedChannelIds.join(','),
                            key: YOUTUBE_API_KEY,
                        },
                    });

                    for (const channel of channelsResponse.data.items || []) {
                        channelCache.set(channel.id, {
                            title: channel.snippet?.title || '',
                            subscribers: parseInt(channel.statistics?.subscriberCount || '0'),
                        });
                    }
                }

                // Combine all data
                for (const item of searchItems) {
                    const videoId = item.id.videoId;
                    const channelId = item.snippet.channelId;
                    const details = videoDetails.get(videoId);
                    const channelInfo = channelCache.get(channelId);
                    const durationInfo = parseDuration(details?.duration || 'PT0S');

                    allVideos.push({
                        video_id: videoId,
                        video_url: `https://www.youtube.com/watch?v=${videoId}`,
                        video_title: item.snippet.title,
                        thumbnail_url: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
                        upload_date: item.snippet.publishedAt,
                        view_count: details?.views || 0,
                        like_count: details?.likes || 0,
                        duration: durationInfo.formatted,
                        duration_seconds: durationInfo.seconds,
                        channel_id: channelId,
                        channel_title: channelInfo?.title || item.snippet.channelTitle,
                        channel_url: `https://www.youtube.com/channel/${channelId}`,
                        subscriber_count: channelInfo?.subscribers || 0,
                        country_code,
                        language_code,
                        original_query,
                        translated_query,
                    });
                }
            } catch (error: any) {
                const errorMsg = error?.response?.data?.error?.message || error?.message || 'Unknown error';
                console.error(`[Search] Error for ${country_code}:`, errorMsg);
                errors.push({ country: country_code, error: errorMsg });
            }
        }

        console.log(`[Search] Total videos found: ${allVideos.length}, Errors: ${errors.length}`);

        // Sort by view count (descending) and remove duplicates
        const uniqueVideos = Array.from(
            new Map(allVideos.map((v) => [v.video_id, v])).values()
        ).sort((a, b) => b.view_count - a.view_count);

        return NextResponse.json({
            videos: uniqueVideos,
            total: uniqueVideos.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('YouTube Search API error:', error);
        return NextResponse.json(
            { error: 'Failed to search YouTube' },
            { status: 500 }
        );
    }
}
