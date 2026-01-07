// Clip Utilities - Shuffle algorithm and video generation

import { Clip, UploadedVideo, GenerationSettings, GeneratedVideo, CLIP_DURATION } from './editTypes';

/**
 * Shuffle clips with the "no consecutive same source" rule
 * Uses round-robin selection from each video source
 */
export function shuffleClipsWithRule(clips: Clip[]): Clip[] {
    if (clips.length === 0) return [];

    // Group clips by video ID
    const groups: Map<string, Clip[]> = new Map();
    clips.forEach(clip => {
        const existing = groups.get(clip.videoId) || [];
        existing.push({ ...clip }); // Clone to avoid mutation
        groups.set(clip.videoId, existing);
    });

    const result: Clip[] = [];
    const videoIds = Array.from(groups.keys());
    let lastVideoId: string | null = null;

    // Continue until all clips are used
    while (result.length < clips.length) {
        let added = false;

        // Try each video source
        for (const videoId of videoIds) {
            // Skip if same as last (consecutive rule)
            if (videoId === lastVideoId) continue;

            const videoClips = groups.get(videoId);
            if (videoClips && videoClips.length > 0) {
                const clip = videoClips.shift()!;
                result.push(clip);
                lastVideoId = videoId;
                added = true;
                break;
            }
        }

        // If we couldn't add anything due to consecutive rule,
        // rotate the video order and try again
        if (!added) {
            // Find any remaining clips
            for (const videoId of videoIds) {
                const videoClips = groups.get(videoId);
                if (videoClips && videoClips.length > 0) {
                    const clip = videoClips.shift()!;
                    result.push(clip);
                    lastVideoId = videoId;
                    break;
                }
            }
        }

        // Rotate video order for fairness
        videoIds.push(videoIds.shift()!);
    }

    return result;
}

/**
 * Validate that the clip sequence follows the no consecutive same source rule
 */
export function validateClipSequence(clips: Clip[]): boolean {
    for (let i = 1; i < clips.length; i++) {
        if (clips[i].videoId === clips[i - 1].videoId) {
            return false;
        }
    }
    return true;
}

/**
 * Generate videos by concatenating clips
 * Note: This is a simplified version that creates "virtual" videos
 * For actual video processing, FFmpeg WASM would be needed
 */
export async function generateVideos(
    clips: Clip[],
    videos: UploadedVideo[],
    settings: GenerationSettings,
    onProgress: (progress: number) => void
): Promise<GeneratedVideo[]> {
    const { targetDuration, count, format } = settings;
    const clipsPerVideo = Math.ceil(targetDuration / CLIP_DURATION);
    const generatedVideos: GeneratedVideo[] = [];

    // Shuffle clips for each video
    let remainingClips = [...clips];

    for (let i = 0; i < count; i++) {
        onProgress(Math.round((i / count) * 50));

        // Get shuffled clips for this video
        const shuffled = shuffleClipsWithRule(remainingClips);
        const videoClips = shuffled.slice(0, clipsPerVideo);

        if (videoClips.length < 2) {
            console.warn(`Not enough clips for video ${i + 1}`);
            continue;
        }

        // Calculate actual duration
        const actualDuration = videoClips.reduce((sum, c) => sum + c.duration, 0);

        // Generate filename
        const date = new Date();
        const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const filename = `shorts_${(i + 1).toString().padStart(2, '0')}_${Math.round(actualDuration)}s_${dateStr}.${format}`;

        // For now, create a virtual video object
        // In production, this would use FFmpeg WASM to actually concatenate clips
        const generatedVideo: GeneratedVideo = {
            id: `gen_${i + 1}`,
            clips: videoClips,
            duration: actualDuration,
            filename,
            // Note: blob and url would be set after FFmpeg processing
        };

        generatedVideos.push(generatedVideo);

        // Re-shuffle remaining clips for variety
        remainingClips = shuffleClipsWithRule(remainingClips);
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
    onProgress(100);

    return generatedVideos;
}

/**
 * Create a clip preview URL at specific time
 */
export function getClipPreviewUrl(video: UploadedVideo, clip: Clip): string {
    return `${video.url}#t=${clip.startTime},${clip.endTime}`;
}

/**
 * Calculate how many clips are needed for target duration
 */
export function calculateClipsNeeded(targetDuration: number): number {
    return Math.ceil(targetDuration / CLIP_DURATION);
}
