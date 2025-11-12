const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// VOICEVOX Engine versions and download URLs
const ENGINE_VERSION = '0.25.0';

const ENGINE_TYPES = {
  cuda: {
    name: 'CUDA版（NVIDIA GPU対応）',
    description: '【推奨】NVIDIA GPUで最高速。CUDA対応GPUが必要',
    recommended: true,
    platform: 'windows',
    urls: [
      `https://github.com/VOICEVOX/voicevox_engine/releases/download/${ENGINE_VERSION}/voicevox_engine-windows-nvidia-${ENGINE_VERSION}.7z.001`,
      `https://github.com/VOICEVOX/voicevox_engine/releases/download/${ENGINE_VERSION}/voicevox_engine-windows-nvidia-${ENGINE_VERSION}.7z.002`
    ]
  },
  directml: {
    name: 'DirectML版（AMD/Intel GPU対応）',
    description: '【推奨】AMD/Intel GPUで高速動作。Windows 10以降が必要',
    recommended: true,
    platform: 'windows',
    urls: [
      `https://github.com/VOICEVOX/voicevox_engine/releases/download/${ENGINE_VERSION}/voicevox_engine-windows-directml-${ENGINE_VERSION}.7z.001`
    ]
  },
  cpu: {
    name: 'CPU版（すべてのPC対応）',
    description: 'GPU非対応の場合や、GPU版で問題が発生した場合に選択',
    recommended: false,
    platform: 'windows',
    urls: [
      `https://github.com/VOICEVOX/voicevox_engine/releases/download/${ENGINE_VERSION}/voicevox_engine-windows-cpu-${ENGINE_VERSION}.7z.001`
    ]
  }
};

class EngineDownloader {
  constructor(engineDir, onProgress, onLog, tempDir) {
    this.engineDir = engineDir;
    this.tempDir = tempDir; // Allow custom temp directory
    this.onProgress = onProgress || (() => {});
    this.onLog = onLog || console.log;
  }

  async downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      this.onLog(`Downloading: ${url}`);

      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);

      protocol.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          file.close();
          fs.unlinkSync(destPath);
          return this.downloadFile(response.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          return reject(new Error(`Download failed: ${response.statusCode}`));
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = totalSize ? (downloadedSize / totalSize) * 100 : 0;
          this.onProgress({
            type: 'download',
            file: path.basename(url),
            progress: progress,
            downloadedSize,
            totalSize
          });
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          this.onLog(`Downloaded: ${path.basename(url)}`);
          resolve(destPath);
        });
      }).on('error', (err) => {
        file.close();
        fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }

  async extract7z(archivePath, outputDir) {
    return new Promise((resolve, reject) => {
      this.onLog(`Extracting: ${path.basename(archivePath)}`);

      this.onProgress({
        type: 'extract',
        file: path.basename(archivePath),
        progress: 0
      });

      const sevenZipPath = this.get7zBinPath();

      // 7z x <archive> -o<output_dir> -y
      const args = ['x', archivePath, `-o${outputDir}`, '-y'];

      this.onLog(`Running: ${sevenZipPath} ${args.join(' ')}`);

      const process = spawn(sevenZipPath, args);

      let outputBuffer = '';
      let errorBuffer = '';

      process.stdout.on('data', (data) => {
        outputBuffer += data.toString();
        // Update progress (simple estimation)
        this.onProgress({
          type: 'extract',
          file: path.basename(archivePath),
          progress: 50
        });
      });

      process.stderr.on('data', (data) => {
        errorBuffer += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          this.onLog(`Extracted: ${path.basename(archivePath)}`);
          this.onProgress({
            type: 'extract',
            file: path.basename(archivePath),
            progress: 100
          });
          resolve();
        } else {
          const errorMsg = `7z extraction failed with code ${code}: ${errorBuffer || outputBuffer}`;
          this.onLog(`Extraction error: ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      });

      process.on('error', (err) => {
        let errorMsg = err.message;
        if (err.code === 'ENOENT') {
          errorMsg = '7-Zipが見つかりません。7-Zipをインストールしてください。\n' +
                     'ダウンロード: https://www.7-zip.org/download.html\n' +
                     'または、以下のパスに7z.exeを配置してください:\n' +
                     'C:\\Program Files\\7-Zip\\7z.exe';
        }
        this.onLog(`Extraction error: ${errorMsg}`);
        reject(new Error(errorMsg));
      });
    });
  }

  get7zBinPath() {
    // Check for bundled 7za.exe first
    const isDev = process.env.NODE_ENV === 'development' || !process.resourcesPath;

    if (process.platform === 'win32') {
      // Try bundled 7za.exe first (highest priority)
      const bundledPaths = isDev
        ? [path.join(__dirname, '../build/tools/7z/7za.exe')]
        : [
            path.join(process.resourcesPath, 'tools', '7z', '7za.exe'),
            path.join(path.dirname(process.execPath), 'tools', '7z', '7za.exe')
          ];

      for (const p of bundledPaths) {
        if (fs.existsSync(p)) {
          this.onLog(`Found bundled 7-Zip at: ${p}`);
          return p;
        }
      }

      // Fallback to system-installed 7-Zip
      const systemPaths = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', '7-Zip', '7z.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe')
      ];

      for (const p of systemPaths) {
        if (fs.existsSync(p)) {
          this.onLog(`Found system 7-Zip at: ${p}`);
          return p;
        }
      }

      // If not found, return first path (will fail with clear error)
      this.onLog('7-Zip not found. Please install 7-Zip or place 7za.exe in build/tools/7z/');
      return '7z.exe';
    }

    // Use 7z from PATH (Linux/Mac)
    return '7z';
  }

  async downloadAndInstallEngine(engineType) {
    const engineInfo = ENGINE_TYPES[engineType];
    if (!engineInfo) {
      throw new Error(`Unknown engine type: ${engineType}`);
    }

    this.onLog(`Installing ${engineInfo.name}...`);

    // Create temp directory for downloads
    // Use custom tempDir if provided, otherwise use engineDir/.temp
    const tempDir = this.tempDir
      ? path.join(this.tempDir, 'voicevox-engine-download')
      : path.join(this.engineDir, '.temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      // Download all parts
      const downloadedFiles = [];
      for (let i = 0; i < engineInfo.urls.length; i++) {
        const url = engineInfo.urls[i];
        const filename = path.basename(url);
        const destPath = path.join(tempDir, filename);

        this.onProgress({
          type: 'overall',
          step: `Downloading part ${i + 1}/${engineInfo.urls.length}`,
          progress: (i / (engineInfo.urls.length + 1)) * 100
        });

        await this.downloadFile(url, destPath);
        downloadedFiles.push(destPath);
      }

      // Extract (first file for multi-part archives)
      this.onProgress({
        type: 'overall',
        step: 'Extracting files...',
        progress: 80
      });

      const extractDir = path.join(this.engineDir, engineType);
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }

      await this.extract7z(downloadedFiles[0], extractDir);

      // Move contents from nested directory to extractDir root
      // Archives usually extract to voicevox_engine-windows-xxx-x.xx.x/
      const extractedItems = fs.readdirSync(extractDir);
      this.onLog(`Extracted items: ${extractedItems.join(', ')}`);

      // Look for any directory that looks like a version directory (e.g., windows-nvidia, voicevox_engine-xxx)
      let movedFromNestedDir = false;
      let nestedDirName = null;

      for (const item of extractedItems) {
        const itemPath = path.join(extractDir, item);
        const stat = fs.statSync(itemPath);

        // Check if it's a directory that might contain the actual engine files
        if (stat.isDirectory()) {
          const runExeInNested = path.join(itemPath, 'run.exe');

          // If this directory has run.exe but the parent doesn't, move contents up
          if (fs.existsSync(runExeInNested) && !fs.existsSync(path.join(extractDir, 'run.exe'))) {
            this.onLog(`Found nested engine directory: ${item}, moving contents up...`);
            nestedDirName = item; // Remember which directory we moved from

            // Move all contents from nested dir to extractDir
            const contents = fs.readdirSync(itemPath);
            for (const content of contents) {
              const srcPath = path.join(itemPath, content);
              const destPath = path.join(extractDir, content);

              // Skip if destination already exists
              if (!fs.existsSync(destPath)) {
                fs.renameSync(srcPath, destPath);
              }
            }

            // Remove the now-empty (or leftover) nested directory
            try {
              const remaining = fs.readdirSync(itemPath);
              // Remove any remaining files
              for (const file of remaining) {
                fs.unlinkSync(path.join(itemPath, file));
              }
              fs.rmdirSync(itemPath);
              this.onLog(`Removed nested directory: ${item}`);
              movedFromNestedDir = true;
            } catch (err) {
              this.onLog(`Warning: Could not fully remove nested directory: ${err.message}`);
            }
          }
        }
      }

      // IMPORTANT: Do NOT delete other subdirectories like engine_internal, model, resources
      // These are required for the engine to run!

      // Verify run.exe exists at the correct location
      const finalRunExe = path.join(extractDir, 'run.exe');
      if (!fs.existsSync(finalRunExe)) {
        this.onLog('WARNING: run.exe not found at expected location after extraction');
      } else {
        this.onLog('Successfully verified run.exe location');
      }

      // Clean up temp files
      this.onLog('Cleaning up temporary files...');
      for (const file of downloadedFiles) {
        fs.unlinkSync(file);
      }
      fs.rmdirSync(tempDir);

      this.onProgress({
        type: 'overall',
        step: 'Complete!',
        progress: 100
      });

      this.onLog(`Successfully installed ${engineInfo.name}`);

      return {
        success: true,
        engineType,
        path: extractDir
      };

    } catch (error) {
      // Clean up on error
      if (fs.existsSync(tempDir)) {
        try {
          const files = fs.readdirSync(tempDir);
          for (const file of files) {
            fs.unlinkSync(path.join(tempDir, file));
          }
          fs.rmdirSync(tempDir);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      throw error;
    }
  }

  async checkEngineInstalled(engineType) {
    const engineDir = path.join(this.engineDir, engineType);
    this.onLog(`Checking engine installation at: ${engineDir}`);

    if (!fs.existsSync(engineDir)) {
      this.onLog(`Engine directory does not exist: ${engineDir}`);
      return false;
    }

    // List contents of engine directory for debugging
    try {
      const contents = fs.readdirSync(engineDir);
      this.onLog(`Engine directory contents: ${contents.join(', ')}`);

      // Check if there's a nested directory with run.exe
      if (contents.length === 1 && fs.statSync(path.join(engineDir, contents[0])).isDirectory()) {
        const nestedPath = path.join(engineDir, contents[0]);
        const nestedRunExe = path.join(nestedPath, 'run.exe');
        if (fs.existsSync(nestedRunExe)) {
          this.onLog(`WARNING: Found nested structure with run.exe at: ${nestedPath}`);
          this.onLog(`This indicates the directory structure needs to be fixed.`);
          // Still return false to trigger the fix
          return false;
        }
      }
    } catch (err) {
      this.onLog(`Error reading engine directory: ${err.message}`);
    }

    // Check for run.exe at expected location
    const runExe = path.join(engineDir, 'run.exe');
    const exists = fs.existsSync(runExe);
    this.onLog(`run.exe exists at ${runExe}: ${exists}`);
    return exists;
  }

  async getInstalledEngines() {
    const installed = [];

    for (const [type, info] of Object.entries(ENGINE_TYPES)) {
      if (await this.checkEngineInstalled(type)) {
        // Return just the type string, not an object
        installed.push(type);
      }
    }

    return installed;
  }

  async removeEngine(engineType) {
    const engineDir = path.join(this.engineDir, engineType);
    if (fs.existsSync(engineDir)) {
      this.onLog(`Removing ${engineType} engine...`);
      this.removeDirectory(engineDir);
      this.onLog(`Removed ${engineType} engine`);
      return true;
    }
    return false;
  }

  removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          this.removeDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(dirPath);
    }
  }
}

module.exports = {
  EngineDownloader,
  ENGINE_TYPES,
  ENGINE_VERSION
};
