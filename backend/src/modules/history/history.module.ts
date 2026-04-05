import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PredictionRecord } from '../../database/entities/prediction-record.entity';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

@Module({
  imports: [TypeOrmModule.forFeature([PredictionRecord])],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
