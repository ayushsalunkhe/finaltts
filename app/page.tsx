"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Play, Pause, Square, Download, Volume2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

// Define types for our data
interface Voice {
  voice_id: string
  name: string
  preview_url?: string
}

interface Model {
  model_id: string
  name: string
  description?: string
}

interface Language {
  code: string
  name: string
}

// Hardcoded API key - replace with your actual ElevenLabs API key
const ELEVENLABS_API_KEY = "sk_f877776353a5b47ba8d6038d3a1e3b9f5b8c8de691911966"

export default function TextToSpeech() {
  const [text, setText] = useState("")
  const [selectedVoice, setSelectedVoice] = useState("")
  const [selectedModel, setSelectedModel] = useState("eleven_turbo_v2")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState("")
  const [voices, setVoices] = useState<Voice[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [volume, setVolume] = useState(80)
  const [stability, setStability] = useState(0.5)
  const [similarityBoost, setSimilarityBoost] = useState(0.5)
  const audioRef = useRef<HTMLAudioElement>(null)
  const maxCharacters = 1000

  // Languages supported by ElevenLabs
  const languages: Language[] = [
    { code: "en", name: "English" },
    { code: "de", name: "German" },
    { code: "pl", name: "Polish" },
    { code: "es", name: "Spanish" },
    { code: "it", name: "Italian" },
    { code: "fr", name: "French" },
    { code: "pt", name: "Portuguese" },
    { code: "hi", name: "Hindi" },
    { code: "ar", name: "Arabic" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "fi", name: "Finnish" },
    { code: "el", name: "Greek" },
    { code: "hu", name: "Hungarian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "no", name: "Norwegian" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sv", name: "Swedish" },
    { code: "tr", name: "Turkish" },
    { code: "uk", name: "Ukrainian" },
    { code: "vi", name: "Vietnamese" },
  ]

  const [selectedLanguage, setSelectedLanguage] = useState("en")

  // Fetch voices and models on component mount
  useEffect(() => {
    const fetchVoicesAndModels = async () => {
      try {
        // Fetch voices directly using the hardcoded API key
        const voicesResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
          },
        })

        if (!voicesResponse.ok) {
          throw new Error("Failed to fetch voices. Please check your API key.")
        }

        const voicesData = await voicesResponse.json()

        if (voicesData.voices && Array.isArray(voicesData.voices)) {
          setVoices(voicesData.voices)
          if (voicesData.voices.length > 0) {
            setSelectedVoice(voicesData.voices[0].voice_id)
          }
        }

        // Fetch models directly using the hardcoded API key
        const modelsResponse = await fetch("https://api.elevenlabs.io/v1/models", {
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
          },
        })

        if (!modelsResponse.ok) {
          throw new Error("Failed to fetch models")
        }

        const modelsData = await modelsResponse.json()

        if (modelsData.models && Array.isArray(modelsData.models)) {
          setModels(modelsData.models)
          // Find and set the Turbo model as default if available
          const turboModel = modelsData.models.find((model) => model.model_id === "eleven_turbo_v2")
          if (turboModel) {
            setSelectedModel(turboModel.model_id)
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load voices and models. Please check your API key.",
          variant: "destructive",
        })
      }
    }

    fetchVoicesAndModels()
  }, [])

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100

      audioRef.current.onended = () => {
        setIsPlaying(false)
        setIsPaused(false)
      }
    }
  }, [audioRef, volume])

  const handleTextChange = (e) => {
    const newText = e.target.value
    if (newText.length <= maxCharacters) {
      setText(newText)
    }
  }

  const generateSpeech = async () => {
    if (!text.trim() || !selectedVoice) return

    setIsLoading(true)

    // Stop any currently playing audio first
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setIsPaused(false)
    }

    try {
      // Call the ElevenLabs API directly with the hardcoded API key
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: selectedModel,
          voice_settings: {
            stability,
            similarityBoost,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to generate speech: ${response.status}`)
      }

      // Get the audio data as an array buffer
      const audioBuffer = await response.arrayBuffer()

      // Convert to base64 for creating a blob URL
      const base64Audio = arrayBufferToBase64(audioBuffer)
      const blob = base64ToBlob(base64Audio, "audio/mpeg")

      // If there's an existing audio URL, revoke it to prevent memory leaks
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      const url = URL.createObjectURL(blob)
      setAudioUrl(url)

      // Wait for state update to complete before playing
      setIsLoading(false)

      // Use a small timeout to ensure the audio element has updated with the new source
      setTimeout(() => {
        if (audioRef.current) {
          const playPromise = audioRef.current.play()

          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(true)
                setIsPaused(false)
              })
              .catch((error) => {
                console.error("Playback error:", error)
                // Handle user interaction requirement for autoplay
                if (error.name === "NotAllowedError") {
                  toast({
                    title: "Autoplay blocked",
                    description: "Please click play to listen to the audio",
                    variant: "default",
                  })
                }
              })
          }
        }
      }, 100)
    } catch (error) {
      console.error("Error generating speech:", error)
      setIsLoading(false)
      toast({
        title: "Error",
        description: error.message || "Failed to generate speech",
        variant: "destructive",
      })
    }
  }

  // Helper function to convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer) => {
    let binary = ""
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64)
    const byteArrays = []

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512)

      const byteNumbers = new Array(slice.length)
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }

      const byteArray = new Uint8Array(byteNumbers)
      byteArrays.push(byteArray)
    }

    return new Blob(byteArrays, { type: mimeType })
  }

  const playAudio = () => {
    if (audioRef.current) {
      const playPromise = audioRef.current.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true)
            setIsPaused(false)
          })
          .catch((error) => {
            console.error("Playback error:", error)
            toast({
              title: "Playback error",
              description: "There was an error playing the audio",
              variant: "destructive",
            })
          })
      }
    }
  }

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(true)
      setIsPaused(true)
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setIsPaused(false)
    }
  }

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement("a")
      a.href = audioUrl
      a.download = "speech.mp3"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const characterPercentage = (text.length / maxCharacters) * 100

  // Add this useEffect for cleanup
  useEffect(() => {
    return () => {
      // Clean up audio resources when component unmounts
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-8">
        <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
          VoxGen
        </div>
        <div>
          <Button className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:opacity-90 transition-all">
            Login
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="text-center py-16 px-8">
        <h1 className="text-5xl md:text-6xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
          Transform Text into Natural Speech
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">AI-powered text to speech with human-like voices</p>

        {/* Main Input Container */}
        <motion.div
          className="max-w-4xl mx-auto mt-16 bg-white/10 rounded-3xl p-8 backdrop-blur-md border border-white/10 shadow-[0_0_30px_rgba(0,255,255,0.2)]"
          animate={{ y: [0, -20, 0] }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 6,
            ease: "easeInOut",
          }}
        >
          <Textarea
            placeholder="Enter text here..."
            className="w-full h-48 bg-transparent border-none text-white text-lg resize-none p-4 focus:ring-0 focus:outline-none"
            value={text}
            onChange={handleTextChange}
          />

          <div className="mt-4 text-sm text-gray-400 flex justify-between">
            <span>
              {text.length} / {maxCharacters} characters
            </span>
            <span>{Math.max(maxCharacters - text.length, 0)} remaining</span>
          </div>

          <Progress value={characterPercentage} className="h-1 bg-gray-700 mt-2" />

          <div className="flex flex-col md:flex-row justify-between gap-4 mt-8">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="bg-transparent text-white border-white/20 rounded-xl w-full md:w-48">
                  <SelectValue placeholder="Select Voice" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10 text-white max-h-[300px]">
                  {voices.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="bg-transparent text-white border-white/20 rounded-xl w-full md:w-48">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10 text-white max-h-[300px]">
                  {languages.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {!isPlaying ? (
                <Button
                  onClick={generateSpeech}
                  disabled={!text.trim() || isLoading || !selectedVoice}
                  className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:opacity-90 transition-all rounded-xl px-6 py-3 font-bold w-full md:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Convert to Speech"
                  )}
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button
                      onClick={playAudio}
                      className="bg-gradient-to-r from-green-400 to-green-600 hover:opacity-90 transition-all rounded-xl px-6 py-3 font-bold"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      onClick={pauseAudio}
                      className="bg-gradient-to-r from-amber-400 to-amber-600 hover:opacity-90 transition-all rounded-xl px-6 py-3 font-bold"
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  <Button
                    onClick={stopAudio}
                    className="bg-transparent border border-white/20 hover:bg-white/10 transition-all rounded-xl px-6 py-3 font-bold"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}

              {audioUrl && (
                <Button
                  onClick={downloadAudio}
                  disabled={isLoading}
                  className="bg-transparent border border-white/20 hover:bg-white/10 transition-all rounded-xl px-6 py-3 font-bold"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4" /> Volume
            </label>
            <Slider
              value={[volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => setVolume(value[0])}
              className="py-2"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 px-8 py-16 max-w-6xl mx-auto">
        <div className="bg-white/5 p-8 rounded-2xl text-center transition-all hover:transform hover:-translate-y-2 hover:bg-white/10">
          <h3 className="text-xl font-bold mb-4">🚀 Instant Conversion</h3>
          <p className="text-gray-400">Real-time text processing with ultra-low latency</p>
        </div>
        <div className="bg-white/5 p-8 rounded-2xl text-center transition-all hover:transform hover:-translate-y-2 hover:bg-white/10">
          <h3 className="text-xl font-bold mb-4">🧠 AI Powered</h3>
          <p className="text-gray-400">Advanced neural networks for natural sounding speech</p>
        </div>
        <div className="bg-white/5 p-8 rounded-2xl text-center transition-all hover:transform hover:-translate-y-2 hover:bg-white/10">
          <h3 className="text-xl font-bold mb-4">🌍 50+ Languages</h3>
          <p className="text-gray-400">Support for multiple languages and dialects</p>
        </div>
      </section>

      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} />
      <Toaster />
    </div>
  )
}

