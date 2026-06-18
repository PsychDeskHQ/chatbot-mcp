import { Router } from "express";

import type { HealthController } from "../controllers/healthController.js";

export function createHealthRoutes(healthController: HealthController): Router {
  const router = Router();
  router.get("/health", healthController.health);
  return router;
}
