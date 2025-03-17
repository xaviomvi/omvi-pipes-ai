import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
  ServiceUnavailableError,
  BadGatewayError,
  GatewayTimeoutError,
  TooManyRequestsError,
  ConflictError,
  UnprocessableEntityError,
} from '../errors/http.errors';

export interface ICommand<T> {
  execute(): Promise<T>;
}

export abstract class BaseCommand<T> implements ICommand<T> {
  protected uri: string;
  protected queryParams?: Record<string, string | number | boolean>;
  protected headers: Record<string, string>;

  constructor(
    uri: string,
    queryParams?: Record<string, string | number | boolean>,
    headers?: Record<string, string>,
  ) {
    this.uri = uri;
    this.queryParams = queryParams;
    this.headers = headers || {};
  }

  // Helper to build the full URL including query parameters.
  protected buildUrl(): string {
    if (!this.queryParams) return this.uri;
    const queryString = new URLSearchParams(
      Object.entries(this.queryParams).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        },
        {},
      ),
    ).toString();
    return `${this.uri}?${queryString}`;
  }

  protected sanitizeBody(body: any): any {
    // Check if it's a FormData object by looking for typical FormData properties
    if (
      body &&
      typeof body === 'object' &&
      body._boundary
    ) {
      return body;
    }
    return typeof body === 'string' ? body : JSON.stringify(body);
  }

  protected sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    // Define allowed headers in lowercase.
    const allowedHeaders = new Set(['content-type', 'authorization']);
    // Ensure content-type is set to application/json if not present
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/json';
    }
    return Object.fromEntries(
      Object.entries(headers).filter(([key]) =>
        allowedHeaders.has(key.toLowerCase()),
      ),
    );
  }

  /**
   * Retry helper method using exponential backoff.
   * @param fn - A function returning a promise to retry.
   * @param retries - Number of retries (default is 3).
   * @param backoff - Initial backoff delay in milliseconds (default is 300ms).
   */
  protected async fetchWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    backoff: number = 300,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < retries) {
      try {
        const response = await fn();
        this.handleResponse(response as Response);
        return response;
      } catch (error) {
        attempt++;
        if (attempt >= retries) {
          throw error;
        }
        // Calculate exponential backoff delay.
        const delay = backoff * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    // Should never reach here.
    throw new InternalServerError('Unexpected error in retry logic.');
  }

  protected handleResponse(response: Response) {
    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new BadRequestError(`Bad Request: ${response.statusText}`);
        case 401:
          throw new UnauthorizedError(`Unauthorized: ${response.statusText}`);
        case 403:
          throw new ForbiddenError(`Forbidden: ${response.statusText}`);
        case 404:
          throw new NotFoundError(`Not Found: ${response.statusText}`);
        case 422:
          throw new UnprocessableEntityError(
            `Unprocessable Entity: ${response.statusText}`,
          );
        case 429:
          throw new TooManyRequestsError(
            `Too Many Requests: ${response.statusText}`,
          );
        case 409:
          throw new ConflictError(`Conflict: ${response.statusText}`);
        case 500:
          throw new InternalServerError(
            `Internal Server Error: ${response.statusText}`,
          );
        case 502:
          throw new BadGatewayError(`Bad Gateway: ${response.statusText}`);
        case 503:
          throw new ServiceUnavailableError(
            `Service Unavailable: ${response.statusText}`,
          );
        case 504:
          throw new GatewayTimeoutError(
            `Gateway Timeout: ${response.statusText}`,
          );
        default:
          throw new Error(
            `AI service command failed: ${response.statusText} (Status: ${response.status})`,
          );
      }
    }
  }

  public abstract execute(): Promise<T>;
}
