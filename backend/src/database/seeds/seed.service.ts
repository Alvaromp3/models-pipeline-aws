import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async onModuleInit() {
    const email = 'exec@novaretail.demo';
    const exists = await this.users.exist({ where: { email } });
    if (exists) return;
    const passwordHash = await bcrypt.hash('NovaRetail!', 10);
    await this.users.save(
      this.users.create({
        email,
        passwordHash,
        displayName: 'Executive Demo',
      }),
    );
  }
}
