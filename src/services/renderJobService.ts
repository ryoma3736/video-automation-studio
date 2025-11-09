/**
 * Render Job Service
 * Manages video rendering jobs and their lifecycle
 */

import { RenderJob } from "../types";
import { StorageService, getDefaultStorage } from "./storageService";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

export interface RenderJobOptions {
  scriptId: string;
  slideSpecPath?: string;
  remotionEntry?: string;
  quality?: "low" | "medium" | "high";
  format?: "mp4" | "webm";
}

/**
 * Render Job Service Class
 */
export class RenderJobService {
  private storage: StorageService;

  constructor(storage?: StorageService) {
    this.storage = storage || getDefaultStorage();
  }

  /**
   * Create a new render job
   */
  async createRenderJob(options: RenderJobOptions): Promise<RenderJob> {
    const job: RenderJob = {
      id: uuidv4(),
      scriptId: options.scriptId,
      slideSpecPath: options.slideSpecPath || "",
      remotionEntry: options.remotionEntry || "Video",
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storage.saveRenderJob(job);
    logger.info("Render job created", { jobId: job.id, scriptId: options.scriptId });

    return job;
  }

  /**
   * Start rendering a job
   */
  async startRenderJob(jobId: string): Promise<void> {
    const job = await this.storage.loadRenderJob(jobId);
    if (!job) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    if (job.status !== "queued") {
      throw new Error(`Render job is not queued: ${job.status}`);
    }

    await this.storage.updateRenderJob(jobId, {
      status: "running",
    });

    logger.info("Render job started", { jobId });

    // TODO: Implement actual rendering logic
    // This would:
    // 1. Load script, slides, and audio assets
    // 2. Generate Remotion code if not already generated
    // 3. Execute Remotion render command
    // 4. Save output video and thumbnail
    // 5. Update job status to "done" or "failed"
  }

  /**
   * Get render job status
   */
  async getRenderJobStatus(jobId: string): Promise<RenderJob | null> {
    return await this.storage.loadRenderJob(jobId);
  }

  /**
   * List render jobs
   */
  async listRenderJobs(scriptId?: string): Promise<RenderJob[]> {
    return await this.storage.listRenderJobs(scriptId);
  }

  /**
   * Cancel a render job
   */
  async cancelRenderJob(jobId: string): Promise<void> {
    const job = await this.storage.loadRenderJob(jobId);
    if (!job) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    if (job.status === "done" || job.status === "failed") {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    await this.storage.updateRenderJob(jobId, {
      status: "failed",
      error: "Job cancelled by user",
    });

    logger.info("Render job cancelled", { jobId });
  }

  /**
   * Complete a render job
   */
  async completeRenderJob(
    jobId: string,
    outputs: { videoPath: string; thumbPath: string }
  ): Promise<void> {
    await this.storage.updateRenderJob(jobId, {
      status: "done",
      outputs,
    });

    logger.info("Render job completed", { jobId, outputs });
  }

  /**
   * Fail a render job
   */
  async failRenderJob(jobId: string, error: string): Promise<void> {
    await this.storage.updateRenderJob(jobId, {
      status: "failed",
      error,
    });

    logger.error("Render job failed", { jobId, error });
  }
}

/**
 * Default render job service instance
 */
let defaultRenderJobService: RenderJobService | null = null;

export function getDefaultRenderJobService(): RenderJobService {
  if (!defaultRenderJobService) {
    defaultRenderJobService = new RenderJobService();
  }
  return defaultRenderJobService;
}

/**
 * Reset default render job service (useful for testing)
 */
export function resetDefaultRenderJobService(): void {
  defaultRenderJobService = null;
}
