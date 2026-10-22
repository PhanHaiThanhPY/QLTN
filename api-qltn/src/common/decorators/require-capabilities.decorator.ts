import { SetMetadata } from '@nestjs/common';
import type { Capability } from '../../domain/permissions';

export const CAPABILITIES_KEY = 'requiredCapabilities';

/** The caller must hold ALL listed capabilities. Building scope is checked by the service. */
export const RequireCapabilities = (...capabilities: Capability[]) => SetMetadata(CAPABILITIES_KEY, capabilities);
