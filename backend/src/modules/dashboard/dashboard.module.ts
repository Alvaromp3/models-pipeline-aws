import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PredictionRecord } from '../../database/entities/prediction-record.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([PredictionRecord])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
