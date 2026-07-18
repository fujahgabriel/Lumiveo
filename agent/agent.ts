import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-5",
  compaction: {
    thresholdPercent: 0.75,
  },
});
