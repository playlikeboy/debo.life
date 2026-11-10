CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);