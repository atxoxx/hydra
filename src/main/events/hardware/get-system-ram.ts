import os from "node:os";
import { registerEvent } from "../register-event";

const getSystemRam = async (): Promise<number> => {
  try {
    return Math.round(os.totalmem() / (1024 * 1024 * 1024));
  } catch {
    return 16; // Safe default fallback
  }
};

registerEvent("getSystemRam", getSystemRam);
