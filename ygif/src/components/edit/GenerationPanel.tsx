'use client';

import { useState, useCallback } from 'react';
import { Play, Download, Loader2, Sparkles } from 'lucide-react';
import { Clip, UploadedVideo, GenerationSettings, GeneratedVideo } from '@/lib/editTypes';
import { shuffleClipsWithRule } from '@/lib/clipUtils';
import { generateMergedVideo, initFFmpeg } from '@/lib/ffmpegUtils';

interface GenerationPanelProps {
    clips: Clip[];
    videos: UploadedVideo[];
    isGenerating: boolean;
    setIsGenerating: (value: boolean) => void;
}

export function GenerationPanel({
    clips,
    videos,
    isGenerating,
    setIsGenerating
}: GenerationPanelProps) {
    const [settings, setSettings] = useState<GenerationSettings>({
        targetDuration: 30,
        count: 3,
        format: 'mp4',
    });
    const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [previewSequence, setPreviewSequence] = useState<Clip[]>([]);

    const handlePreview = useCallback(() => {
        const shuffled = shuffleClipsWithRule(clips);
        setPreviewSequence(shuffled);
    }, [clips]);

    const handleGenerate = useCallback(async () => {
        if (clips.length < 2) {
            alert('최소 2개의 클립이 필요합니다.');
            return;
        }

        // Check if we have clips from at least 2 different videos
        const uniqueVideoIds = new Set(clips.map(c => c.videoId));
        if (uniqueVideoIds.size < 2) {
            alert('연속 동일 소스 금지 규칙을 위해 최소 2개의 다른 영상에서 클립이 필요합니다.');
            return;
        }

        setIsGenerating(true);
        setProgress(0);
        setProgressMessage('Initializing FFmpeg...');

        try {
            // Initialize FFmpeg first
            await initFFmpeg((msg) => setProgressMessage(msg));

            const results: GeneratedVideo[] = [];

            for (let i = 0; i < settings.count; i++) {
                setProgress(Math.round((i / settings.count) * 100));
                setProgressMessage(`Generating video ${i + 1}/${settings.count}...`);

                const video = await generateMergedVideo(
                    clips,
                    videos,
                    settings,
                    i,
                    (msg) => setProgressMessage(msg)
                );
                results.push(video);
            }

            setGeneratedVideos(results);
            setProgress(100);
            setProgressMessage('Complete!');
        } catch (error) {
            console.error('Generation error:', error);
            alert('영상 생성 중 오류가 발생했습니다. ' + (error as Error).message);
        } finally {
            setIsGenerating(false);
        }
    }, [clips, videos, settings, setIsGenerating]);

    const handleDownload = useCallback((video: GeneratedVideo) => {
        if (!video.url) return;

        const a = document.createElement('a');
        a.href = video.url;
        a.download = video.filename;
        a.click();
    }, []);

    const handleDownloadAll = useCallback(() => {
        generatedVideos.forEach((video, index) => {
            setTimeout(() => handleDownload(video), index * 500);
        });
    }, [generatedVideos, handleDownload]);

    const maxClipsNeeded = Math.ceil(settings.targetDuration / 1.5);
    const hasEnoughClips = clips.length >= maxClipsNeeded;

    return (
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Generation Settings
            </h3>

            {/* Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Duration */}
                <div>
                    <label className="block text-sm text-gray-400 mb-2">
                        Video Length
                    </label>
                    <select
                        value={settings.targetDuration}
                        onChange={(e) => setSettings(s => ({ ...s, targetDuration: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    >
                        <option value={15}>15 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={45}>45 seconds</option>
                        <option value={60}>60 seconds</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        Needs ~{Math.ceil(settings.targetDuration / 1.5)} clips
                    </p>
                </div>

                {/* Count */}
                <div>
                    <label className="block text-sm text-gray-400 mb-2">
                        Number of Videos
                    </label>
                    <select
                        value={settings.count}
                        onChange={(e) => setSettings(s => ({ ...s, count: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <option key={n} value={n}>{n} video{n > 1 ? 's' : ''}</option>
                        ))}
                    </select>
                </div>

                {/* Format */}
                <div>
                    <label className="block text-sm text-gray-400 mb-2">
                        Output Format
                    </label>
                    <select
                        value={settings.format}
                        onChange={(e) => setSettings(s => ({ ...s, format: e.target.value as 'mp4' | 'webm' }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    >
                        <option value="mp4">MP4</option>
                        <option value="webm">WebM</option>
                    </select>
                </div>
            </div>

            {/* Preview Button */}
            <button
                onClick={handlePreview}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 font-medium transition-colors flex items-center justify-center gap-2"
            >
                <Play className="w-4 h-4" />
                Preview Clip Sequence
            </button>

            {/* Preview Sequence */}
            {previewSequence.length > 0 && (
                <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-400 mb-2">Preview Sequence:</p>
                    <div className="flex flex-wrap gap-2">
                        {previewSequence.slice(0, maxClipsNeeded).map((clip, i) => (
                            <span
                                key={`${clip.id}-${i}`}
                                className="px-2 py-1 rounded text-xs font-bold text-white"
                                style={{ backgroundColor: clip.color }}
                            >
                                {clip.id.toUpperCase()}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Warning if not enough clips */}
            {!hasEnoughClips && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
                    ⚠️ {settings.targetDuration}초 영상을 위해 최소 {maxClipsNeeded}개의 클립이 필요합니다.
                    현재 {clips.length}개입니다.
                </div>
            )}

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={isGenerating || !hasEnoughClips}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${isGenerating || !hasEnoughClips
                    ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                    }`}
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating... {progress}%
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        Generate {settings.count} Video{settings.count > 1 ? 's' : ''}
                    </>
                )}
            </button>

            {/* Progress Bar */}
            {isGenerating && (
                <div className="space-y-2">
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-sm text-gray-400 text-center">{progressMessage}</p>
                </div>
            )}

            {/* Generated Videos */}
            {generatedVideos.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Generated Videos</h4>
                        <button
                            onClick={handleDownloadAll}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download All
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {generatedVideos.map(video => (
                            <div
                                key={video.id}
                                className="bg-white/5 rounded-xl overflow-hidden border border-white/10"
                            >
                                {video.url && (
                                    <video
                                        src={video.url}
                                        controls
                                        className="w-full aspect-video"
                                    />
                                )}
                                <div className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">{video.filename}</p>
                                        <p className="text-xs text-gray-400">
                                            {video.duration.toFixed(1)}s • {video.clips.length} clips
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(video)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
