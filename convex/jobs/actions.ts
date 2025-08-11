import { v } from "convex/values";
import { action } from "../_generated/server";

// This file can be removed entirely since we're streaming directly from backend
// Keeping a placeholder for potential future actions

export const placeholder = action({
  args: {},
  handler: async () => {
    return { message: "Direct streaming from backend - no Convex actions needed" };
  },
});