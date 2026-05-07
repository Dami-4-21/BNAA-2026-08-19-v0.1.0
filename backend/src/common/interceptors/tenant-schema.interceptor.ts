import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class TenantSchemaInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId ?? request.headers["x-tenant-id"];
    request.tenantSchema = tenantId ? `tenant_${tenantId}` : "public";
    return next.handle();
  }
}
