const DEFAULT_BUCKET =
  process.env.PHOTOGRAPHY_BUCKET ||
  process.env.NEXT_PUBLIC_PHOTOGRAPHY_BUCKET ||
  'tugan-photos'

const COVER_FILENAMES = new Set([
  'album-cover.jpg',
  'album-cover.jpeg',
  'album-cover.png',
])

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
      const credentials = decodeServiceAccountKey(
        process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      )

      const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT

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

    const albumEntry =
      albums.get(albumName) || {
        photos: [],
        coverPhoto: null,
      }

    const fileName = photoSegments[photoSegments.length - 1]
    const photo = {
      name: photoSegments[photoSegments.length - 1],
      path: file.name,
      url: buildPublicUrl(bucketName, file.name),
      updated: file.updated || null,
      size: file.size ? Number(file.size) : null,
      contentType: file.contentType || null,
    }

    albumEntry.photos.push(photo)

    if (fileName && COVER_FILENAMES.has(fileName.toLowerCase())) {
      albumEntry.coverPhoto = photo
    }

    albums.set(albumName, albumEntry)
  }

  const orderedAlbums = Array.from(albums.entries()).map(([name, data]) => {
    const sortedPhotos = [...data.photos].sort((a, b) =>
      a.path.localeCompare(b.path, undefined, { numeric: true })
    )

    let totalMillis = 0
    let countedPhotos = 0
    const mostRecentUpdate = sortedPhotos.reduce((latest, photo) => {
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

    return {
      name,
      photoCount: sortedPhotos.length,
      updatedAt: mostRecentUpdate ? new Date(mostRecentUpdate).toISOString() : null,
      averageUpdatedAt,
      coverPhoto: data.coverPhoto || sortedPhotos[0] || null,
      photos: sortedPhotos,
    }
  })

  orderedAlbums.sort((a, b) => {
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

    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })

  return orderedAlbums
}

export function getPhotoAlbumsSummary(albums) {
  if (!Array.isArray(albums)) {
    return { albumCount: 0, photoCount: 0 }
  }

  return albums.reduce(
    (acc, album) => {
      acc.albumCount += 1
      acc.photoCount += album.photoCount || 0
      return acc
    },
    { albumCount: 0, photoCount: 0 }
  )
}
