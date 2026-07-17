import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

export const FAILURE_CATEGORIES = Object.freeze({
  PRECONDITION: "PRECONDITION_FAILURE",
  AUTH: "AUTH_BOUNDARY_FAILURE",
  SESSION: "SESSION_FAILURE",
  PERSISTENCE: "PERSISTENCE_FAILURE",
