'use client';

import { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { Clip, UploadedVideo, VIDEO_COLORS } from '@/lib/editTypes';
import { downloadClip } from '@/lib/ffmpegUtils';

interface ClipListProps {
    clips: Clip[];
    videos: UploadedVideo[];
    onRemoveClip: (clipId: string) => void;
}

export function ClipList({ clips, videos, onRemoveClip }: ClipListProps) {
    const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<string>('');

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms}`;
    };

    const handleDownloadClip = async (clip: Clip) => {
        const video = videos.find(v => v.id === clip.videoId);
        if (!video) return;

        setDownloadingClipId(clip.id);
        try {
            await downloadClip(video, clip, (msg) => setDownloadProgress(msg));
        } catch (error) {
            console.error('Download failed:', error);
            const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
            alert(`클립 다운로드 실패: ${errorMsg}`);
        } finally {
            setDownloadingClipId(null);
            setDownloadProgress('');
        }
    };

    // Group clips by video
    const groupedClips = clips.reduce((acc, clip) => {
        if (!acc[clip.videoId]) {
            acc[clip.videoId] = [];
        }
        acc[clip.videoId].push(clip);
        return acc;
    }, {} as Record<string, Clip[]>);

    return (
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    🎬 Clips
                    <span className="text-sm font-normal text-gray-400">
                        ({clips.length} total)
                    </span>
                </h3>
                <div className="text-sm text-gray-400">
                    Total: {(clips.length * 1.5).toFixed(1)}s
                </div>
            </div>

            {/* Download Progress */}
            {downloadingClipId && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {downloadProgress || 'Processing...'}
                </div>
            )}

            {/* Clips Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {clips.map(clip => {
                    const video = videos.find(v => v.id === clip.videoId);
                    const isDownloading = downloadingClipId === clip.id;
                    return (
                        <div
                            key={clip.id}
                            className="relative rounded-xl overflow-hidden border-2 transition-all hover:scale-105"
                            style={{ borderColor: clip.color }}
                        >
                            {/* Thumbnail Preview */}
                            <div className="aspect-video bg-black/50 relative">
                                {video && (
                                    <video
                                        src={`${video.url}#t=${clip.startTime}`}
                                        className="w-full h-full object-cover"
                                        muted
                                    />
                                )}

                                {/* Clip ID Badge */}
                                <div
                                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-bold text-white"
                                    style={{ backgroundColor: clip.color }}
                                >
                                    {clip.id.toUpperCase()}
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={() => onRemoveClip(clip.id)}
                                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 rounded transition-colors"
                                    title="Delete clip"
                                >
                                    <X className="w-3 h-3" />
                                </button>

                                {/* Download Button */}
                                <button
                                    onClick={() => handleDownloadClip(clip)}
                                    disabled={isDownloading}
                                    className="absolute bottom-1 right-1 p-1 bg-black/50 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                                    title="Download clip"
                                >
                                    {isDownloading ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Download className="w-3 h-3" />
                                    )}
                                </button>
                            </div>

                            {/* Time Info */}
                            <div className="p-2 bg-white/5 text-center">
                                <p className="text-xs font-mono text-gray-300">
                                    {formatTime(clip.startTime)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Clips by Video Summary */}
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-4">
                {Object.entries(groupedClips).map(([videoId, videoClips]) => (
                    <div key={videoId} className="flex items-center gap-2">
                        <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: VIDEO_COLORS[videoId] }}
                        />
                        <span className="text-sm text-gray-400">
                            Video {videoId.toUpperCase()}: {videoClips.length} clips
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

