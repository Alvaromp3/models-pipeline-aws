import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExplainPredictionDto } from './dto/explain-prediction.dto';
import { PredictionsService } from './predictions.service';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Get('ml-health')
  @UseGuards(JwtAuthGuard)
  mlHealth() {
    return this.predictions.mlHealth();
  }

  /** Esquema de entrada de los modelos (proxy a ML `/metadata/features`). */
  @Get('model-features')
  @UseGuards(JwtAuthGuard)
  modelFeatures() {
    return this.predictions.modelFeatures();
  }

  @Post('revenue')
  @UseGuards(JwtAuthGuard)
  revenue(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.predictions.predictRevenue(body, user?.id ?? null);
  }

  @Post('stockout-risk')
  @UseGuards(JwtAuthGuard)
  stockout(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.predictions.predictStockout(body, user?.id ?? null);
  }

  /** Interpretación en lenguaje natural vía OpenRouter (si hay API key). */
  @Post('explain')
  @UseGuards(JwtAuthGuard)
  explain(@Body() dto: ExplainPredictionDto) {
    return this.predictions.explainPrediction(dto);
  }
}
