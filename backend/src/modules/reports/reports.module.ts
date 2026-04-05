import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PredictionRecord } from '../../database/entities/prediction-record.entity';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PredictionRecord])],
  controllers: [ReportsController],
})
export class ReportsModule {}
