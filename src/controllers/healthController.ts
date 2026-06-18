import type { Request, Response } from "express";

import type { HealthService } from "../services/chatService.js";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  health = (_req: Request, res: Response): void => {
    res.json(this.healthService.getHealth());
  };
}
