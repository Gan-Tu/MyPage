import { Dialog, Transition } from '@headlessui/react';
import { Image, ImageKitProvider, Video } from '@imagekit/next';
import Head from 'next/head';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SimpleLayout } from '@/components/SimpleLayout';
import { getPaginatedPhotoAlbums } from '@/lib/getPhotoAlbums';

const DEFAULT_LIGHTBOX_BACKGROUND =
  ' bg-black/90 backdrop-blur-sm dark:bg-black/95 dark:backdrop-blur '

function ArrowLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" {...props}>
      <path
        d="m14.25 6.75-4.5 4.5 4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" {...props}>
      <path
        d="m9.75 6.75 4.5 4.5-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" {...props}>
      <path
        d="M12 5.25v13.5M5.25 12h13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MinusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" {...props}>
      <path
        d="M5.25 12h13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatAlbumName(name) {
  if (!name) {
    return 'Album'
  }

  return name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatTimestamp(value) {
  if (!value) {
    return null
  }

  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    return null
  }
}

function isVideo(media) {
  if (!media) {
    return false
  }

  if (media.mediaType) {
    return media.mediaType === 'video'
  }

  const contentType = media.contentType
  return typeof contentType === 'string' && contentType.startsWith('video/')
}

function formatMediaCounts({ photoCount = 0, videoCount = 0 }) {
  const parts = []

  if (photoCount > 0) {
    parts.push(`${photoCount} photo${photoCount === 1 ? '' : 's'}`)
  }

  if (videoCount > 0) {
    parts.push(`${videoCount} video${videoCount === 1 ? '' : 's'}`)
  }

  return parts.join(' • ')
}

export default function Photography({
  initialAlbums,
  initialSummary,
  initialPagination,
  lastGeneratedAt,
  error,
}) {
  const [albums, setAlbums] = useState(() =>
    Array.isArray(initialAlbums) ? [...initialAlbums] : []
  )
  const [summary, setSummary] = useState(initialSummary || null)
  const [pagination, setPagination] = useState(() =>
    initialPagination
      ? { ...initialPagination }
      : {
        page: 1,
        pageSize: 9,
        totalAlbums: Array.isArray(initialAlbums) ? initialAlbums.length : 0,
        totalPages: 0,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      }
  )
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(null)
  const [albumDetails, setAlbumDetails] = useState({})
  const [loadingAlbumName, setLoadingAlbumName] = useState(null)
  const [albumDetailError, setAlbumDetailError] = useState(null)
  const [selectedAlbumName, setSelectedAlbumName] = useState(null)
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(null)
  const [photoDimensions, setPhotoDimensions] = useState({})

  const INITIAL_ZOOM = 1
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 3
  const ZOOM_STEP = 0.25
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM)
  const [isDragging, setIsDragging] = useState(false)
  const [shareCopyStatus, setShareCopyStatus] = useState('idle')
  const scrollContainerRef = useRef(null)
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  })
  const shareCopyTimeoutRef = useRef(null)
  const loadMoreTriggerRef = useRef(null)
  const pendingAlbumQueryRef = useRef(null)

  const router = useRouter()
  const routerIsReady = router?.isReady
  const albumQueryParam = router?.query?.album

  const selectAlbum = useCallback(
    (albumName) => {
      setSelectedAlbumName(albumName)
      setLightboxPhotoIndex(null)
      setZoomLevel(INITIAL_ZOOM)
      setIsDragging(false)
      setAlbumDetailError(null)
    },
    [INITIAL_ZOOM]
  )

  const ensureAlbumDetails = useCallback(
    async (albumName) => {
      if (!albumName) {
        return
      }

      const existingDetails = albumDetails[albumName]
      if (existingDetails?.isHydrated) {
        return
      }

      if (loadingAlbumName === albumName) {
        return
      }

      setAlbumDetailError(null)
      setLoadingAlbumName(albumName)

      try {
        const response = await fetch(`/api/photo-albums/${encodeURIComponent(albumName)}`)
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}))
          const reason = errorPayload?.error || 'Unable to load the requested album.'
          throw new Error(reason)
        }

        const payload = await response.json().catch(() => null)
        const album = payload?.album

        if (!album) {
          throw new Error('Received an unexpected response while loading the album.')
        }

        setAlbumDetails((current) => ({
          ...current,
          [albumName]: album,
        }))

        const { photos: _ignoredPhotos, ...metadata } = album

        setAlbums((current) => {
          const existingIndex = current.findIndex((item) => item.name === albumName)

          const nextEntry = {
            ...metadata,
            isHydrated: true,
          }

          if (existingIndex === -1) {
            return [...current, nextEntry]
          }

          const next = [...current]
          next[existingIndex] = {
            ...next[existingIndex],
            ...nextEntry,
          }
          return next
        })
      } catch (fetchError) {
        const reason = fetchError?.message || 'Unable to load the requested album.'
        setAlbumDetailError(reason)
      } finally {
        setLoadingAlbumName((current) => (current === albumName ? null : current))
      }
    },
    [albumDetails, loadingAlbumName, setAlbumDetails, setAlbums, setAlbumDetailError, setLoadingAlbumName]
  )

  useEffect(() => {
    if (!routerIsReady) {
      return
    }

    const albumNameFromQuery = Array.isArray(albumQueryParam)
      ? albumQueryParam[0]
      : albumQueryParam

    if (!albumNameFromQuery) {
      if (pendingAlbumQueryRef.current) {
        return
      }
      if (selectedAlbumName !== null) {
        selectAlbum(null)
      }
      return
    }

    if (pendingAlbumQueryRef.current) {
      pendingAlbumQueryRef.current = null
    }

    setAlbums((current) => {
      if (current.some((album) => album.name === albumNameFromQuery)) {
        return current
      }

      return [
        ...current,
        {
          name: albumNameFromQuery,
          coverPhoto: null,
          photoCount: 0,
          videoCount: 0,
          itemCount: 0,
          updatedAt: null,
          averageUpdatedAt: null,
          isHydrated: false,
        },
      ]
    })

    if (albumNameFromQuery !== selectedAlbumName) {
      selectAlbum(albumNameFromQuery)
    }
  }, [albumQueryParam, routerIsReady, selectAlbum, selectedAlbumName, setAlbums])

  useEffect(() => {
    if (!selectedAlbumName) {
      return
    }

    ensureAlbumDetails(selectedAlbumName)
  }, [selectedAlbumName, ensureAlbumDetails])

  const baseActiveAlbum = useMemo(
    () => albums.find((album) => album.name === selectedAlbumName) || null,
    [albums, selectedAlbumName]
  )

  const detailedAlbum = selectedAlbumName
    ? albumDetails[selectedAlbumName] || null
    : null

  const activeAlbum = useMemo(() => {
    if (detailedAlbum) {
      return {
        ...(baseActiveAlbum || { name: detailedAlbum.name }),
        ...detailedAlbum,
        coverPhoto: detailedAlbum.coverPhoto || baseActiveAlbum?.coverPhoto || null,
        isHydrated: true,
      }
    }

    return baseActiveAlbum
  }, [baseActiveAlbum, detailedAlbum])

  const activeAlbumHasPhotos = Array.isArray(activeAlbum?.photos)
  const activeAlbumIsEmpty = activeAlbumHasPhotos && activeAlbum.photos.length === 0
  const albumIsLoading = Boolean(selectedAlbumName) && loadingAlbumName === selectedAlbumName

  const lightboxPhoto =
    activeAlbum &&
      Array.isArray(activeAlbum.photos) &&
      lightboxPhotoIndex !== null &&
      typeof lightboxPhotoIndex === 'number'
      ? activeAlbum.photos[lightboxPhotoIndex] || null
      : null

  const canZoom = lightboxPhoto ? !isVideo(lightboxPhoto) : false
  // Use absolute URL only for hyperlinks; render media from relative URL
  const originalMediaUrl = lightboxPhoto?.originalUrl || null
  const displayMediaUrl = lightboxPhoto?.url || null
  const lightboxItemLabel = lightboxPhoto
    ? `${lightboxPhoto.name || 'Untitled media'}${lightboxPhoto.size ? ` (${(lightboxPhoto.size / 1024 / 1024).toFixed(1)} MB)` : ''}`
    : 'Untitled media'

  const shareUrl = useMemo(() => {
    if (!activeAlbum) {
      return ''
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('album', activeAlbum.name)
      return url.toString()
    }

    const encodedAlbum = encodeURIComponent(activeAlbum.name)
    return `${router.pathname}?album=${encodedAlbum}`
  }, [activeAlbum, router.pathname])

  const shareButtonClassName = useMemo(() => {
    const baseClasses =
      'inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 cursor-pointer';

    if (shareCopyStatus === 'copied') {
      return `${baseClasses} border-teal-600 bg-teal-600 text-white hover:bg-teal-500 dark:border-teal-300 dark:bg-teal-300 dark:text-zinc-900 dark:hover:bg-teal-200`
    }

    if (shareCopyStatus === 'error') {
      return `${baseClasses} border-red-600 bg-red-600 text-white hover:bg-red-500 dark:border-red-400 dark:bg-red-400 dark:text-zinc-900 dark:hover:bg-red-300`
    }

    return `${baseClasses} border-black/70 bg-black text-white hover:bg-zinc-900 dark:border-white/70 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100`
  }, [shareCopyStatus])

  const shareButtonLabel =
    shareCopyStatus === 'copied'
      ? 'Copied!'
      : shareCopyStatus === 'error'
        ? 'Copy failed'
        : 'Share'

  const handleShareLinkClick = async () => {
    if (!shareUrl) {
      return
    }

    if (shareCopyTimeoutRef.current) {
      clearTimeout(shareCopyTimeoutRef.current)
      shareCopyTimeoutRef.current = null
    }

    let nextStatus = 'idle'

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        nextStatus = 'copied'
      } else {
        throw new Error('Clipboard unavailable')
      }
    } catch (copyError) {
      nextStatus = 'error'
    }

    if (nextStatus !== 'idle') {
      setShareCopyStatus(nextStatus)
    }

    if (typeof window !== 'undefined') {
      shareCopyTimeoutRef.current = window.setTimeout(() => {
        setShareCopyStatus('idle')
        shareCopyTimeoutRef.current = null
      }, nextStatus === 'error' ? 4000 : 2200)
    }
  }

  useEffect(() => {
    return () => {
      if (shareCopyTimeoutRef.current) {
        clearTimeout(shareCopyTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (shareCopyTimeoutRef.current) {
      clearTimeout(shareCopyTimeoutRef.current)
      shareCopyTimeoutRef.current = null
    }
    setShareCopyStatus('idle')
  }, [activeAlbum?.name])

  const closeAlbum = () => {
    selectAlbum(null)
    pendingAlbumQueryRef.current = null

    if (router?.isReady) {
      const { album: _removed, ...restQuery } = router.query
      router.replace(
        { pathname: router.pathname, query: restQuery },
        undefined,
        { shallow: true, scroll: false }
      )
    }
  }

  const openAlbum = (albumName) => {
    pendingAlbumQueryRef.current = albumName
    selectAlbum(albumName)

    if (router?.isReady) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, album: albumName } },
        undefined,
        { shallow: true, scroll: false }
      )
    }
  }

  const openPhoto = (index) => {
    setLightboxPhotoIndex(index)
    setZoomLevel(INITIAL_ZOOM)
  }

  const moveLightbox = (direction) => {
    if (
      !activeAlbum ||
      !Array.isArray(activeAlbum.photos) ||
      lightboxPhotoIndex === null
    ) {
      return
    }

    const total = activeAlbum.photos.length
    if (total === 0) {
      return
    }

    let nextIndex = lightboxPhotoIndex + direction
    if (nextIndex < 0) {
      nextIndex = total - 1
    } else if (nextIndex >= total) {
      nextIndex = 0
    }

    setLightboxPhotoIndex(nextIndex)
    setZoomLevel(INITIAL_ZOOM)
  }

  const closeLightbox = () => {
    setLightboxPhotoIndex(null)
    setZoomLevel(INITIAL_ZOOM)
    setIsDragging(false)
  }

  const zoomIn = () => {
    setZoomLevel((current) =>
      Math.min(ZOOM_MAX, Math.round((current + ZOOM_STEP) * 100) / 100)
    )
  }

  const zoomOut = () => {
    setZoomLevel((current) =>
      Math.max(ZOOM_MIN, Math.round((current - ZOOM_STEP) * 100) / 100)
    )
  }

  const resetZoom = () => {
    setZoomLevel(INITIAL_ZOOM)
  }

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !pagination?.hasMore) {
      return
    }

    const currentPage = Number(pagination?.page) || 1
    const requestedPage = pagination?.nextPage || currentPage + 1
    const pageSize = pagination?.pageSize || 9

    if (!Number.isFinite(requestedPage) || requestedPage <= currentPage) {
      return
    }

    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const response = await fetch(
        `/api/photo-albums?page=${encodeURIComponent(requestedPage)}&pageSize=${encodeURIComponent(
          pageSize
        )}`
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const reason = payload?.error || 'Unable to load more albums.'
        throw new Error(reason)
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Received an unexpected response while loading more albums.')
      }

      if (Array.isArray(payload.albums)) {
        setAlbums((current) => {
          const incomingByName = new Map()
          for (const album of payload.albums) {
            if (album && album.name) {
              incomingByName.set(album.name, album)
            }
          }

          if (incomingByName.size === 0) {
            return current
          }

          const merged = current.map((album) => {
            const incoming = incomingByName.get(album.name)
            if (!incoming) {
              return album
            }

            incomingByName.delete(album.name)

            if (album.isHydrated) {
              return album
            }

            return {
              ...album,
              ...incoming,
            }
          })

          if (incomingByName.size > 0) {
            merged.push(...incomingByName.values())
          }

          return merged
        })
      }

      if (payload.summary) {
        setSummary(payload.summary)
      }

      if (payload.pagination) {
        setPagination(payload.pagination)
      } else {
        setPagination((current) => ({
          ...current,
          page: requestedPage,
          hasMore: false,
          nextPage: null,
        }))
      }
    } catch (fetchError) {
      const reason = fetchError?.message || 'Unable to load more albums.'
      setLoadMoreError(reason)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, pagination, setAlbums, setSummary, setPagination, setLoadMoreError, setIsLoadingMore])

  useEffect(() => {
    if (!pagination?.hasMore || loadMoreError) {
      return
    }

    const node = loadMoreTriggerRef.current
    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            handleLoadMore()
            break
          }
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [handleLoadMore, loadMoreError, pagination?.hasMore])

  const isDraggable = canZoom && zoomLevel > 1

  const handlePointerDown = (event) => {
    if (!isDraggable || !scrollContainerRef.current) {
      return
    }

    const container = scrollContainerRef.current
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    }

    container.setPointerCapture?.(event.pointerId)
    setIsDragging(true)
    event.preventDefault()
  }

  const handlePointerMove = (event) => {
    const dragState = dragStateRef.current
    if (!dragState.active || !scrollContainerRef.current) {
      return
    }

    const container = scrollContainerRef.current
    const deltaX = event.clientX - dragState.originX
    const deltaY = event.clientY - dragState.originY
    container.scrollLeft = dragState.scrollLeft - deltaX
    container.scrollTop = dragState.scrollTop - deltaY
  }

  const endDrag = (event) => {
    const dragState = dragStateRef.current
    if (!dragState.active || !scrollContainerRef.current) {
      return
    }

    const container = scrollContainerRef.current
    if (event?.pointerId !== undefined && container.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId)
    }
    dragStateRef.current = {
      active: false,
      pointerId: null,
      originX: 0,
      originY: 0,
      scrollLeft: 0,
      scrollTop: 0,
    }
    setIsDragging(false)
  }

  const scrollCursorClass = isDraggable
    ? isDragging
      ? 'cursor-grabbing'
      : 'cursor-grab'
    : 'cursor-pointer'

  return (
    <ImageKitProvider urlEndpoint="https://ik.imagekit.io/tugan0329">
      <Head>
        <title>Photography - Gan Tu</title>
        <meta
          name="description"
          content="Photography adventures across the globe, organized into interactive albums."
        />
      </Head>
      <SimpleLayout
        title="Moments I took from near and far on my Canon R5 & iPhone."
        intro="Where wild horizons meet wandering souls—a visual diary of untamed landscapes, fleeting wildlife encounters, and the raw beauty discovered in the spaces between destinations."
      >
        <div className="space-y-4 -my-4">
          {summary && summary.albumCount > 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Showing {summary.albumCount} album{summary.albumCount === 1 ? '' : 's'}
              {(() => {
                const countsLabel = formatMediaCounts(summary)
                return countsLabel ? ` • ${countsLabel}` : ''
              })()}
            </p>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-100">
              {error}
            </div>
          )}

          {(!albums || albums.length === 0) && !error ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No albums are available yet.
            </p>
          ) : (
            <>
              <ul
                role="list"
                className="grid grid-cols-1 gap-x-10 gap-y-16 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              >
                {albums.map((album) => {
                  const countsLabel = formatMediaCounts(album)

                  return (
                    <Card as="li" key={album.name} className="h-full">
                      <button
                        type="button"
                        onClick={() => openAlbum(album.name)}
                        className="relative w-full cursor-pointer overflow-hidden rounded-2xl bg-zinc-100 shadow-sm shadow-zinc-900/5 transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:bg-zinc-800"
                        aria-label={`Open ${formatAlbumName(album.name)} album`}
                      >
                        {/* Alubm Covers */}
                        {album.coverPhoto ? (
                          isVideo(album.coverPhoto) ? (
                            <div className="relative h-60 w-full bg-black">
                              <video
                                src={album.coverPhoto.originalUrl}
                                alt={`${formatAlbumName(album.name)} cover`}
                                width={1024}
                                height={768}
                                className="pointer-events-none h-full w-full object-cover object-center opacity-90"
                                preload="metadata"
                                muted
                                playsInline
                                autoPlay
                                loop
                              />
                              <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
                                Video
                              </span>
                            </div>
                          ) : (
                            <Image
                              src={album.coverPhoto.url}
                              alt={`${formatAlbumName(album.name)} cover`}
                              width={440}
                              height={280}
                              transformation={[{ width: 440, height: 280, focus: "face", zoom: "0.3" }]}
                              sizes="(min-width: 1024px) 480px, 100vw"
                              loading="lazy"
                              unoptimized
                              className="h-60 w-full cursor-pointer object-cover object-center"
                            />
                          )
                        ) : (
                          <div className="flex h-60 w-full items-center justify-center text-sm text-zinc-400">
                            No preview available
                          </div>
                        )}
                      </button>
                      <div className="pt-5">
                        <Card.Title as="h2">{formatAlbumName(album.name)}</Card.Title>
                        {countsLabel ? (
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {countsLabel}
                          </p>
                        ) : null}
                      </div>
                    </Card>
                  )
                })}
              </ul>

              {loadMoreError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-100">
                  {loadMoreError}
                </div>
              )}

              {pagination?.hasMore ? (
                <div ref={loadMoreTriggerRef} className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="cursor-pointer"
                  >
                    {isLoadingMore ? 'Loading...' : 'Load more albums'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </SimpleLayout>

      <Transition.Root show={!!activeAlbum} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeAlbum}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto p-4 sm:p-10">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative mx-auto max-w-5xl rounded-3xl bg-white/95 p-6 shadow-xl ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/95 dark:ring-white/10 sm:p-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatAlbumName(activeAlbum?.name)}
                    </Dialog.Title>
                    {activeAlbum?.updatedAt && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Last updated {formatTimestamp(activeAlbum.updatedAt)}
                      </p>
                    )}
                    {(() => {
                      const countsLabel = activeAlbum ? formatMediaCounts(activeAlbum) : ''
                      return countsLabel ? (
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{countsLabel}</p>
                      ) : null
                    })()}
                  </div>
                  <div className="flex w-full max-w-sm flex-col items-start gap-2 sm:w-auto sm:items-end">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {shareUrl ? (
                        <button
                          type="button"
                          onClick={handleShareLinkClick}
                          className={shareButtonClassName}
                          title="Copy album link"
                        >
                          {shareButtonLabel}
                        </button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={closeAlbum}
                        className="cursor-pointer border border-black/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:border-white/40"
                      >
                        Close
                      </Button>
                    </div>
                    {shareCopyStatus === 'error' ? (
                      <span className="text-xs text-red-500 dark:text-red-300">
                        Copying failed. Try again or copy manually.
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {activeAlbum?.photos?.map((photo, index) => (
                    <button
                      type="button"
                      key={photo.path}
                      onClick={() => openPhoto(index)}
                      className="group relative cursor-pointer overflow-hidden rounded-xl bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:bg-zinc-800"
                      aria-label={`Open ${formatAlbumName(activeAlbum?.name)} photo ${index + 1}`}
                    > 
                      {/* Photo Thumbnails */}
                      {isVideo(photo) ? (
                        <div className="relative h-52 w-full sm:h-36">
                          {/* <Image
                            // src={`${photo.url}/ik-thumbnail.jpg`}
                            src={photo.originalUrl}
                            alt={`${formatAlbumName(activeAlbum?.name)} photo ${index + 1}`}
                            width={640}
                            height={640}
                            className="pointer-events-none h-full w-full object-cover object-center opacity-90 transition duration-200 group-hover:opacity-100"
                            loading="lazy"
                            sizes="(min-width: 1024px) 240px, 50vw"
                          /> */}
                          <video
                            src={photo.originalUrl}
                            alt={`${formatAlbumName(activeAlbum?.name)} photo ${index + 1}`}
                            width={1024}
                            height={768}
                            className="pointer-events-none h-full w-full object-cover object-center opacity-90"
                            preload="metadata"
                            muted
                            playsInline
                            autoPlay
                            loop
                          />
                          <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
                            Video
                          </span>
                        </div>
                      ) : (
                        <Image
                          src={photo.url}
                          alt={`${formatAlbumName(activeAlbum?.name)} photo ${index + 1}`}
                          width={440}
                          height={280}
                          transformation={[{ width: 440, height: 280, focus: "face", zoom: "0.3" }]}
                          className="h-52 w-full cursor-pointer object-cover object-center transition duration-200 group-hover:scale-105 sm:h-36"
                          loading="lazy"
                          sizes="(min-width: 1024px) 240px, 50vw"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {albumIsLoading ? (
                  <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                    Loading album...
                  </p>
                ) : null}

                {albumDetailError && !albumIsLoading ? (
                  <div className="mt-6 rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-100">
                    {albumDetailError}
                  </div>
                ) : null}

                {activeAlbumHasPhotos && activeAlbumIsEmpty && !albumIsLoading ? (
                  <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                    This album is empty for now.
                  </p>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <Transition.Root show={!!lightboxPhoto} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={closeLightbox}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className={`fixed inset-0${DEFAULT_LIGHTBOX_BACKGROUND}`} />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative flex w-full max-w-7xl flex-col items-center gap-4 text-zinc-100">
                <div className="flex w-full max-w-5xl flex-col items-center gap-3 px-1 text-center text-sm sm:flex-row sm:items-start sm:justify-between sm:px-0 sm:text-left">
                  <div className="flex flex-col gap-1 text-xs sm:text-sm">
                    <span className="text-base font-semibold text-zinc-100 sm:text-lg">
                      {formatAlbumName(activeAlbum?.name)}
                    </span>
                    {lightboxPhoto ? (
                      <span className="text-zinc-300">
                        {originalMediaUrl ? (
                          <>
                            {lightboxItemLabel} (
                            <a
                              href={originalMediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-dotted underline-offset-4 hover:text-white"
                            >
                              View Original
                            </a>
                            )
                          </>
                        ) : (
                          lightboxItemLabel
                        )}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {canZoom ? (
                      <>
                        <div className="mx-2 hidden h-6 w-px bg-zinc-700/80 sm:block" aria-hidden="true" />
                        <button
                          type="button"
                          className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={zoomOut}
                          aria-label="Zoom out"
                          disabled={zoomLevel <= ZOOM_MIN}
                        >
                          <MinusIcon className="h-4 w-4" />
                        </button>
                        <span className="w-14 text-center text-xs font-medium text-zinc-300">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={zoomIn}
                          aria-label="Zoom in"
                          disabled={zoomLevel >= ZOOM_MAX}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                        <Button
                          type="button"
                          className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={resetZoom}
                        >
                          Fit
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={closeLightbox}
                    >
                      Close
                    </Button>
                  </div>
                </div>
                {lightboxPhoto ? (
                  <div className="w-full">
                    <div className="relative mx-auto h-[82vh] w-full max-w-5xl">
                      <button
                        type="button"
                        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full border border-white/30 bg-zinc-900/70 p-3 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40 md:-left-16"
                        onClick={() => moveLightbox(-1)}
                        aria-label="Previous item"
                        disabled={!activeAlbum || !activeAlbum.photos?.length}
                      >
                        <ArrowLeftIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full border border-white/30 bg-zinc-900/70 p-3 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40 md:-right-16"
                        onClick={() => moveLightbox(1)}
                        aria-label="Next item"
                        disabled={!activeAlbum || !activeAlbum.photos?.length}
                      >
                        <ArrowRightIcon className="h-5 w-5" />
                      </button>
                      <div className="h-full w-full overflow-hidden rounded-none bg-black sm:rounded-3xl">
                        <div
                          ref={scrollContainerRef}
                          className={`relative mx-auto flex h-full w-full items-center justify-center overflow-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] ${scrollCursorClass}`}
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={endDrag}
                          onPointerLeave={endDrag}
                          onPointerCancel={endDrag}
                        >
                          {isVideo(lightboxPhoto) ? (
                            <video
                              src={originalMediaUrl}
                              className="h-full w-full object-contain"
                              controls
                              muted
                              autoPlay
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <Image
                              src={displayMediaUrl || lightboxPhoto.url}
                              alt={`${formatAlbumName(activeAlbum?.name)} full-size item`}
                              width={1920}
                              height={1080}
                              sizes="(min-width: 1920px) 1280px, (min-width: 1280px) 80vw, 100vw"
                              unoptimized
                              className="h-full w-full cursor-pointer object-contain object-center"
                              priority
                              style={{
                                transform: `scale(${zoomLevel})`,
                                transformOrigin: 'center center',
                              }}
                              onLoadingComplete={({ naturalWidth, naturalHeight }) => {
                                setPhotoDimensions((previous) => {
                                  const existing = previous[lightboxPhoto.path]
                                  if (
                                    existing?.width === naturalWidth &&
                                    existing?.height === naturalHeight
                                  ) {
                                    return previous
                                  }

                                  return {
                                    ...previous,
                                    [lightboxPhoto.path]: {
                                      width: naturalWidth,
                                      height: naturalHeight,
                                    },
                                  }
                                })
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </ImageKitProvider >
  )
}

export async function getServerSideProps() {
  const lastGeneratedAt = new Date().toISOString()
  const DEFAULT_PAGE_SIZE = 9

  try {
    const { albums, summary, pagination } = await getPaginatedPhotoAlbums({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })

    return {
      props: {
        initialAlbums: albums,
        initialSummary: summary,
        initialPagination: pagination,
        lastGeneratedAt,
        error: null,
      },
    }
  } catch (fetchError) {
    return {
      props: {
        initialAlbums: [],
        initialSummary: { albumCount: 0, photoCount: 0, videoCount: 0, itemCount: 0 },
        initialPagination: {
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          totalAlbums: 0,
          totalPages: 0,
          hasMore: false,
          nextPage: null,
          prevPage: null,
        },
        lastGeneratedAt,
        error:
          fetchError?.message ||
          'Unable to load photo albums. Confirm the Google Cloud Storage bucket configuration.',
      },
    }
  }
}
