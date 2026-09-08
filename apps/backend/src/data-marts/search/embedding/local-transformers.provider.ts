import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { ADVANCED_SEARCH_CONFIG, AdvancedSearchConfig } from '../config/advanced-search.config';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL,
  EmbeddingOptions,
  EmbeddingProvider,
} from './embedding-provider';

type Pipe = (
  text: string,
  opts: { pooling: string; normalize: boolean }
) => Promise<{ data: ArrayLike<number> }>;

type TransformersModule = {
  pipeline: (task: string, model: string, options?: { dtype: string }) => Promise<Pipe>;
  env: { cacheDir: string };
};

type TransformersImporter = (specifier: string) => Promise<TransformersModule>;

// Preserves native dynamic import() for the ESM-only dep under CJS compilation.
const esmImport = new Function('specifier', 'return import(specifier)') as TransformersImporter;

export const TRANSFORMERS_IMPORTER = Symbol('TRANSFORMERS_IMPORTER');
const LOCAL_PIPELINE_INIT_WARN_AFTER_MS = 10_000;
const CORRUPT_MODEL_RETRY_DELAY_MS = 60_000;

@Injectable()
export class LocalTransformersEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(LocalTransformersEmbeddingProvider.name);

  private pipelinePromise: Promise<Pipe | null> | null = null;

  // A broken cache should not trigger a download and an error log for every reindex event.
  private retryAfter = 0;

  constructor(
    @Inject(ADVANCED_SEARCH_CONFIG)
    private readonly config: AdvancedSearchConfig,
    @Optional()
    @Inject(TRANSFORMERS_IMPORTER)
    private readonly importer: TransformersImporter = esmImport
  ) {}

  get modelId(): string {
    return `local:${EMBEDDING_MODEL}:${EMBEDDING_DTYPE}:${EMBEDDING_DIMENSIONS}`;
  }

  get dimensions(): number {
    return EMBEDDING_DIMENSIONS;
  }

  async embed(texts: string[], _options?: EmbeddingOptions): Promise<(Float32Array | null)[]> {
    const pipe = await this.resolvePipeline();
    if (pipe === null) {
      return texts.map(() => null);
    }

    const results: (Float32Array | null)[] = new Array(texts.length).fill(null);
    let nextIndex = 0;
    const workerCount = Math.min(this.config.embeddingConcurrency, texts.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < texts.length) {
          const index = nextIndex++;
          results[index] = await this.embedOne(pipe, texts[index], index);
        }
      })
    );

    return results;
  }

  private async embedOne(pipe: Pipe, text: string, index: number): Promise<Float32Array | null> {
    try {
      const result = await pipe(text, { pooling: 'mean', normalize: true });
      const vec = new Float32Array(result.data);
      if (vec.length !== EMBEDDING_DIMENSIONS) {
        this.logger.warn(
          `Embedding inference returned dimension ${vec.length}, expected ${EMBEDDING_DIMENSIONS}; entity will not be indexed`
        );
        return null;
      }
      return vec;
    } catch (err) {
      this.logger.warn(
        `Embedding inference failed for text index ${index}; entity will not be indexed: ${this.formatError(err)}`
      );
      return null;
    }
  }

  private resolvePipeline(): Promise<Pipe | null> {
    if (this.retryAfter > Date.now()) {
      return Promise.resolve(null);
    }

    if (this.pipelinePromise === null) {
      this.pipelinePromise = this.initPipeline().then(pipe => {
        if (pipe === null) {
          this.pipelinePromise = null;
        }
        return pipe;
      });
    }
    return this.pipelinePromise;
  }

  private async initPipeline(): Promise<Pipe | null> {
    const warnTimer = setTimeout(() => {
      this.logger.warn(
        `local embedding pipeline initialization is still running after ${LOCAL_PIPELINE_INIT_WARN_AFTER_MS}ms; model download or ONNX startup may be slow`
      );
    }, LOCAL_PIPELINE_INIT_WARN_AFTER_MS);

    try {
      const transformers = await this.importer('@huggingface/transformers');
      if (this.config.modelCacheDir) {
        transformers.env.cacheDir = this.config.modelCacheDir;
      }

      try {
        return await this.createPipeline(transformers);
      } catch (err) {
        if (!this.isCorruptModelError(err)) {
          throw err;
        }

        this.logger.warn(
          `Local embedding model cache is invalid; clearing the cached model and retrying once: ${this.formatError(err)}`
        );
        await this.clearModelCache(transformers.env.cacheDir);

        try {
          return await this.createPipeline(transformers);
        } catch (retryError) {
          this.retryAfter = Date.now() + CORRUPT_MODEL_RETRY_DELAY_MS;
          throw retryError;
        }
      }
    } catch (err) {
      this.logger.warn(
        `@huggingface/transformers failed to load — embedding unavailable, search and indexing will fail closed: ${this.formatError(err)}`
      );
      return null;
    } finally {
      clearTimeout(warnTimer);
    }
  }

  private createPipeline(transformers: TransformersModule): Promise<Pipe> {
    return transformers.pipeline('feature-extraction', EMBEDDING_MODEL, {
      dtype: EMBEDDING_DTYPE,
    });
  }

  private isCorruptModelError(err: unknown): boolean {
    const message = this.formatError(err).toLowerCase();
    return (
      message.includes('protobuf parsing failed') ||
      message.includes('invalid onnx') ||
      message.includes('onnx model is invalid')
    );
  }

  private async clearModelCache(cacheDir: string | undefined): Promise<void> {
    if (!cacheDir) {
      return;
    }

    await rm(path.join(cacheDir, EMBEDDING_MODEL), { recursive: true, force: true });
  }

  private formatError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
