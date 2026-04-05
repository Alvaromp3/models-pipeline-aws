import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { HistoryModule } from './modules/history/history.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SeedModule } from './database/seeds/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('database.url');
        if (!url) {
          throw new Error(
            'DATABASE_URL no está definido. Copia backend/.env.example a backend/.env.',
          );
        }
        return {
          type: 'postgres' as const,
          url,
          autoLoadEntities: true,
          synchronize: config.get<boolean>('database.synchronize') ?? true,
          /** Por defecto TypeORM reintenta muchas veces → parece “colgado” si Postgres no responde. */
          retryAttempts: 3,
          retryDelay: 2_000,
          /** Evita que Nest quede colgado minutos si Postgres no está (proxy → 504 en /api). */
          extra: {
            connectionTimeoutMillis: 15_000,
          },
        };
      },
    }),
    AuthModule,
    PredictionsModule,
    HistoryModule,
    DashboardModule,
    AnalyticsModule,
    ReportsModule,
    SettingsModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
