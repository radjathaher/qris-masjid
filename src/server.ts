import handler from "@tanstack/react-start/server-entry";
import type { AppEnv } from "#/shared/lib/server/env";

type CloudflareRequestContext = {
  cloudflare?: {
    env?: AppEnv;
  };
  env?: AppEnv;
};

export default {
  fetch(request: Request, env?: AppEnv) {
    if (!env) {
      return handler.fetch(request);
    }

    const context: CloudflareRequestContext = {
      cloudflare: { env },
      env,
    };

    return handler.fetch(request, { context } as any);
  },
};
