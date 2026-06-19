import type { Request, Response, NextFunction } from "express";

import type { ChatRequest } from "../types/api.js";
import type { ChatService } from "../services/chatService.js";

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ChatRequest;
      const result = await this.chatService.handleChat(body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
