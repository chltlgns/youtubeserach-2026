"""
yt-dlp Backend Server for YGIF
FastAPI server that handles YouTube video downloads using yt-dlp
"""

import os
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp
import urllib.parse

app = FastAPI(
    title="YGIF yt-dlp Backend",
    description="YouTube video download service using yt-dlp",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DOWNLOAD_PATH = os.environ.get("DOWNLOAD_PATH", "./downloads")
Path(DOWNLOAD_PATH).mkdir(parents=True, exist_ok=True)


class DownloadRequest(BaseModel):
    url: str
    format: str = "best"


class DownloadResponse(BaseModel):
    success: bool
    filename: Optional[str] = None
    format: Optional[str] = None
    size: Optional[str] = None
    error: Optional[str] = None
    download_path: Optional[str] = None
    download_url: Optional[str] = None


class DownloadInfo(BaseModel):
    id: str
    title: str
    url: str
    status: str
    filename: Optional[str] = None
    error: Optional[str] = None
    created_at: str


# In-memory storage for download history
download_history: list[DownloadInfo] = []


def format_bytes(size: int) -> str:
    """Format bytes to human readable string"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"


def get_format_options(format_choice: str) -> dict:
    """Get yt-dlp format options based on user selection"""
    format_map = {
        "best": {"format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"},
        "bestvideo+bestaudio": {"format": "bestvideo+bestaudio/best"},
        "bestvideo": {"format": "bestvideo"},
        "bestaudio": {"format": "bestaudio"},
        "mp4": {"format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]"},
        "webm": {"format": "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]"},
    }
    return format_map.get(format_choice, format_map["best"])


@app.get("/")
async def root():
    return {"message": "YGIF yt-dlp Backend is running", "status": "ok"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "download_path": DOWNLOAD_PATH,
        "downloads_count": len(download_history),
    }


@app.post("/download", response_model=DownloadResponse)
async def download_video(request: DownloadRequest):
    """Download a YouTube video using yt-dlp"""
    
    # Validate URL
    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    youtube_domains = ["youtube.com", "youtu.be", "www.youtube.com"]
    if not any(domain in request.url for domain in youtube_domains):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    download_info = DownloadInfo(
        id=datetime.now().strftime("%Y%m%d%H%M%S"),
        title="",
        url=request.url,
        status="downloading",
        created_at=datetime.now().isoformat(),
    )
    
    try:
        # yt-dlp options
        ydl_opts = {
            "outtmpl": os.path.join(DOWNLOAD_PATH, "%(title)s.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            **get_format_options(request.format),
        }
        
        # Add merge format for combined downloads
        if request.format in ["best", "bestvideo+bestaudio", "mp4"]:
            ydl_opts["merge_output_format"] = "mp4"
        
        # Run download in a thread pool to not block
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, lambda: download_with_ytdlp(request.url, ydl_opts)
        )
        
        if result["success"]:
            download_info.status = "completed"
            download_info.title = result.get("title", "")
            download_info.filename = result.get("filename", "")
            download_history.append(download_info)
            
            filename = result.get("filename")
            encoded_filename = urllib.parse.quote(filename) if filename else None
            return DownloadResponse(
                success=True,
                filename=filename,
                format=result.get("format"),
                size=result.get("size"),
                download_path=DOWNLOAD_PATH,
                download_url=f"/download-file/{encoded_filename}" if encoded_filename else None,
            )
        else:
            download_info.status = "failed"
            download_info.error = result.get("error")
            download_history.append(download_info)
            
            return DownloadResponse(
                success=False,
                error=result.get("error", "Download failed"),
            )
            
    except Exception as e:
        download_info.status = "failed"
        download_info.error = str(e)
        download_history.append(download_info)
        
        return DownloadResponse(
            success=False,
            error=str(e),
        )


def download_with_ytdlp(url: str, opts: dict) -> dict:
    """Synchronous function to download video with yt-dlp"""
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            # Get video info first
            info = ydl.extract_info(url, download=True)
            
            if info is None:
                return {"success": False, "error": "Could not extract video info"}
            
            # Get the actual filename
            filename = ydl.prepare_filename(info)
            
            # Get file size if exists
            file_size = None
            if os.path.exists(filename):
                file_size = format_bytes(os.path.getsize(filename))
            elif os.path.exists(filename.rsplit(".", 1)[0] + ".mp4"):
                filename = filename.rsplit(".", 1)[0] + ".mp4"
                file_size = format_bytes(os.path.getsize(filename))
            
            return {
                "success": True,
                "title": info.get("title", ""),
                "filename": os.path.basename(filename),
                "format": info.get("format", ""),
                "size": file_size,
            }
            
    except yt_dlp.utils.DownloadError as e:
        return {"success": False, "error": f"Download error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/downloads")
async def get_downloads():
    """Get download history"""
    return {
        "success": True,
        "downloads": download_history[-50:],  # Last 50 downloads
        "total": len(download_history),
    }


@app.get("/download-file/{filename:path}")
async def serve_download_file(filename: str):
    """Serve a downloaded file for browser download"""
    # URL decode the filename
    decoded_filename = urllib.parse.unquote(filename)
    file_path = os.path.join(DOWNLOAD_PATH, decoded_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=decoded_filename,
        media_type="application/octet-stream",
    )


@app.delete("/downloads/{download_id}")
async def delete_download(download_id: str):
    """Delete a download from history"""
    global download_history
    download_history = [d for d in download_history if d.id != download_id]
    return {"success": True, "message": "Download removed from history"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
