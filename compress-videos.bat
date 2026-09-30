@echo off
REM Compress portfolio videos for the web.
REM 1) Drop your original videos (mp4/mov) into the  media\raw  folder
REM 2) Double-click this file
REM 3) Web-ready files appear in  media\  (720p vertical-friendly, ~1-3 MB, plays instantly) plus a thumbnail .jpg
setlocal enabledelayedexpansion
cd /d "%~dp0media"
if not exist raw ( echo No media\raw folder found. & pause & exit /b )
for %%f in (raw\*.mp4 raw\*.mov raw\*.m4v raw\*.webm) do (
  echo Compressing %%~nxf ...
  ffmpeg -y -loglevel error -i "%%f" -vf "scale='min(720,iw)':-2" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an "%%~nf.mp4"
  ffmpeg -y -loglevel error -i "%%f" -ss 0.5 -vframes 1 -vf "scale='min(720,iw)':-2" -q:v 4 "%%~nf.jpg"
)
echo.
echo Done. Files in media\  (use "media/NAME.mp4" and poster "media/NAME.jpg" in data.js)
pause
