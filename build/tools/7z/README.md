# 7-Zip Command Line Tool

This directory should contain the 7-Zip command line tools for extracting VOICEVOX Engine archives.

## Required Files

Download the 7-Zip Extra package and place the following files in this directory:

### Windows (x64)
- `7za.exe` (standalone console version)

**Download from:** https://www.7-zip.org/download.html

Look for "7-Zip Extra: standalone console version" under the latest version.

## Installation Steps

1. Visit https://www.7-zip.org/download.html
2. Download **"7-Zip Extra"** (NOT the installer)
   - Example: `7z2408-extra.7z` for version 24.08
3. Extract the archive
4. Copy `7za.exe` from the extracted files to this directory (`build/tools/7z/`)

## File Structure

After setup, this directory should look like:
```
build/tools/7z/
├── README.md (this file)
└── 7za.exe (the standalone 7-Zip executable)
```

## License

7-Zip is licensed under the GNU LGPL license. The source code is available at:
https://www.7-zip.org/

## Why 7za.exe?

- **7za.exe** is the standalone console version that requires no installation
- It can be bundled with applications
- Supports all major archive formats including .7z with split volumes
- Lightweight (~1MB) and no external dependencies

## Alternative: System-Installed 7-Zip

If 7za.exe is not present in this directory, the application will attempt to use the system-installed 7-Zip from:
- `C:\Program Files\7-Zip\7z.exe`
- `C:\Program Files (x86)\7-Zip\7z.exe`

However, bundling 7za.exe ensures the application works without requiring users to install 7-Zip separately.
