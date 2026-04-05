import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { SettingsController } from './settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [SettingsController],
})
export class SettingsModule {}
