import {
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';

export const USER_CLIENT = 'USER_CLIENT';
export const CATALOG_CLIENT = 'CATALOG_CLIENT';
const REQUEST_TIMEOUT_MS = 5000;

@Injectable()
export class RpcService {
  constructor(
    @Inject(USER_CLIENT) private readonly users: ClientProxy,
    @Inject(CATALOG_CLIENT) private readonly catalog: ClientProxy,
  ) {}

  user(pattern: string, data: unknown) {
    return this.request(this.users, pattern, data);
  }
  catalogRequest(pattern: string, data: unknown) {
    return this.request(this.catalog, pattern, data);
  }

  private async request(
    client: ClientProxy,
    pattern: string,
    data: unknown,
  ): Promise<unknown> {
    // Expire queued requests as well as bounding the HTTP wait. This cannot cancel
    // a write already delivered to a service. There is intentionally no retry().
    const message = new RmqRecordBuilder(data)
      .setOptions({ expiration: String(REQUEST_TIMEOUT_MS) })
      .build();
    try {
      return await firstValueFrom(
        client
          .send<unknown>(pattern, message)
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
      );
    } catch (error: unknown) {
      if (error instanceof TimeoutError) {
        throw new GatewayTimeoutException(
          'Service did not respond within 5 seconds',
        );
      }
      const rpc = error as {
        success?: unknown;
        statusCode?: unknown;
        message?: unknown;
      } | null;
      if (
        rpc?.success === false &&
        typeof rpc.statusCode === 'number' &&
        Number.isInteger(rpc.statusCode) &&
        rpc.statusCode >= 400 &&
        rpc.statusCode <= 599
      ) {
        const validMessage =
          typeof rpc.message === 'string' ||
          (Array.isArray(rpc.message) &&
            rpc.message.every((item) => typeof item === 'string'));
        const message =
          rpc.statusCode >= 500 || !validMessage
            ? 'Internal server error'
            : rpc.message;
        throw new HttpException({ message }, rpc.statusCode);
      }
      throw new ServiceUnavailableException('Service is unavailable');
    }
  }
}
