import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Fetch models from ElevenLabs API
    const response = await fetch("https://api.elevenlabs.io/v1/models", {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || "Failed to fetch models")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching models:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch models" }, { status: 500 })
  }
}

