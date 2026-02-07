import { Router, Request, Response, NextFunction } from 'express';

const API_VERSIONS = {
  V1: 'v1',
} as const;

export type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS];

export const CURRENT_API_VERSION = API_VERSIONS.V1;

interface VersionedRequest extends Request {
  apiVersion?: ApiVersion;
}

export function createVersionedRouter(version: ApiVersion): Router {
  const router = Router();

  router.use((req: VersionedRequest, res: Response, next: NextFunction) => {
    req.apiVersion = version;
    res.setHeader('X-API-Version', version);
    next();
  });

  return router;
}
