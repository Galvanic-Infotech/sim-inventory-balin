import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const isLocalAsset = (url: string): boolean =>
  url.startsWith('/assets/') || url.startsWith('assets/');

export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isLocalAsset(req.url) && req.url.startsWith('/')) {
    req = req.clone({ url: `${environment.apiBaseUrl}${req.url}` });
  }
  return next(req);
};
