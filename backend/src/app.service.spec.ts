import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get(AppService);
  });

  it('health returns ok payload', () => {
    const h = service.health();
    expect(h.status).toBe('ok');
    expect(h.service).toBe('novaretail-api');
    expect(typeof h.ts).toBe('string');
  });
});
