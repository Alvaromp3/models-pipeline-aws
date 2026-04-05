import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  @Get('profile')
  async profile(@Req() req: Request) {
    const u = req.user as { id: string };
    const user = await this.users.findOne({ where: { id: u.id } });
    if (!user) return { error: 'not_found' };
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
