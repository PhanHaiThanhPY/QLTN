import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips JWT authentication (and capability checks) for a route or controller. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
