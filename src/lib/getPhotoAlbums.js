const DEFAULT_BUCKET =
  process.env.PHOTOGRAPHY_BUCKET ||
  process.env.NEXT_PUBLIC_PHOTOGRAPHY_BUCKET ||
  'tugan-photos'

const COVER_FILENAMES = new Set([
  'album-cover.jpg',
  'album-cover.jpeg',
  'album-cover.png',
])

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi'])
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'avif',
  'webp',
  'bmp',
  'heic',
  'heif',
  'tif',
  'tiff',
])

const THUMBNAIL_SUFFIX = '_thumbnail'

function normalizePhotoFileName(fileName) {
  if (!fileName) {
    return { baseName: fileName, isThumbnail: false }
  }

  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return { baseName: fileName, isThumbnail: false }
  }

  const nameWithoutExtension = fileName.slice(0, lastDotIndex)
  const extension = fileName.slice(lastDotIndex)

  if (nameWithoutExtension.endsWith(THUMBNAIL_SUFFIX)) {
    return {
      baseName: `${nameWithoutExtension.slice(0, -THUMBNAIL_SUFFIX.length)}${extension}`,
      isThumbnail: true,
    }
  }

  return { baseName: fileName, isThumbnail: false }
}

function determineMediaType(fileName, contentType) {
  if (typeof contentType === 'string') {
    if (contentType.startsWith('video/')) {
      return 'video'
    }
    if (contentType.startsWith('image/')) {
      return 'image'
    }
  }

  if (!fileName) {
    return 'unknown'
  }

  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return 'unknown'
  }

  const extension = fileName.slice(lastDotIndex + 1).toLowerCase()
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image'
  }

  return 'unknown'
}

let storageClientPromise

function decodeServiceAccountKey(rawKey) {
  if (!rawKey) {
    return undefined
  }

  const trimmed = rawKey.trim()
  if (!trimmed) {
    return undefined
  }

  let jsonString = trimmed
  const looksLikeJson = trimmed.startsWith('{') && trimmed.endsWith('}')

  if (!looksLikeJson) {
    try {
      jsonString = Buffer.from(trimmed, 'base64').toString('utf8')
    } catch (error) {
      // If decoding fails we fall back to the raw string; Storage will error later with context.
      jsonString = trimmed
    }
  }

  try {
    return JSON.parse(jsonString)
  } catch (error) {
    throw new Error('Unable to parse GCP service account credentials; make sure the JSON is valid or base64 encoded.')
  }
}

async function getStorageClient() {
  if (!storageClientPromise) {
    storageClientPromise = import('@google-cloud/storage').then(({ Storage }) => {
      const credentials = decodeServiceAccountKey(process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      )

      const projectId = process.env.GOOGLE_CLOUD_PROJECT

      return new Storage({
        projectId: projectId || undefined,
        credentials: credentials || undefined,
      })
    })
  }

  return storageClientPromise
}

function buildPublicUrl(bucketName, objectName) {
  const encodedPath = objectName
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`
}

export async function getPhotoAlbums({ bucketName = DEFAULT_BUCKET } = {}) {
  if (!bucketName) {
    throw new Error('A Google Cloud Storage bucket must be provided to load photo albums.')
  }

  const storage = await getStorageClient()
  const bucket = storage.bucket(bucketName)

  let files

  try {
    ;[files] = await bucket.getFiles({ autoPaginate: true })
  } catch (error) {
    const reason =
      error?.message ||
      'Unable to load objects from Google Cloud Storage. Check credentials and permissions.'
    throw new Error(reason)
  }

  const albums = new Map()

  for (const file of files) {
    if (!file.name || file.name.endsWith('/')) {
      continue
    }

    const segments = file.name.split('/')
    if (segments.length === 0) {
      continue
    }

    const albumName = segments[0]
    const photoSegments = segments.slice(1)

    if (!albumName || photoSegments.length === 0) {
      // Skip files without an album prefix or at the bucket root.
      continue
    }

    if (segments.some((segment) => segment.toLowerCase() === '.ds_store')) {
      continue
    }

    const albumEntry =
      albums.get(albumName) || {
        photoMap: new Map(),
        coverPhotoKey: null,
      }

    const fileName = photoSegments[photoSegments.length - 1]
    const mediaType = determineMediaType(fileName, file.contentType)
    const { baseName, isThumbnail } = normalizePhotoFileName(fileName)

    if (mediaType === 'video' || mediaType === 'unknown') {
      const videoUrl = buildPublicUrl(bucketName, file.name)
      const videoEntry = {
        name: fileName,
        path: file.name,
        url: videoUrl,
        originalUrl: videoUrl,
        updated: file.metadata.updated || null,
        size: file.metadata.size ? Number(file.metadata.size) : null,
        contentType: file.metadata.contentType || null,
        mediaType,
        sortKey: file.name,
      }

      albumEntry.photoMap.set(file.name, videoEntry)

      if (fileName && COVER_FILENAMES.has(fileName.toLowerCase())) {
        albumEntry.coverPhotoKey = file.name
      }

      albums.set(albumName, albumEntry)
      continue
    }

    const normalizedSegments = [...photoSegments]
    if (isThumbnail) {
      normalizedSegments[normalizedSegments.length - 1] = baseName
    }

    const baseObjectPath = [albumName, ...normalizedSegments].join('/')
    const existingEntry = albumEntry.photoMap.get(baseObjectPath) || {
      name: baseName,
      path: baseObjectPath,
      originalPath: null,
      previewPath: null,
      url: null,
      originalUrl: null,
      previewUrl: null,
      updated: null,
      size: null,
      contentType: null,
      mediaType,
      sortKey: baseObjectPath,
    }

    if (isThumbnail) {
      const previewUrl = buildPublicUrl(bucketName, file.name)
      existingEntry.previewUrl = previewUrl
      existingEntry.previewPath = file.name
      existingEntry.url = previewUrl
      if (!existingEntry.originalUrl) {
        existingEntry.originalUrl = previewUrl
      }
      if (!existingEntry.path || existingEntry.path === baseObjectPath) {
        existingEntry.path = existingEntry.originalPath || file.name
      }
      if (!existingEntry.updated && file.metadata.updated) {
        existingEntry.updated = file.metadata.updated
      }
      if (!existingEntry.size && file.metadata.size) {
        existingEntry.size = Number(file.metadata.size)
      }
      if (!existingEntry.contentType && file.metadata.contentType) {
        existingEntry.contentType = file.metadata.contentType
      }
    } else {
      const originalUrl = buildPublicUrl(bucketName, file.name)
      existingEntry.name = baseName
      existingEntry.originalPath = file.name
      existingEntry.originalUrl = originalUrl
      existingEntry.url = existingEntry.previewUrl || originalUrl
      existingEntry.updated = file.metadata.updated || existingEntry.updated
      existingEntry.size = file.metadata.size ? Number(file.metadata.size) : existingEntry.size
      existingEntry.contentType = file.metadata.contentType || existingEntry.contentType
      existingEntry.path = file.name
    }

    albumEntry.photoMap.set(baseObjectPath, existingEntry)

    if (fileName && COVER_FILENAMES.has(fileName.toLowerCase())) {
      albumEntry.coverPhotoKey = baseObjectPath
    }

    albums.set(albumName, albumEntry)
  }

  const transformPhotoEntry = (entry) => {
    if (!entry) {
      return null
    }

    const path = entry.originalPath || entry.previewPath || entry.path
    const url = entry.previewUrl || entry.url || entry.originalUrl
    const originalUrl = entry.originalUrl || entry.previewUrl || entry.url

    return {
      name: entry.name,
      path,
      url,
      originalUrl,
      updated: entry.updated || null,
      size: entry.size || null,
      contentType: entry.contentType || null,
      mediaType: entry.mediaType || null,
    }
  }

  const orderedAlbums = Array.from(albums.entries()).map(([name, data]) => {
    const photoEntries = Array.from(data.photoMap.values())
    const normalizedPhotos = photoEntries
      .map(transformPhotoEntry)
      .filter(Boolean)

    normalizedPhotos.sort((a, b) =>
      (a.path || '').localeCompare(b.path || '', undefined, { numeric: true })
    )

    let totalMillis = 0
    let countedPhotos = 0
    const mostRecentUpdate = normalizedPhotos.reduce((latest, photo) => {
      if (!photo.updated) {
        return latest
      }
      const time = new Date(photo.updated).getTime()
      if (!Number.isFinite(time)) {
        return latest
      }
      totalMillis += time
      countedPhotos += 1
      return Math.max(latest, time)
    }, 0)

    const averageMillis = countedPhotos > 0 ? totalMillis / countedPhotos : null
    const averageUpdatedAt = averageMillis ? new Date(averageMillis).toISOString() : null

    const coverEntry = data.coverPhotoKey ? data.photoMap.get(data.coverPhotoKey) : null
    const coverPhotoCandidate = transformPhotoEntry(coverEntry)

    const coverPhoto =
      coverPhotoCandidate && coverPhotoCandidate.mediaType === 'image'
        ? coverPhotoCandidate
        : normalizedPhotos.find((item) => item.mediaType === 'image') ||
          coverPhotoCandidate ||
          normalizedPhotos[0] ||
          null

    const imageCount = normalizedPhotos.filter((item) => item.mediaType === 'image').length
    const videoCount = normalizedPhotos.filter((item) => item.mediaType === 'video').length

    return {
      name,
      photoCount: imageCount,
      videoCount,
      itemCount: normalizedPhotos.length,
      updatedAt: mostRecentUpdate ? new Date(mostRecentUpdate).toISOString() : null,
      averageUpdatedAt,
      coverPhoto,
      photos: normalizedPhotos,
    }
  })

  orderedAlbums.sort((a, b) => {
    // Extract year from album name (YYYY format)
    const aYearMatch = a.name.match(/\b(\d{4})\b/)
    const bYearMatch = b.name.match(/\b(\d{4})\b/)
    const aYear = aYearMatch ? parseInt(aYearMatch[1], 10) : null
    const bYear = bYearMatch ? parseInt(bYearMatch[1], 10) : null

    // Sort by year first (descending - most recent first)
    if (aYear !== null && bYear !== null) {
      return bYear - aYear
    }
    if (aYear !== null) {
      return -1
    }
    if (bYear !== null) {
      return 1
    }

    // Fallback to average updated time
    const aTime = a.averageUpdatedAt ? new Date(a.averageUpdatedAt).getTime() : null
    const bTime = b.averageUpdatedAt ? new Date(b.averageUpdatedAt).getTime() : null

    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
      return bTime - aTime
    }
    if (Number.isFinite(aTime)) {
      return -1
    }
    if (Number.isFinite(bTime)) {
      return 1
    }

    // Fallback to latest updated time
    const aLatest = a.updatedAt ? new Date(a.updatedAt).getTime() : null
    const bLatest = b.updatedAt ? new Date(b.updatedAt).getTime() : null

    if (Number.isFinite(aLatest) && Number.isFinite(bLatest)) {
      return bLatest - aLatest
    }
    if (Number.isFinite(aLatest)) {
      return -1
    }
    if (Number.isFinite(bLatest)) {
      return 1
    }

    // Final fallback to name comparison
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })

  return orderedAlbums
}

export function getPhotoAlbumsSummary(albums) {
  if (!Array.isArray(albums)) {
    return { albumCount: 0, photoCount: 0, videoCount: 0, itemCount: 0 }
  }

  return albums.reduce(
    (acc, album) => {
      acc.albumCount += 1
      acc.photoCount += album.photoCount || 0
      acc.videoCount += album.videoCount || 0
      acc.itemCount += album.itemCount || album.photos?.length || 0
      return acc
    },
    { albumCount: 0, photoCount: 0, videoCount: 0, itemCount: 0 }
  )
}
