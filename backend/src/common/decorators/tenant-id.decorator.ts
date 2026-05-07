import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const TenantId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user?.tenantId ?? request.headers["x-tenant-id"];
  },
);
