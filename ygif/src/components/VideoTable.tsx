'use client';

import { useState, useCallback } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
    RowSelectionState,
} from '@tanstack/react-table';
import { VideoResult } from '@/lib/types';
import { Copy, Check, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, Download, Loader2 } from 'lucide-react';
import { ROWS_PER_PAGE_OPTIONS } from '@/lib/constants';

const columnHelper = createColumnHelper<VideoResult>();

interface VideoTableProps {
    videos: VideoResult[];
    isLoading?: boolean;
}

export function VideoTable({ videos, isLoading }: VideoTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
    const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

    const copyToClipboard = useCallback(async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    // Note: copySelectedUrls references `table` which is defined later.
    // This is safe because the callback is only called after render when table exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const copySelectedUrls = useCallback(async () => {
        const selectedRows = table.getSelectedRowModel().rows;
        const urls = selectedRows.map((row) => row.original.video_url).join('\n');
        if (urls) {
            await navigator.clipboard.writeText(urls);
            setCopiedId('bulk');
            setTimeout(() => setCopiedId(null), 2000);
        }
    }, [rowSelection]);

    const backendUrl = process.env.NEXT_PUBLIC_YTDLP_BACKEND_URL;
    const isDownloadAvailable = !!backendUrl;

    const downloadForPremiere = useCallback(async (videoUrl: string, videoId: string) => {
        if (!isDownloadAvailable) {
            alert('다운로드 백엔드가 설정되지 않았습니다. NEXT_PUBLIC_YTDLP_BACKEND_URL 환경변수를 확인하세요.');
            return;
        }
        if (downloadingIds.has(videoId)) return;

        setDownloadingIds(prev => new Set(prev).add(videoId));

        try {
            const response = await fetch('/api/download-premiere', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: videoUrl }),
            });

            const data = await response.json();

            if (data.success && data.download_url) {
                window.open(`${backendUrl}${data.download_url}`, '_blank');
                setDownloadedIds(prev => new Set(prev).add(videoId));
                setTimeout(() => {
                    setDownloadedIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(videoId);
                        return newSet;
                    });
                }, 3000);
            } else {
                alert(`다운로드 실패: ${data.error || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('다운로드에 실패했습니다. 백엔드 서버가 실행 중인지 확인하세요.');
        } finally {
            setDownloadingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(videoId);
                return newSet;
            });
        }
    }, [downloadingIds, isDownloadAvailable, backendUrl]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const columns = [
        columnHelper.display({
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    checked={table.getIsAllRowsSelected()}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                    className="w-4 h-4 rounded accent-blue-500"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    className="w-4 h-4 rounded accent-blue-500"
                />
            ),
            size: 40,
        }),
        columnHelper.accessor('video_title', {
            header: 'VIDEO',
            cell: (info) => {
                const video = info.row.original;
                return (
                    <div className="flex items-center gap-3 min-w-[350px]">
                        <img
                            src={video.thumbnail_url}
                            alt={video.video_title}
                            className="w-24 h-14 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-medium leading-tight mb-1" title={video.video_title}>
                                {video.video_title}
                            </p>
                            <a
                                href={video.channel_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-400 hover:text-blue-400"
                            >
                                {video.channel_title}
                            </a>
                        </div>
                    </div>
                );
            },
            size: 400,
        }),
        columnHelper.accessor('view_count', {
            header: 'VIEWS',
            cell: (info) => (
                <span className="text-sm font-medium">{formatNumber(info.getValue())}</span>
            ),
            size: 100,
        }),
        columnHelper.accessor('like_count', {
            header: 'LIKES',
            cell: (info) => (
                <span className="text-sm">{formatNumber(info.getValue())}</span>
            ),
            size: 80,
        }),
        columnHelper.accessor('duration', {
            header: 'LENGTH',
            cell: (info) => (
                <span className="text-sm font-mono">{info.getValue()}</span>
            ),
            size: 80,
        }),
        columnHelper.accessor('subscriber_count', {
            header: 'SUBS',
            cell: (info) => (
                <span className="text-sm">{formatNumber(info.getValue())}</span>
            ),
            size: 80,
        }),
        columnHelper.accessor('upload_date', {
            header: 'PUBLISHED',
            cell: (info) => (
                <span className="text-sm text-gray-400">{formatDate(info.getValue())}</span>
            ),
            size: 120,
        }),
        columnHelper.accessor('country_code', {
            header: 'COUNTRY',
            cell: (info) => (
                <span className="text-xs px-2 py-1 rounded bg-white/10 font-medium">
                    {info.getValue()}
                </span>
            ),
            size: 80,
        }),
        columnHelper.accessor('quality_score', {
            header: 'QUALITY',
            cell: (info) => {
                const score = info.getValue();
                const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                const textColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${color}`}
                                style={{ width: `${score}%` }}
                            />
                        </div>
                        <span className={`text-xs font-bold ${textColor}`}>{score}</span>
                    </div>
                );
            },
            size: 120,
        }),
        columnHelper.display({
            id: 'actions',
            header: 'ACTIONS',
            cell: ({ row }) => {
                const video = row.original;
                const isCopied = copiedId === video.video_id;
                const isDownloading = downloadingIds.has(video.video_id);
                const isDownloaded = downloadedIds.has(video.video_id);
                return (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => downloadForPremiere(video.video_url, video.video_id)}
                            disabled={isDownloading || !isDownloadAvailable}
                            className="p-2 rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isDownloadAvailable ? "Download for Premiere (H.264)" : "다운로드 백엔드 미설정"}
                        >
                            {isDownloading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            ) : isDownloaded ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Download className="w-4 h-4 text-purple-400" />
                            )}
                        </button>
                        <button
                            onClick={() => copyToClipboard(video.video_url, video.video_id)}
                            className="p-2 rounded hover:bg-white/10 transition-colors"
                            title="Copy URL"
                        >
                            {isCopied ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </button>
                        <a
                            href={video.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded hover:bg-white/10 transition-colors"
                            title="Open in YouTube"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                );
            },
            size: 120,
        }),
    ];

    const table = useReactTable({
        data: videos,
        columns,
        state: {
            sorting,
            rowSelection,
        },
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableRowSelection: true,
        initialState: {
            pagination: {
                pageSize: 25,
            },
        },
    });

    const selectedCount = Object.keys(rowSelection).length;

    return (
        <div className="w-full">
            {/* Header with bulk actions */}
            <div className="flex items-center justify-between mb-4 px-4 py-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                        Showing <span className="font-bold text-white">{videos.length}</span> videos
                    </span>
                    <span className="text-xs text-gray-500">
                        YouTube API data may have 2-3 day delay
                    </span>
                </div>
                {selectedCount > 0 && (
                    <button
                        onClick={copySelectedUrls}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        {copiedId === 'bulk' ? (
                            <>
                                <Check className="w-4 h-4" />
                                Copied {selectedCount} URLs
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                Copy {selectedCount} URLs
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[1100px]">
                    <thead className="bg-white/5">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                                        style={{ width: header.getSize() }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-white' : ''
                                                    }`}
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {header.column.getCanSort() && (
                                                    <span className="text-gray-500">
                                                        {header.column.getIsSorted() === 'asc' ? (
                                                            <ChevronUp className="w-4 h-4" />
                                                        ) : header.column.getIsSorted() === 'desc' ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronsUpDown className="w-4 h-4" />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {isLoading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        Loading videos...
                                    </div>
                                </td>
                            </tr>
                        ) : videos.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                                    No videos found. Try searching with different keywords.
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className={`hover:bg-white/5 transition-colors ${row.getIsSelected() ? 'bg-blue-500/10' : ''
                                        }`}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {videos.length > 0 && (
                <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Rows per page:</span>
                        <select
                            value={table.getState().pagination.pageSize}
                            onChange={(e) => table.setPageSize(Number(e.target.value))}
                            className="px-2 py-1 rounded bg-white/10 text-sm border border-white/20 focus:outline-none focus:border-blue-500"
                        >
                            {ROWS_PER_PAGE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
