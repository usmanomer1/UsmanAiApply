import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

// HTTP endpoint to receive job batches from backend
const processBatch = httpAction(async (ctx, request) => {
  // Parse the incoming batch
  const {
    sessionId,
    batchIndex,
    batchCount,
    jobs,
    isLastBatch,
    processedCount,
    totalCount
  } = await request.json();

  console.log(`Received batch ${batchIndex + 1}/${batchCount} for session ${sessionId}`);

  try {
    // Insert the batch into database
    await ctx.runMutation(api.jobs.mutations.insertJobBatchInternal, {
      userId: "webhook", // Special marker for webhook-inserted jobs
      sessionId,
      jobs,
      batchIndex,
    });

    // Update session progress
    await ctx.runMutation(api.jobs.mutations.updateSessionStatusInternal, {
      userId: "webhook",
      sessionId,
      status: isLastBatch ? "completed" : "processing",
      totalFound: totalCount,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing batch:", error);
    return new Response(JSON.stringify({ error: "Failed to process batch" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Define the HTTP routes
const http = httpRouter();

// Route for receiving job batches
http.route({
  path: "/processBatch",
  method: "POST",
  handler: processBatch,
});

export default http;