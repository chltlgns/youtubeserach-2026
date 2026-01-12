'use client';

import { useState } from 'react';
import axios from 'axios';
import { Download, Link, Loader2, CheckCircle2, XCircle, FolderOpen } from 'lucide-react';

interface DownloadResult {
    success: boolean;
    filename?: string;
    format?: string;
    size?: string;
    error?: string;
    download_url?: string;
}

export default function DownloadPage() {
    const [url, setUrl] = useState('');
    const [format, setFormat] = useState('best');
    const [isDownloading, setIsDownloading] = useState(false);
    const [result, setResult] = useState<DownloadResult | null>(null);

    const handleDownload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setIsDownloading(true);
        setResult(null);

        try {
            const response = await axios.post('/api/download', {
                url: url.trim(),
                format,
            });
            setResult(response.data);

            // Auto-trigger browser download if successful
            if (response.data.success && response.data.download_url) {
                const backendUrl = process.env.NEXT_PUBLIC_YTDLP_BACKEND_URL || 'http://localhost:8000';
                const downloadLink = document.createElement('a');
                downloadLink.href = `${backendUrl}${response.data.download_url}`;
                downloadLink.download = response.data.filename || 'download';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                setResult({
                    success: false,
                    error: err.response?.data?.error || 'Download failed',
                });
            } else {
                setResult({
                    success: false,
                    error: 'An unexpected error occurred',
                });
            }
        } finally {
            setIsDownloading(false);
        }
    };

    const isValidUrl = (input: string) => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
        return youtubeRegex.test(input);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                    <Download className="w-10 h-10 text-green-500" />
                    Video Download
                </h1>
                <p className="text-gray-400">
                    Download YouTube videos using yt-dlp engine. Paste any YouTube URL below.
                </p>
            </div>

            {/* Download Form */}
            <form onSubmit={handleDownload} className="space-y-6">
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                        <Link className="w-4 h-4" />
                        YouTube URL
                    </label>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                        className="w-full px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all placeholder:text-gray-500"
                    />
                    {url && !isValidUrl(url) && (
                        <p className="text-sm text-red-400 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            Please enter a valid YouTube URL
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Quality / Format</label>
                    <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-green-500 text-base"
                    >
                        <option value="best">Best Quality (Video + Audio)</option>
                        <option value="bestvideo+bestaudio">Best Video + Best Audio (Merged)</option>
                        <option value="bestvideo">Video Only (Best)</option>
                        <option value="bestaudio">Audio Only (Best)</option>
                        <option value="mp4">MP4 Format</option>
                        <option value="webm">WebM Format</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={!url.trim() || !isValidUrl(url) || isDownloading}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl font-semibold text-lg shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all flex items-center justify-center gap-2"
                >
                    {isDownloading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Downloading...
                        </>
                    ) : (
                        <>
                            <Download className="w-5 h-5" />
                            Start Download
                        </>
                    )}
                </button>
            </form>

            {/* Result */}
            {result && (
                <div
                    className={`mt-8 p-6 rounded-xl border ${result.success
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                        }`}
                >
                    <div className="flex items-start gap-4">
                        {result.success ? (
                            <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                        ) : (
                            <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                            <h3 className={`font-semibold text-lg mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                {result.success ? 'Download Complete!' : 'Download Failed'}
                            </h3>
                            {result.success ? (
                                <div className="space-y-2 text-sm text-gray-300">
                                    {result.filename && (
                                        <p className="flex items-center gap-2">
                                            <FolderOpen className="w-4 h-4 text-gray-500" />
                                            <span className="font-mono bg-white/10 px-2 py-1 rounded">{result.filename}</span>
                                        </p>
                                    )}
                                    {result.format && <p>Format: {result.format}</p>}
                                    {result.size && <p>Size: {result.size}</p>}
                                </div>
                            ) : (
                                <p className="text-gray-300">{result.error}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-12 p-6 bg-white/5 rounded-xl border border-white/10">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="text-xl">ℹ️</span>
                    Important Notes
                </h3>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li>• Make sure the Python backend server (FastAPI + yt-dlp) is running on port 8000</li>
                    <li>• Downloaded files will be saved to the configured download directory</li>
                    <li>• Some videos may be restricted and cannot be downloaded</li>
                    <li>• Large files may take several minutes to download</li>
                </ul>
            </div>
        </div>
    );
}
