import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { text, voiceId, model = "eleven_turbo_v2" } = await request.json()

    if (!text || !voiceId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Call the ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to generate speech: ${response.status}`)
    }

    // Get the audio data as an array buffer
    const audioBuffer = await response.arrayBuffer()

    // Convert to base64 for sending to the client
    const base64Audio = Buffer.from(audioBuffer).toString("base64")

    return NextResponse.json({
      success: true,
      audioData: base64Audio,
    })
  } catch (error) {
    console.error("Error generating speech:", error)
    return NextResponse.json({ error: error.message || "Failed to generate speech" }, { status: 500 })
  }
}

