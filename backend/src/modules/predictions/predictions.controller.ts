import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PredictionsService } from './predictions.service';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Get('ml-health')
  @UseGuards(JwtAuthGuard)
  mlHealth() {
    return this.predictions.mlHealth();
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
}
