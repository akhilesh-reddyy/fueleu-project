import express, { Request, Response, NextFunction, Router } from "express";
import type { IComplianceUseCases } from "../../../core/application/application";
export declare function buildRouter(uc: IComplianceUseCases): Router;
export declare function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void;
export declare function createApp(uc: IComplianceUseCases): express.Application;
//# sourceMappingURL=http.d.ts.map