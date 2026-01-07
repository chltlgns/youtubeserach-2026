'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Scissors, SkipBack, SkipForward } from 'lucide-react';
import { UploadedVideo, Clip, CLIP_DURATION } from '@/lib/editTypes';

interface VideoPlayerProps {
    video: UploadedVideo;
    clips: Clip[];
    onAddClip: (startTime: number) => void;
}

export function VideoPlayer({ video, clips, onAddClip }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [clipAdded, setClipAdded] = useState(false);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const handleTimeUpdate = () => setCurrentTime(videoEl.currentTime);
        const handleDurationChange = () => setDuration(videoEl.duration);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleLoadedData = () => {
            setDuration(videoEl.duration);
            setCurrentTime(0);
            setIsPlaying(false);
        };

        videoEl.addEventListener('timeupdate', handleTimeUpdate);
        videoEl.addEventListener('durationchange', handleDurationChange);
        videoEl.addEventListener('play', handlePlay);
        videoEl.addEventListener('pause', handlePause);
        videoEl.addEventListener('loadeddata', handleLoadedData);

        return () => {
            videoEl.removeEventListener('timeupdate', handleTimeUpdate);
            videoEl.removeEventListener('durationchange', handleDurationChange);
            videoEl.removeEventListener('play', handlePlay);
            videoEl.removeEventListener('pause', handlePause);
            videoEl.removeEventListener('loadeddata', handleLoadedData);
        };
    }, [video.id]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isPlaying) {
            video.pause();
        } else {
            video.play();
        }
    }, [isPlaying]);

    const handleClip = useCallback(() => {
        if (currentTime + CLIP_DURATION > duration) {
            alert('영상 끝 부분입니다. 클립을 추가할 수 없습니다.');
            return;
        }
        onAddClip(currentTime);
        setClipAdded(true);
        setTimeout(() => setClipAdded(false), 500);
    }, [currentTime, duration, onAddClip]);

    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        const timeline = timelineRef.current;
        const video = videoRef.current;
        if (!timeline || !video) return;

        const rect = timeline.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * duration;
    }, [duration]);

    const skip = useCallback((seconds: number) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
        }
    }, [duration]);

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            {/* Video Display - max-h로 크기 제한 */}
            <div className="relative rounded-xl overflow-hidden bg-black mb-4 max-h-[50vh]">
                <video
                    key={video.id}
                    ref={videoRef}
                    src={video.url}
                    className="w-full h-full object-contain max-h-[50vh]"
                    onClick={togglePlay}
                />

                {/* Clip Feedback Overlay */}
                {clipAdded && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center animate-pulse">
                        <div className="text-2xl font-bold text-green-400">
                            ✓ Clip Added!
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
                {/* Buttons Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => skip(-5)}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            title="5초 뒤로"
                        >
                            <SkipBack className="w-5 h-5" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6" />
                            ) : (
                                <Play className="w-6 h-6" />
                            )}
                        </button>
                        <button
                            onClick={() => skip(5)}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            title="5초 앞으로"
                        >
                            <SkipForward className="w-5 h-5" />
                        </button>

                        {/* Clip Button */}
                        <button
                            onClick={handleClip}
                            className="flex items-center gap-2 px-4 py-2 ml-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 rounded-xl font-medium transition-all"
                        >
                            <Scissors className="w-4 h-4" />
                            Clip
                        </button>
                    </div>

                    {/* Time & Speed */}
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-mono">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                        <select
                            value={playbackRate}
                            onChange={(e) => setPlaybackRate(Number(e.target.value))}
                            className="px-2 py-1 rounded bg-white/10 text-sm border border-white/20"
                        >
                            <option value={0.5}>0.5x</option>
                            <option value={1}>1x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2}>2x</option>
                        </select>
                    </div>
                </div>

                {/* Timeline */}
                <div
                    ref={timelineRef}
                    onClick={handleTimelineClick}
                    className="relative h-12 bg-white/10 rounded-lg cursor-pointer overflow-hidden"
                >
                    {/* Clip Markers */}
                    {clips.map(clip => {
                        const startPercent = (clip.startTime / duration) * 100;
                        const widthPercent = (clip.duration / duration) * 100;
                        return (
                            <div
                                key={clip.id}
                                className="absolute top-0 h-full opacity-50 hover:opacity-80 transition-opacity"
                                style={{
                                    left: `${startPercent}%`,
                                    width: `${widthPercent}%`,
                                    backgroundColor: clip.color,
                                }}
                                title={`${clip.id}: ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`}
                            >
                                <span className="absolute top-1 left-1 text-[10px] text-white font-bold">
                                    {clip.id}
                                </span>
                            </div>
                        );
                    })}

                    {/* Progress Bar */}
                    <div
                        className="absolute top-0 left-0 h-full bg-blue-500/30 pointer-events-none"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    />

                    {/* Playhead */}
                    <div
                        className="absolute top-0 w-0.5 h-full bg-white shadow-lg pointer-events-none"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
