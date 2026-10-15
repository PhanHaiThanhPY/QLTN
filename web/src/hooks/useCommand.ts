import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SubjectType } from '@/domain/constants';
import { isAppError, toErrorMessage } from '@/domain/errors';
import type { FieldErrors } from '@/domain/errors';
import { executeCommand } from '@/services/command-engine';
import type { CommandResult } from '@/services/command-engine';
import { newId } from '@/services/runtime';

export interface CommandRequest {
  subjectType: SubjectType;
  subjectId?: string;
  expectedVersion?: number;
  action: string;
  payload?: unknown;
}

interface UseCommandOptions {
  successMessage?: string;
  onSuccess?: (result: CommandResult) => void;
}

/**
 * Runs one business command. The commandId is kept until success so a retry after a
 * network error reuses it (no duplicate decisions); a new intent starts after success or reset().
 */
export const useCommand = (options: UseCommandOptions = {}) => {
  const commandIdRef = useRef<string>(newId('cmd'));
  // Synchronous copy so callers can read the errors right after a failed execute().
  const lastFieldErrorsRef = useRef<FieldErrors>({});
  // Callers pass a fresh options object each render; read the latest one without re-creating execute().
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (request: CommandRequest) =>
      executeCommand({ commandId: commandIdRef.current, payload: {}, ...request }),
  });

  const reset = useCallback(() => {
    commandIdRef.current = newId('cmd');
    setFieldErrors({});
    setErrorMessage(null);
  }, []);

  const execute = useCallback(
    async (request: CommandRequest): Promise<CommandResult | null> => {
      lastFieldErrorsRef.current = {};
      setFieldErrors({});
      setErrorMessage(null);
      try {
        const result = await mutateAsync(request);
        commandIdRef.current = newId('cmd');
        const { successMessage, onSuccess } = optionsRef.current;
        if (successMessage) toast.success(successMessage);
        onSuccess?.(result);
        return result;
      } catch (error) {
        console.error(`Command ${request.action} failed:`, error);
        const message = toErrorMessage(error);
        setErrorMessage(message);
        if (isAppError(error) && error.fieldErrors) {
          lastFieldErrorsRef.current = error.fieldErrors;
          setFieldErrors(error.fieldErrors);
        }
        // A payload change is a new intent; keep the id only for transport failures.
        if (!isAppError(error) || error.code !== 'NETWORK_ERROR') commandIdRef.current = newId('cmd');
        toast.error(message);
        return null;
      }
    },
    [mutateAsync],
  );

  const getLastFieldErrors = useCallback((): FieldErrors => lastFieldErrorsRef.current, []);

  return { execute, isPending, fieldErrors, errorMessage, reset, getLastFieldErrors };
};
