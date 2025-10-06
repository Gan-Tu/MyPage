#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { cpus } from 'node:os';
import { join, resolve, extname, basename, dirname, relative } from 'node:path';
import process from 'node:process';

import fg from 'fast-glob';
import sharp from 'sharp';

const SUPPORTED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.avif', '.heic', '.heif']);

const DEFAULTS = {
  maxMasterBytes: 20 * 1024 * 1024,
  minShortSide: 1024,
  masterStartQuality: 85,
  masterMinQuality: 50,
  qualityStep: 5,
  thumbnail: {
    width: 1024,
    height: 768,
    maxBytes: 2 * 1024 * 1024,
    startQuality: 80,
    minQuality: 40,
    qualityStep: 5,
  },
};

function usage(message) {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.error(`\nUsage: node scripts/optimize-media.mjs <inputDir> [--concurrency N] [--dry-run] [--force]\n`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  let inputDir = null;
  let concurrency = Math.max(2, Math.min(6, cpus().length));
  let dryRun = false;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      if (inputDir) {
        usage('Multiple input directories provided.');
      }
      inputDir = arg;
      continue;
    }

    switch (arg) {
      case '--concurrency': {
        const next = argv[i + 1];
        if (!next) usage('Missing value for --concurrency.');
        const value = Number.parseInt(next, 10);
        if (Number.isNaN(value) || value <= 0) usage('Invalid concurrency value.');
        concurrency = value;
        i += 1;
        break;
      }
      case '--dry-run':
        dryRun = true;
        break;
      case '--force':
        force = true;
        break;
      case '--help':
        usage();
        break;
      default:
        usage(`Unknown option ${arg}`);
    }
  }

  if (!inputDir) usage('Input directory is required.');

  return { inputDir: resolve(inputDir), concurrency, dryRun, force };
}

function isImageFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_IMAGE_EXTS.has(ext);
}

function getFormat(ext) {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'jpeg';
    case '.png':
      return 'png';
    case '.webp':
      return 'webp';
    case '.tif':
    case '.tiff':
      return 'tiff';
    case '.avif':
      return 'avif';
    case '.heic':
    case '.heif':
      return 'heif';
    default:
      return null;
  }
}

function applyOutputFormat(pipeline, format, quality) {
  const clampedQuality = Math.max(1, Math.min(100, Math.round(quality)));
  switch (format) {
    case 'jpeg':
      pipeline.jpeg({ quality: clampedQuality, mozjpeg: true, progressive: true });
      break;
    case 'png':
      pipeline.png({ compressionLevel: 9, quality: clampedQuality, palette: true });
      break;
    case 'webp':
      pipeline.webp({ quality: clampedQuality });
      break;
    case 'tiff':
      pipeline.tiff({ quality: clampedQuality, compression: 'jpeg' });
      break;
    case 'avif':
      pipeline.avif({ quality: clampedQuality });
      break;
    case 'heif':
      pipeline.heif({ quality: clampedQuality });
      break;
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

function computeResizeOptions(metadata, targetShortSide) {
  const { width, height } = metadata;
  if (!width || !height || !Number.isFinite(targetShortSide)) return null;
  const shortSide = Math.min(width, height);
  if (targetShortSide >= shortSide) return null;
  if (width <= height) {
    return { width: targetShortSide, withoutEnlargement: true };
  }
  return { height: targetShortSide, withoutEnlargement: true };
}

async function renderBuffer({ filePath, format, metadata, targetShortSide, quality }) {
  const pipeline = sharp(filePath, { failOnError: false }).rotate();
  const resizeOptions = computeResizeOptions(metadata, targetShortSide);
  if (resizeOptions) {
    pipeline.resize({ ...resizeOptions, fit: 'inside' });
  }
  applyOutputFormat(pipeline, format, quality);
  return pipeline.toBuffer();
}

async function writeFileAtomic(filePath, buffer, dryRun) {
  if (dryRun) {
    return;
  }
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, filePath);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function optimizePrimaryImage({ filePath, metadata, format, stats, options }) {
  const {
    maxMasterBytes,
    minShortSide,
    masterStartQuality,
    masterMinQuality,
    qualityStep,
    dryRun,
  } = options;

  const originalSize = stats.size;
  const shortSide = metadata.width && metadata.height ? Math.min(metadata.width, metadata.height) : null;

  if (originalSize <= maxMasterBytes && (shortSide === null || shortSide <= minShortSide)) {
    return {
      optimized: false,
      originalSize,
      optimizedSize: originalSize,
      quality: null,
      shortSide,
      skipped: true,
    };
  }

  let targetShortSide = shortSide ?? Number.POSITIVE_INFINITY;
  let quality = masterStartQuality;

  if (shortSide !== null && shortSide < minShortSide) {
    targetShortSide = shortSide;
  }

  let lastBuffer = null;
  let lastQuality = quality;
  let lastShortSide = targetShortSide;

  while (true) {
    const buffer = await renderBuffer({ filePath, format, metadata, targetShortSide, quality });
    if (buffer.length <= maxMasterBytes || (targetShortSide <= minShortSide && quality <= masterMinQuality)) {
      lastBuffer = buffer;
      lastQuality = quality;
      lastShortSide = targetShortSide;
      break;
    }

    if (quality > masterMinQuality) {
      quality = Math.max(masterMinQuality, quality - qualityStep);
      continue;
    }

    if (shortSide !== null && targetShortSide > minShortSide) {
      const nextShortSide = Math.max(minShortSide, Math.floor(targetShortSide * 0.9));
      if (nextShortSide === targetShortSide) {
        targetShortSide = minShortSide;
      } else {
        targetShortSide = nextShortSide;
      }
      continue;
    }

    lastBuffer = buffer;
    lastQuality = quality;
    lastShortSide = targetShortSide;
    break;
  }

  if (!lastBuffer) return { skipped: true };

  await writeFileAtomic(filePath, lastBuffer, dryRun);

  const optimizedSize = lastBuffer.length;
  const resizedMetadata = await sharp(lastBuffer).metadata();
  const resultShortSide = resizedMetadata.width && resizedMetadata.height
    ? Math.min(resizedMetadata.width, resizedMetadata.height)
    : lastShortSide;

  return {
    optimized: optimizedSize < originalSize,
    originalSize,
    optimizedSize,
    quality: lastQuality,
    shortSide: resultShortSide,
  };
}

async function generateThumbnail({ filePath, format, options, force }) {
  const { thumbnail, dryRun } = options;
  const dir = dirname(filePath);
  const ext = extname(filePath);
  const baseName = basename(filePath, ext);
  const thumbnailPath = join(dir, `${baseName}_thumbnail${ext}`);

  if (!force && await fileExists(thumbnailPath)) {
    return { skipped: true, path: thumbnailPath, reason: 'exists' };
  }

  let quality = thumbnail.startQuality;
  let outputBuffer = null;

  while (true) {
    const pipeline = sharp(filePath, { failOnError: false }).rotate();
    pipeline.resize({
      width: thumbnail.width,
      height: thumbnail.height,
      fit: 'inside',
      withoutEnlargement: true,
    });
    applyOutputFormat(pipeline, format, quality);
    const buffer = await pipeline.toBuffer();
    outputBuffer = buffer;
    if (buffer.length <= thumbnail.maxBytes || quality <= thumbnail.minQuality) {
      break;
    }
    const nextQuality = Math.max(thumbnail.minQuality, quality - thumbnail.qualityStep);
    if (nextQuality === quality) {
      break;
    }
    quality = nextQuality;
  }

  if (!outputBuffer) {
    return { skipped: true, path: thumbnailPath };
  }

  if (!dryRun) {
    await ensureDir(dir);
    const tempPath = `${thumbnailPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, outputBuffer);
    await fs.rename(tempPath, thumbnailPath);
  }

  return {
    path: thumbnailPath,
    size: outputBuffer.length,
    quality,
    created: true,
  };
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const runners = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        break;
      }
      await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(runners);
}

async function processFile(filePath, context) {
  const { options, summary, inputDir, force } = context;
  const relativePath = relative(inputDir, filePath);
  const ext = extname(filePath).toLowerCase();
  const format = getFormat(ext);

  if (!format) {
    summary.skipped += 1;
    return;
  }

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (error) {
    summary.failures += 1;
    summary.errors.push({ file: relativePath, error });
    console.error(`Failed to stat ${relativePath}: ${error.message}`);
    return;
  }

  if (!stats.isFile()) {
    summary.skipped += 1;
    return;
  }

  let metadata;
  try {
    metadata = await sharp(filePath, { failOnError: false }).metadata();
  } catch (error) {
    summary.failures += 1;
    summary.errors.push({ file: relativePath, error });
    console.error(`Failed to read metadata for ${relativePath}: ${error.message}`);
    return;
  }

  try {
    const masterResult = await optimizePrimaryImage({
      filePath,
      metadata,
      format,
      stats,
      options,
    });

    if (masterResult.optimized) {
      summary.optimized += 1;
      const saved = masterResult.originalSize - masterResult.optimizedSize;
      summary.bytesSaved += saved;
      console.log(`Optimized ${relativePath}: saved ${formatBytes(saved)}${masterResult.quality ? ` (quality ${masterResult.quality})` : ''}`);
    } else if (masterResult.skipped) {
      summary.unchanged += 1;
    } else {
      summary.unchanged += 1;
    }

    const thumbResult = await generateThumbnail({
      filePath,
      format,
      options,
      force,
    });

    if (thumbResult.created) {
      summary.thumbnailsCreated += 1;
    } else if (thumbResult.skipped) {
      summary.thumbnailsSkipped += 1;
    }
  } catch (error) {
    summary.failures += 1;
    summary.errors.push({ file: relativePath, error });
    console.error(`Failed to process ${relativePath}: ${error.message}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { inputDir, concurrency, dryRun, force } = parsed;

  let inputStats;
  try {
    inputStats = await fs.stat(inputDir);
  } catch (error) {
    usage(`Input directory not accessible: ${error.message}`);
  }

  if (!inputStats.isDirectory()) {
    usage('Input path must be a directory.');
  }

  const patterns = ['**/*.{jpg,jpeg,png,webp,tif,tiff,avif,heic,heif}'];
  const candidates = await fg(patterns, {
    cwd: inputDir,
    absolute: true,
    caseSensitiveMatch: false,
    followSymbolicLinks: false,
  });

  const files = candidates.filter((filePath) => {
    const ext = extname(filePath);
    const baseName = basename(filePath, ext).toLowerCase();
    if (baseName.endsWith('_thumbnail')) {
      return false;
    }
    return isImageFile(filePath);
  });

  if (files.length === 0) {
    console.log('No matching images found.');
    return;
  }

  const options = {
    ...DEFAULTS,
    thumbnail: { ...DEFAULTS.thumbnail },
    dryRun,
  };

  const summary = {
    total: files.length,
    optimized: 0,
    unchanged: 0,
    skipped: 0,
    thumbnailsCreated: 0,
    thumbnailsSkipped: 0,
    failures: 0,
    bytesSaved: 0,
    errors: [],
  };

  console.log(`Processing ${files.length} image(s) from ${inputDir} using concurrency ${concurrency}${dryRun ? ' (dry run)' : ''}...`);

  await runWithConcurrency(files, concurrency, (filePath) => processFile(filePath, {
    options,
    summary,
    inputDir,
    force,
  }));

  const processed = summary.optimized + summary.unchanged;
  console.log('\nDone.');
  console.log(`Processed: ${processed}/${summary.total}`);
  console.log(`Optimized: ${summary.optimized}`);
  console.log(`Unchanged: ${summary.unchanged}`);
  console.log(`Skipped (unsupported or non-file): ${summary.skipped}`);
  console.log(`Thumbnails created: ${summary.thumbnailsCreated}`);
  console.log(`Thumbnails skipped: ${summary.thumbnailsSkipped}`);
  console.log(`Bytes saved: ${formatBytes(summary.bytesSaved)}`);

  if (summary.failures > 0) {
    console.log(`Failures: ${summary.failures}`);
    for (const failure of summary.errors) {
      console.log(` - ${failure.file}: ${failure.error.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
