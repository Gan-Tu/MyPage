import { Dialog, Transition } from '@headlessui/react'
import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { SimpleLayout } from '@/components/SimpleLayout'
import { getPhotoAlbums, getPhotoAlbumsSummary } from '@/lib/getPhotoAlbums'

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

export default function Photography({
  albums,
  summary,
  lastGeneratedAt,
  error,
}) {
  const [selectedAlbumName, setSelectedAlbumName] = useState(null)
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(null)
  const [photoDimensions, setPhotoDimensions] = useState({})

  const INITIAL_ZOOM = 1
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 3
  const ZOOM_STEP = 0.25
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM)

  const activeAlbum = useMemo(
    () => albums.find((album) => album.name === selectedAlbumName) || null,
    [albums, selectedAlbumName]
  )

  const lightboxPhoto =
    activeAlbum &&
    lightboxPhotoIndex !== null &&
    typeof lightboxPhotoIndex === 'number'
      ? activeAlbum.photos[lightboxPhotoIndex] || null
      : null

  const closeAlbum = () => {
    setSelectedAlbumName(null)
    setLightboxPhotoIndex(null)
    setZoomLevel(INITIAL_ZOOM)
  }

  const openAlbum = (albumName) => {
    setSelectedAlbumName(albumName)
    setLightboxPhotoIndex(null)
    setZoomLevel(INITIAL_ZOOM)
  }

  const openPhoto = (index) => {
    setLightboxPhotoIndex(index)
    setZoomLevel(INITIAL_ZOOM)
  }

  const moveLightbox = (direction) => {
    if (!activeAlbum || lightboxPhotoIndex === null) {
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

  useEffect(() => {
    if (!lightboxPhoto) {
      return
    }

    const dimensions = photoDimensions[lightboxPhoto.path]
    if (!dimensions) {
      return
    }

    const aspectRatio = dimensions.width / dimensions.height
    let targetZoom = INITIAL_ZOOM

    if (aspectRatio < 0.85) {
      targetZoom = 1.5
    } else if (aspectRatio < 1) {
      targetZoom = 1.35
    }

    const clampedZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, targetZoom))

    setZoomLevel((current) =>
      Math.abs(current - clampedZoom) < 0.01 ? current : clampedZoom
    )
  }, [lightboxPhoto, photoDimensions])

  return (
    <>
      <Head>
        <title>Photography - Gan Tu</title>
        <meta
          name="description"
          content="Photography adventures across the globe, organized into interactive albums."
        />
      </Head>
      <SimpleLayout
        title="Photography I took from moments near and far."
        intro="A living archive of the adventures, and serendipitous scenes that I capture along the way."
      >
        <div className="space-y-4 -my-4">
          {summary && summary.albumCount > 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Showing {summary.albumCount} album{summary.albumCount === 1 ? '' : 's'}
              {summary.photoCount > 0
                ? ` • Total ${summary.photoCount} photo${summary.photoCount === 1 ? '' : 's'}`
                : ''}
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
            <ul
              role="list"
              className="grid grid-cols-1 gap-x-10 gap-y-16 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            >
              {albums.map((album) => (
                <Card as="li" key={album.name} className="h-full">
                  <button
                    type="button"
                    onClick={() => openAlbum(album.name)}
                    className="relative w-full cursor-pointer overflow-hidden rounded-2xl bg-zinc-100 shadow-sm shadow-zinc-900/5 transition-transform hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:bg-zinc-800"
                    aria-label={`Open ${formatAlbumName(album.name)} album`}
                  >
                    {album.coverPhoto ? (
                      <Image
                        src={album.coverPhoto.url}
                        alt={`${formatAlbumName(album.name)} cover`}
                        width={1024}
                        height={768}
                        sizes="(min-width: 1024px) 480px, 100vw"
                        className="h-60 w-full cursor-pointer object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-60 w-full items-center justify-center text-sm text-zinc-400">
                        No preview available
                      </div>
                    )}
                  </button>
                  <div className="pt-5">
                    <Card.Title as="h2">{formatAlbumName(album.name)}
                      <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400"> • {album.photoCount} photo{album.photoCount === 1 ? '' : 's'}</span>
                    </Card.Title>
                  </div>
                </Card>
              ))}
            </ul>
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
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatAlbumName(activeAlbum?.name)}
                    </Dialog.Title>
                    {activeAlbum?.updatedAt && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Last updated {formatTimestamp(activeAlbum.updatedAt)}
                      </p>
                    )}
                    {activeAlbum?.photoCount ? (
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {activeAlbum.photoCount} photo{activeAlbum.photoCount === 1 ? '' : 's'}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeAlbum}
                    className="self-start cursor-pointer border border-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:border-white/40"
                  >
                    Close
                  </Button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {activeAlbum?.photos?.map((photo, index) => (
                    <button
                      type="button"
                      key={photo.path}
                      onClick={() => openPhoto(index)}
                      className="group relative cursor-pointer overflow-hidden rounded-xl bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:bg-zinc-800"
                    >
                      <Image
                        src={photo.url}
                        alt={`${formatAlbumName(activeAlbum?.name)} photo ${index + 1}`}
                        width={640}
                        height={640}
                        className="h-36 w-full cursor-pointer object-cover object-center transition duration-200 group-hover:scale-105"
                        sizes="(min-width: 1024px) 240px, 50vw"
                      />
                    </button>
                  ))}
                </div>

                {!activeAlbum?.photos?.length && (
                  <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                    This album is empty for now.
                  </p>
                )}
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

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative flex w-full max-w-6xl flex-col gap-4 text-zinc-100">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex flex-col gap-1 text-xs sm:text-sm">
                    <span className="font-medium text-zinc-100">
                      {formatAlbumName(activeAlbum?.name)}
                    </span>
                    {lightboxPhoto?.name ? (
                      <span className="text-zinc-300">
                        {lightboxPhoto.name}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => moveLightbox(-1)}
                      aria-label="Previous photo"
                      disabled={!activeAlbum || !activeAlbum.photos?.length}
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => moveLightbox(1)}
                      aria-label="Next photo"
                      disabled={!activeAlbum || !activeAlbum.photos?.length}
                    >
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                    <div className="mx-2 hidden h-6 w-px bg-zinc-700/80 sm:block" aria-hidden="true" />
                    <button
                      type="button"
                      className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
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
                      className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={zoomIn}
                      aria-label="Zoom in"
                      disabled={zoomLevel >= ZOOM_MAX}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    <Button
                      type="button"
                      className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={resetZoom}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      className="cursor-pointer rounded-full border border-white/40 bg-zinc-900/80 p-2 text-zinc-100 shadow-lg shadow-black/30 transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={closeLightbox}
                    >
                      Close
                    </Button>
                  </div>
                </div>
                {lightboxPhoto ? (
                  <div className="relative h-[70vh] w-full overflow-auto rounded-3xl bg-black">
                    <div className="relative mx-auto flex h-full w-full items-center justify-center">
                      <Image
                        src={lightboxPhoto.url}
                        alt={`${formatAlbumName(activeAlbum?.name)} full-size photo`}
                        width={1920}
                        height={1080}
                        sizes="100vw"
                        className="h-auto w-auto max-h-[70vh] max-w-full object-contain object-center"
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
                    </div>
                  </div>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  )
}

export async function getServerSideProps() {
  const lastGeneratedAt = new Date().toISOString()

  try {
    const albums = await getPhotoAlbums()
    const summary = getPhotoAlbumsSummary(albums)

    return {
      props: {
        albums,
        summary,
        lastGeneratedAt,
        error: null,
      },
    }
  } catch (fetchError) {
    return {
      props: {
        albums: [],
        summary: { albumCount: 0, photoCount: 0 },
        lastGeneratedAt,
        error:
          fetchError?.message ||
          'Unable to load photo albums. Confirm the Google Cloud Storage bucket configuration.',
      },
    }
  }
}
