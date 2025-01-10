import {
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'

const AudioPlayer = ({ title, src, className }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current
    setDuration(audio.duration)

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    return () =>
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
  }, [])

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const updatePlaybackRate = (event) => {
    audioRef.current.playbackRate = event.target.value
  }

  const toggleMute = () => {
    audioRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const formatTime = (time) => {
    if (time && !isNaN(time)) {
      const minutes = Math.floor(time / 60)
      const seconds = Math.floor(time % 60)
      return `${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`
    }
    return '00:00'
  }

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime)
  }

  const handleProgressChange = (event) => {
    const time = event.target.value
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  return (
    <div
      className={`w-full max-w-3xl rounded-lg bg-white p-4 shadow ${className}`}
    >
      <div className="flex items-center gap-4">
        {/* Large Play Button */}
        <button
          onClick={togglePlay}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black transition-colors hover:bg-gray-800"
        >
          {isPlaying ? (
            <PauseIcon className="h-8 w-8 text-white" />
          ) : (
            <PlayIcon className="ml-1 h-8 w-8 text-white" />
          )}
        </button>

        <div className="flex-1 space-y-2">
          {/* Title and Time */}
          <div className="flex justify-between text-sm text-gray-500">
            {title && <span>{title}</span>}
            <div className="flex gap-1">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleProgressChange}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-black"
              style={{
                background: `linear-gradient(to right, black ${
                  (currentTime / duration) * 100
                }%, #e5e7eb ${(currentTime / duration) * 100}%)`,
              }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 text-gray-600">
            <select
              className="cursor-pointer bg-transparent text-sm outline-none hover:text-black"
              onChange={updatePlaybackRate}
            >
              <option value={1.0}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2.0}>2.0x</option>
            </select>
            <button onClick={toggleMute} className="hover:text-black">
              {isMuted ? (
                <SpeakerXMarkIcon className="h-4 w-4 text-gray-500" />
              ) : (
                <SpeakerWaveIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} src={src} />
    </div>
  )
}

export default AudioPlayer
