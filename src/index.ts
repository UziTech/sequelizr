import downloadModels from "./download-models.ts";
import uploadModels from "./upload-models.ts";
import checkModels from "./check-models.ts";

// Define more specific types later
type ModelFunction = (...args: any[]) => any;

export {
  downloadModels,
  uploadModels,
  checkModels,
};

export type { ModelFunction };
