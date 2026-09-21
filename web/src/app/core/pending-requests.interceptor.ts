import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PendingRequestsService } from '@pu-stats/data-access';
import { finalize } from 'rxjs';

/** Counts every `HttpClient` request towards the global pending indicator. */
export const pendingRequestsInterceptor: HttpInterceptorFn = (req, next) => {
  const pending = inject(PendingRequestsService);
  pending.begin();
  return next(req).pipe(finalize(() => pending.end()));
};
