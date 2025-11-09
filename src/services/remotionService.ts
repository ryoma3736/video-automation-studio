/**
 * Remotion Service
 * Handles Remotion code generation and video composition
 */

import { Script, SlideSpec, Timing, AudioAsset } from "../types";
import { buildLLMRequest, parseLLMResponse } from "../prompts";
import { LLMClient, getDefaultLLMClient } from "./llmService";
import { StorageService } from "./storageService";
import { logger } from "../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";

export interface RemotionCode {
  tsx: string;
  offsets: Timing[];
}

export interface RemotionConfig {
  outputDir: string;
  width: number;
  height: number;
  fps: number;
  durationInSeconds: number;
}

/**
 * Remotion Service Class
 */
export class RemotionService {
  private llmClient: LLMClient;
  private config: RemotionConfig;

  constructor(
    llmClient?: LLMClient,
    _storage?: StorageService,
    config?: Partial<RemotionConfig>
  ) {
    this.llmClient = llmClient || getDefaultLLMClient();
    this.config = {
      outputDir: "./remotion-output",
      width: 1080,
      height: 1920, // Vertical format for Reels/Shorts
      fps: 30,
      durationInSeconds: 60,
      ...config,
    };
  }

  /**
   * Generate Remotion code from script, slides, and audio
   */
  async generateRemotionCode(
    script: Script,
    slides: SlideSpec[],
    _timings: Timing[],
    _audioAssets: AudioAsset[],
    audioCatalog: { bgm: any[]; sfx: any[] }
  ): Promise<RemotionCode> {
    logger.info("Generating Remotion code", { scriptId: script.id });

    const prompt = buildLLMRequest({
      task: "remotion",
      script_json: script,
      slides_manifest_json: { specs: slides },
      audio_catalog_json: audioCatalog,
    });

    const response = await this.llmClient.complete(prompt);
    const result = parseLLMResponse("remotion", response);

    if (!result.tsx || !result.offsets) {
      throw new Error("Failed to generate Remotion code: invalid response format");
    }

    logger.info("Remotion code generated", {
      scriptId: script.id,
      offsetsCount: result.offsets.length,
    });

    return {
      tsx: result.tsx,
      offsets: result.offsets,
    };
  }

  /**
   * Save Remotion code to file
   */
  async saveRemotionCode(
    scriptId: string,
    code: RemotionCode,
    outputDir?: string
  ): Promise<{ tsxPath: string; offsetsPath: string }> {
    const dir = outputDir || path.join(this.config.outputDir, scriptId);
    await fs.mkdir(dir, { recursive: true });

    const tsxPath = path.join(dir, "Video.tsx");
    const offsetsPath = path.join(dir, "offsets.json");

    await fs.writeFile(tsxPath, code.tsx, "utf-8");
    await fs.writeFile(offsetsPath, JSON.stringify(code.offsets, null, 2), "utf-8");

    logger.info("Remotion code saved", {
      scriptId,
      tsxPath,
      offsetsPath,
    });

    return { tsxPath, offsetsPath };
  }

  /**
   * Generate Remotion project structure
   */
  async generateRemotionProject(
    scriptId: string,
    code: RemotionCode
  ): Promise<string> {
    const projectDir = path.join(this.config.outputDir, `remotion-${scriptId}`);
    await fs.mkdir(projectDir, { recursive: true });

    // Create Video.tsx
    const videoPath = path.join(projectDir, "src", "compositions", "Video.tsx");
    await fs.mkdir(path.dirname(videoPath), { recursive: true });
    await fs.writeFile(videoPath, code.tsx, "utf-8");

    // Create offsets.json
    const offsetsPath = path.join(projectDir, "src", "timing", "offsets.json");
    await fs.mkdir(path.dirname(offsetsPath), { recursive: true });
    await fs.writeFile(offsetsPath, JSON.stringify(code.offsets, null, 2), "utf-8");

    // Create package.json
    const packageJson = {
      name: `remotion-${scriptId}`,
      version: "1.0.0",
      scripts: {
        start: "remotion studio",
        render: "remotion render",
      },
      dependencies: {
        "@remotion/cli": "^4.0.0",
        "@remotion/react": "^4.0.0",
        "react": "^18.0.0",
        "react-dom": "^18.0.0",
        "remotion": "^4.0.0",
      },
    };
    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );

    // Create remotion.config.ts
    const remotionConfig = `import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
`;
    await fs.writeFile(
      path.join(projectDir, "remotion.config.ts"),
      remotionConfig,
      "utf-8"
    );

    logger.info("Remotion project generated", { projectDir });

    return projectDir;
  }

  /**
   * Estimate video duration from timings
   */
  estimateDuration(timings: Timing[]): number {
    if (timings.length === 0) {
      return 0;
    }

    const lastTiming = timings[timings.length - 1];
    return lastTiming.endSec + lastTiming.gapAfterSec;
  }
}

/**
 * Default Remotion service instance
 */
let defaultRemotionService: RemotionService | null = null;

export function getDefaultRemotionService(): RemotionService {
  if (!defaultRemotionService) {
    defaultRemotionService = new RemotionService();
  }
  return defaultRemotionService;
}

/**
 * Reset default Remotion service (useful for testing)
 */
export function resetDefaultRemotionService(): void {
  defaultRemotionService = null;
}
