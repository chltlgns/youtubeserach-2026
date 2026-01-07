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
import { VideoResult } from '@/app/api/search/route';
import { Copy, Check, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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

    const copyToClipboard = useCallback(async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    const copySelectedUrls = useCallback(async () => {
        const selectedRows = table.getSelectedRowModel().rows;
        const urls = selectedRows.map((row) => row.original.video_url).join('\n');
        if (urls) {
            await navigator.clipboard.writeText(urls);
            setCopiedId('bulk');
            setTimeout(() => setCopiedId(null), 2000);
        }
    }, []);

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
        columnHelper.display({
            id: 'actions',
            header: 'ACTIONS',
            cell: ({ row }) => {
                const video = row.original;
                const isCopied = copiedId === video.video_id;
                return (
                    <div className="flex items-center gap-2">
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
            size: 100,
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
