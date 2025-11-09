/**
 * Audio Service
 * Handles TTS generation and audio processing
 */

import { Script, Section, Timing } from "../types";
import { logger } from "../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";

export type TTSProvider = "elevenlabs" | "openai" | "voipeak";

export interface TTSConfig {
  provider: TTSProvider;
  apiKey?: string;
  voiceId?: string;
  model?: string;
  speed?: number;
}

export interface AudioAsset {
  id: string;
  text: string;
  audioPath: string;
  duration: number;
  timing: Timing;
}

/**
 * Audio Service Class
 */
export class AudioService {
  private config: TTSConfig;
  private outputDir: string;

  constructor(config: TTSConfig, outputDir: string = "./data/audio") {
    this.config = config;
    this.outputDir = outputDir;
  }

  /**
   * Initialize audio output directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    logger.info("Audio service initialized", { outputDir: this.outputDir });
  }

  /**
   * Generate audio for a section
   */
  async generateAudioForSection(
    section: Section,
    timing: Timing
  ): Promise<AudioAsset> {
    logger.info("Generating audio for section", {
      sectionId: section.id,
      textLength: section.text.length,
    });

    const audioPath = path.join(this.outputDir, `${section.id}.wav`);

    // For now, create a placeholder file
    // In production, this would call the TTS API
    await this.generateTTS(section.text, audioPath);

    // Estimate duration (rough approximation: 5 chars per second)
    const duration = section.text.length / 5;

    return {
      id: section.id,
      text: section.text,
      audioPath,
      duration,
      timing,
    };
  }

  /**
   * Generate TTS audio file
   */
  private async generateTTS(text: string, outputPath: string): Promise<void> {
    logger.info("Generating TTS audio", {
      provider: this.config.provider,
      outputPath,
    });

    switch (this.config.provider) {
      case "elevenlabs":
        await this.generateElevenLabsTTS(text, outputPath);
        break;
      case "openai":
        await this.generateOpenAITTS(text, outputPath);
        break;
      case "voipeak":
        await this.generateVOICEPEAKTTS(text, outputPath);
        break;
      default:
        throw new Error(`Unsupported TTS provider: ${this.config.provider}`);
    }
  }

  /**
   * Generate audio using ElevenLabs
   */
  private async generateElevenLabsTTS(
    text: string,
    outputPath: string
  ): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    const voiceId = this.config.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default voice

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": this.config.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: this.config.model || "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              speed: this.config.speed || 1.0,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: { message: response.statusText },
        }));
        const error = errorData as { error?: { message?: string } };
        throw new Error(
          `ElevenLabs API error: ${error.error?.message || response.statusText}`
        );
      }

      const audioBuffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(audioBuffer));
      logger.info("ElevenLabs TTS generated", { outputPath });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("ElevenLabs TTS generation failed", { error: message });
      throw error;
    }
  }

  /**
   * Generate audio using OpenAI TTS
   */
  private async generateOpenAITTS(
    text: string,
    outputPath: string
  ): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model || "tts-1",
          input: text,
          voice: this.config.voiceId || "alloy",
          speed: this.config.speed || 1.0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: { message: response.statusText },
        }));
        const error = errorData as { error?: { message?: string } };
        throw new Error(
          `OpenAI TTS API error: ${error.error?.message || response.statusText}`
        );
      }

      const audioBuffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(audioBuffer));
      logger.info("OpenAI TTS generated", { outputPath });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("OpenAI TTS generation failed", { error: message });
      throw error;
    }
  }

  /**
   * Generate audio using VOICEPEAK
   */
  private async generateVOICEPEAKTTS(
    _text: string,
    outputPath: string
  ): Promise<void> {
    // TODO: Implement VOICEPEAK TTS integration
    // VOICEPEAK typically uses a local API or SDK
    logger.warn("VOICEPEAK TTS not yet implemented", { outputPath });
    throw new Error("VOICEPEAK TTS not yet implemented");
  }

  /**
   * Generate timing information for script text
   */
  async generateTimings(
    _script: Script,
    sections: Section[]
  ): Promise<Timing[]> {
    // Generate timing estimates based on text length
    // In production, this would use actual audio duration or TTS duration estimation
    const timings: Timing[] = [];
    let currentTime = 0;

    for (const section of sections) {
      // Estimate: 5 characters per second (adjustable)
      const charsPerSecond = 5;
      const duration = section.text.length / charsPerSecond;

      const timing: Timing = {
        lineId: section.id,
        startSec: currentTime,
        endSec: currentTime + duration,
        gapAfterSec: 0.3, // Default gap
      };

      timings.push(timing);
      currentTime = timing.endSec + timing.gapAfterSec;
    }

    return timings;
  }

  /**
   * Get audio catalog (BGM and SFX)
   */
  async getAudioCatalog(): Promise<{
    bgm: Array<{ id: string; name: string; path: string; duration: number }>;
    sfx: Array<{ id: string; name: string; path: string; duration: number }>;
  }> {
    const catalogPath = path.join(
      __dirname,
      "../../templates/audio-catalog.json"
    );

    try {
      const content = await fs.readFile(catalogPath, "utf-8");
      const catalog = JSON.parse(content);
      logger.info("Audio catalog loaded", {
        bgmCount: catalog.bgm.length,
        sfxCount: catalog.sfx.length,
      });
      return catalog;
    } catch (error) {
      logger.warn("Failed to load audio catalog, returning empty catalog", {
        error,
      });
      return {
        bgm: [],
        sfx: [],
      };
    }
  }
}

/**
 * Get TTS config from environment variables
 */
export function getTTSConfigFromEnv(): TTSConfig | null {
  // Check for ElevenLabs
  if (process.env.ELEVENLABS_API_KEY) {
    return {
      provider: "elevenlabs",
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
      model: process.env.ELEVENLABS_MODEL,
      speed: parseFloat(process.env.ELEVENLABS_SPEED || "1.0"),
    };
  }

  // Check for OpenAI TTS
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      voiceId: process.env.OPENAI_TTS_VOICE || "alloy",
      model: process.env.OPENAI_TTS_MODEL || "tts-1",
      speed: parseFloat(process.env.OPENAI_TTS_SPEED || "1.0"),
    };
  }

  return null;
}
