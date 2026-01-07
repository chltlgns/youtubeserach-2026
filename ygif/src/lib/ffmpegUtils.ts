// FFmpeg WASM utilities for video clip extraction and merging
'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Clip, UploadedVideo, GeneratedVideo, GenerationSettings } from './editTypes';
import { shuffleClipsWithRule } from './clipUtils';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;
let loadingPromise: Promise<FFmpeg> | null = null;

/**
 * Initialize FFmpeg WASM with single-threaded core
 * Single-threaded version doesn't require SharedArrayBuffer
 */
export async function initFFmpeg(onProgress?: (message: string) => void): Promise<FFmpeg> {
    if (ffmpeg && ffmpegLoaded) {
        return ffmpeg;
    }

    // Prevent multiple concurrent loading attempts
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        ffmpeg = new FFmpeg();

        ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg]', message);
        });

        ffmpeg.on('progress', ({ progress }) => {
            onProgress?.(`Processing: ${Math.round(progress * 100)}%`);
        });

        try {
            onProgress?.('Loading FFmpeg...');

            // Use single-threaded core (doesn't require SharedArrayBuffer)
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

            const coreURL = await toBlobURL(
                `${baseURL}/ffmpeg-core.js`,
                'text/javascript'
            );
            const wasmURL = await toBlobURL(
                `${baseURL}/ffmpeg-core.wasm`,
                'application/wasm'
            );

            await ffmpeg.load({
                coreURL,
                wasmURL,
            });

            ffmpegLoaded = true;
            console.log('[FFmpeg] Loaded successfully');
            onProgress?.('FFmpeg loaded!');
            return ffmpeg;
        } catch (error) {
            console.error('[FFmpeg] Failed to load:', error);
            ffmpegLoaded = false;
            loadingPromise = null;

            // Provide user-friendly error message
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`FFmpeg 로딩 실패: ${errorMsg}. 브라우저를 새로고침해주세요.`);
        }
    })();

    return loadingPromise;
}

/**
 * Extract a single clip from a video
 */
export async function extractClip(
    video: UploadedVideo,
    clip: Clip,
    onProgress?: (message: string) => void
): Promise<Blob> {
    const ff = await initFFmpeg(onProgress);

    const inputName = `input_${video.id}.mp4`;
    const outputName = `clip_${clip.id}.mp4`;

    try {
        // Write input file to FFmpeg virtual filesystem
        const videoData = await fetchFile(video.url);
        await ff.writeFile(inputName, videoData);

        onProgress?.(`Extracting clip ${clip.id}...`);

        // Extract clip using FFmpeg
        await ff.exec([
            '-i', inputName,
            '-ss', clip.startTime.toFixed(3),
            '-t', clip.duration.toFixed(3),
            '-c', 'copy',  // Copy codec (fast, no re-encoding)
            '-y',
            outputName
        ]);

        // Read output file
        const data = await ff.readFile(outputName);
        // FFmpeg returns Uint8Array which needs casting for Blob
        const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });

        // Cleanup
        await ff.deleteFile(inputName);
        await ff.deleteFile(outputName);

        return blob;
    } catch (error) {
        console.error(`[FFmpeg] Error extracting clip ${clip.id}:`, error);
        throw error;
    }
}

/**
 * Download a clip as a file
 */
export async function downloadClip(
    video: UploadedVideo,
    clip: Clip,
    onProgress?: (message: string) => void
): Promise<void> {
    try {
        onProgress?.('Initializing FFmpeg...');
        const blob = await extractClip(video, clip, onProgress);

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clip_${clip.id}_${clip.startTime.toFixed(1)}s.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onProgress?.('Download complete!');
    } catch (error) {
        onProgress?.('Download failed');
        throw error;
    }
}

/**
 * Generate a merged video from multiple clips
 */
export async function generateMergedVideo(
    clips: Clip[],
    videos: UploadedVideo[],
    settings: GenerationSettings,
    videoIndex: number,
    onProgress?: (message: string) => void
): Promise<GeneratedVideo> {
    const ff = await initFFmpeg(onProgress);

    // Shuffle clips following the no-consecutive-same-source rule
    const shuffledClips = shuffleClipsWithRule(clips);
    const clipsPerVideo = Math.ceil(settings.targetDuration / 1.5);
    const selectedClips = shuffledClips.slice(0, clipsPerVideo);

    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const filename = `shorts_${(videoIndex + 1).toString().padStart(2, '0')}_${Math.round(settings.targetDuration)}s_${dateStr}.${settings.format}`;

    try {
        // Extract each clip and write to filesystem
        const clipFiles: string[] = [];

        for (let i = 0; i < selectedClips.length; i++) {
            const clip = selectedClips[i];
            const video = videos.find(v => v.id === clip.videoId);
            if (!video) continue;

            onProgress?.(`Extracting clip ${i + 1}/${selectedClips.length}...`);

            const inputName = `input_${clip.id}.mp4`;
            const clipName = `clip_${i}.mp4`;

            const videoData = await fetchFile(video.url);
            await ff.writeFile(inputName, videoData);

            await ff.exec([
                '-i', inputName,
                '-ss', clip.startTime.toFixed(3),
                '-t', clip.duration.toFixed(3),
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-y',
                clipName
            ]);

            clipFiles.push(clipName);
            await ff.deleteFile(inputName);
        }

        // Create concat file
        const concatContent = clipFiles.map(f => `file '${f}'`).join('\n');
        await ff.writeFile('concat.txt', concatContent);

        onProgress?.('Merging clips...');

        // Merge all clips
        const outputName = `output.${settings.format}`;
        await ff.exec([
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat.txt',
            '-c', 'copy',
            '-y',
            outputName
        ]);

        // Read output
        const data = await ff.readFile(outputName);
        // FFmpeg returns Uint8Array which needs casting for Blob
        const blob = new Blob([data as unknown as BlobPart], { type: `video/${settings.format}` });
        const url = URL.createObjectURL(blob);

        // Cleanup
        for (const f of clipFiles) {
            await ff.deleteFile(f);
        }
        await ff.deleteFile('concat.txt');
        await ff.deleteFile(outputName);

        const actualDuration = selectedClips.reduce((sum, c) => sum + c.duration, 0);

        return {
            id: `gen_${videoIndex + 1}`,
            clips: selectedClips,
            duration: actualDuration,
            blob,
            url,
            filename,
        };
    } catch (error) {
        console.error('[FFmpeg] Error generating video:', error);
        throw error;
    }
}
