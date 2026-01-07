'use client';

import { useState, useCallback } from 'react';
import { VideoUploader } from '@/components/edit/VideoUploader';
import { VideoPlayer } from '@/components/edit/VideoPlayer';
import { ClipList } from '@/components/edit/ClipList';
import { GenerationPanel } from '@/components/edit/GenerationPanel';
import { UploadedVideo, Clip, GenerationSettings, VIDEO_COLORS, CLIP_DURATION } from '@/lib/editTypes';

export default function EditPage() {
    const [videos, setVideos] = useState<UploadedVideo[]>([]);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [clips, setClips] = useState<Clip[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const activeVideo = videos.find(v => v.id === activeVideoId);

    const handleVideosUploaded = useCallback((newVideos: UploadedVideo[]) => {
        setVideos(newVideos);
        if (newVideos.length > 0 && !activeVideoId) {
            setActiveVideoId(newVideos[0].id);
        }
    }, [activeVideoId]);

    const handleAddClip = useCallback((videoId: string, startTime: number) => {
        const video = videos.find(v => v.id === videoId);
        if (!video) return;

        const videoClips = clips.filter(c => c.videoId === videoId);
        const clipNumber = videoClips.length + 1;

        const newClip: Clip = {
            id: `${videoId}${clipNumber}`,
            videoId,
            startTime,
            endTime: Math.min(startTime + CLIP_DURATION, video.duration),
            duration: CLIP_DURATION,
            color: VIDEO_COLORS[videoId] || '#6B7280',
        };

        setClips(prev => [...prev, newClip]);
    }, [videos, clips]);

    const handleRemoveClip = useCallback((clipId: string) => {
        setClips(prev => prev.filter(c => c.id !== clipId));
    }, []);

    const handleSelectVideo = useCallback((videoId: string) => {
        setActiveVideoId(videoId);
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                    Shorts Clip Editor
                </h1>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                    Upload videos, mark clip sections, and generate mixed shorts automatically.
                </p>
            </div>

            {/* Upload Area - Show when no videos */}
            {videos.length === 0 && (
                <VideoUploader onVideosUploaded={handleVideosUploaded} />
            )}

            {/* Main Editor - Show when videos uploaded */}
            {videos.length > 0 && (
                <div className="space-y-6">
                    {/* Video Thumbnails Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                        {videos.map(video => {
                            const videoClips = clips.filter(c => c.videoId === video.id);
                            const isActive = video.id === activeVideoId;
                            return (
                                <button
                                    key={video.id}
                                    onClick={() => handleSelectVideo(video.id)}
                                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${isActive
                                            ? 'border-blue-500 ring-2 ring-blue-500/30'
                                            : 'border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    <div className="aspect-video bg-black/50 flex items-center justify-center">
                                        <video
                                            src={video.url}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div
                                        className="absolute top-2 left-2 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                                        style={{ backgroundColor: VIDEO_COLORS[video.id] }}
                                    >
                                        {video.id.toUpperCase()}
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                                        <p className="text-xs text-white truncate">{video.name}</p>
                                        <p className="text-xs text-gray-400">
                                            {videoClips.length} clips
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Video Player */}
                    {activeVideo && (
                        <VideoPlayer
                            video={activeVideo}
                            clips={clips.filter(c => c.videoId === activeVideo.id)}
                            onAddClip={(startTime) => handleAddClip(activeVideo.id, startTime)}
                        />
                    )}

                    {/* Clips List */}
                    {clips.length > 0 && (
                        <ClipList
                            clips={clips}
                            videos={videos}
                            onRemoveClip={handleRemoveClip}
                        />
                    )}

                    {/* Generation Panel */}
                    {clips.length >= 2 && (
                        <GenerationPanel
                            clips={clips}
                            videos={videos}
                            isGenerating={isGenerating}
                            setIsGenerating={setIsGenerating}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
