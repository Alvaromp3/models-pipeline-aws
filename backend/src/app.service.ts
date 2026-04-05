import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      service: 'novaretail-api',
      ts: new Date().toISOString(),
    };
  }
}
