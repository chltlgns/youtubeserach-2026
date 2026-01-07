'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, Film, X } from 'lucide-react';
import { UploadedVideo, VIDEO_COLORS, VIDEO_LABELS } from '@/lib/editTypes';

interface VideoUploaderProps {
    onVideosUploaded: (videos: UploadedVideo[]) => void;
}

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MIN_VIDEOS = 3;
const MAX_VIDEOS = 5;

export function VideoUploader({ onVideosUploaded }: VideoUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const validateFiles = useCallback((fileList: FileList | File[]): File[] => {
        const validFiles: File[] = [];
        const errors: string[] = [];

        Array.from(fileList).forEach(file => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                errors.push(`${file.name}: 지원하지 않는 형식 (MP4, WebM, MOV만 가능)`);
                return;
            }
            if (file.size > MAX_FILE_SIZE) {
                errors.push(`${file.name}: 파일 크기 초과 (최대 500MB)`);
                return;
            }
            validFiles.push(file);
        });

        if (errors.length > 0) {
            setError(errors.join('\n'));
        }

        return validFiles;
    }, []);

    const handleFiles = useCallback((newFiles: File[]) => {
        const validated = validateFiles(newFiles);
        const combined = [...files, ...validated].slice(0, MAX_VIDEOS);
        setFiles(combined);
        setError(null);
    }, [files, validateFiles]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(Array.from(e.dataTransfer.files));
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(Array.from(e.target.files));
        }
    }, [handleFiles]);

    const removeFile = useCallback((index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const processVideos = useCallback(async () => {
        if (files.length < MIN_VIDEOS) {
            setError(`최소 ${MIN_VIDEOS}개의 영상이 필요합니다.`);
            return;
        }

        const processedVideos: UploadedVideo[] = await Promise.all(
            files.map(async (file, index) => {
                const url = URL.createObjectURL(file);
                const videoId = VIDEO_LABELS[index].toLowerCase();

                // Get video duration
                const duration = await new Promise<number>((resolve) => {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.onloadedmetadata = () => {
                        resolve(video.duration);
                    };
                    video.src = url;
                });

                return {
                    id: videoId,
                    file,
                    url,
                    name: file.name,
                    duration,
                };
            })
        );

        onVideosUploaded(processedVideos);
    }, [files, onVideosUploaded]);

    return (
        <div className="space-y-6">
            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => inputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                    }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    multiple
                    onChange={handleInputChange}
                    className="hidden"
                />
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <p className="text-xl font-semibold mb-1">
                            Drag & Drop Videos Here
                        </p>
                        <p className="text-gray-400">
                            Upload {MIN_VIDEOS}-{MAX_VIDEOS} videos to start editing
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            MP4, WebM, MOV • Max 500MB each
                        </p>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm whitespace-pre-line">
                    {error}
                </div>
            )}

            {/* Selected Files */}
            {files.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                        Selected Videos ({files.length}/{MAX_VIDEOS})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10"
                            >
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: VIDEO_COLORS[VIDEO_LABELS[index].toLowerCase()] }}
                                >
                                    <Film className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {(file.size / 1024 / 1024).toFixed(1)} MB
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFile(index);
                                    }}
                                    className="p-1 hover:bg-white/10 rounded"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Start Editing Button */}
                    <button
                        onClick={processVideos}
                        disabled={files.length < MIN_VIDEOS}
                        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${files.length >= MIN_VIDEOS
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                            : 'bg-white/10 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {files.length >= MIN_VIDEOS
                            ? `Start Editing with ${files.length} Videos`
                            : `Add ${MIN_VIDEOS - files.length} more video(s)`}
                    </button>
                </div>
            )}
        </div>
    );
}
