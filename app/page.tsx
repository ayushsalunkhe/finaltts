"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Play, Pause, Square, Download, Volume2, Mic, Languages, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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
        // Fetch voices
        const voicesResponse = await fetch("/api/voices")
        if (!voicesResponse.ok) {
          throw new Error("Failed to fetch voices")
        }
        const voicesData = await voicesResponse.json()

        if (voicesData.voices && Array.isArray(voicesData.voices)) {
          setVoices(voicesData.voices)
          if (voicesData.voices.length > 0) {
            setSelectedVoice(voicesData.voices[0].voice_id)
          }
        }

        // Fetch models
        const modelsResponse = await fetch("/api/models")
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
          description: "Failed to load voices and models. Please refresh the page.",
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
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: selectedVoice,
          model: selectedModel,
          voiceSettings: {
            stability,
            similarityBoost,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate speech")
      }

      const data = await response.json()

      if (data.success && data.audioData) {
        // Create a blob URL from the base64 audio data
        const blob = base64ToBlob(data.audioData, "audio/mpeg")

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
      } else {
        throw new Error("Invalid response from server")
      }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        <Card className="border-0 bg-gray-900/40 backdrop-blur-xl shadow-[0_0_15px_rgba(125,125,255,0.1)] rounded-xl overflow-hidden">
          <CardHeader className="border-b border-gray-800">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  Vocal Vista
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Convert your text to natural-sounding speech
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Your Text</label>
              <Textarea
                placeholder="Enter your text here..."
                className="resize-none h-32 bg-gray-800/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-gray-200"
                value={text}
                onChange={handleTextChange}
              />
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>
                  {text.length} / {maxCharacters} characters
                </span>
                <span className={text.length > maxCharacters * 0.8 ? "text-red-400" : ""}>
                  {Math.max(maxCharacters - text.length, 0)} remaining
                </span>
              </div>
              <Progress value={characterPercentage} className="h-1 bg-gray-700" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Mic className="w-4 h-4" /> Voice
                </label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-200">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-gray-200 max-h-[300px]">
                    {voices.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Languages className="w-4 h-4" /> Language
                </label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-200">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-gray-200 max-h-[300px]">
                    {languages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
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
          </CardContent>

          <CardFooter className="flex flex-wrap gap-3 justify-between border-t border-gray-800 p-6">
            <div className="flex gap-2">
              {!isPlaying ? (
                <Button
                  onClick={generateSpeech}
                  disabled={!text.trim() || isLoading || !selectedVoice}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Generate & Play
                    </>
                  )}
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button onClick={playAudio} className="bg-green-600 hover:bg-green-700 text-white">
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseAudio} className="bg-amber-600 hover:bg-amber-700 text-white">
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  <Button
                    onClick={stopAudio}
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            <Button
              onClick={downloadAudio}
              disabled={!audioUrl || isLoading}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Download className="mr-2 h-4 w-4" />
              Download MP3
            </Button>
          </CardFooter>
        </Card>

        {/* Hidden audio element */}
        <audio ref={audioRef} src={audioUrl} />

      </motion.div>
      <Toaster />
    </div>
  )
}

