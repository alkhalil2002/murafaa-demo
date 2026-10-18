import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

/** Wraps every successful handler result as `{ data, error: null }`; file downloads pass through. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        map((data: unknown) =>
          data instanceof StreamableFile ? data : { data: data ?? null, error: null },
        ),
      );
  }
}
