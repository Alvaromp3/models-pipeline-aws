import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import {
  PredictionRecord,
  PredictionKind,
} from '../../database/entities/prediction-record.entity';
import { ExplainPredictionDto } from './dto/explain-prediction.dto';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type OpenRouterChatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export type ExplainPredictionResponse = {
  explanation: string | null;
  skippedReason?: string;
  error?: string;
};

@Injectable()
export class PredictionsService {
  private readonly log = new Logger(PredictionsService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(PredictionRecord)
    private readonly records: Repository<PredictionRecord>,
  ) {}

  private mlBase() {
    return this.config.get<string>('mlServiceUrl') ?? 'http://localhost:8000';
  }

  async mlHealth(): Promise<Record<string, unknown>> {
    const url = `${this.mlBase()}/health`;
    const res = await firstValueFrom(
      this.http.get<Record<string, unknown>>(url, { timeout: 10_000 }),
    );
    return res.data;
  }

  /** Columnas de entrada reportadas por cada joblib (`feature_names_in_`). */
  async modelFeatures(): Promise<{ revenue_features: string[]; stockout_features: string[] }> {
    const url = `${this.mlBase()}/metadata/features`;
    const res = await firstValueFrom(
      this.http.get<{ revenue_features: string[]; stockout_features: string[] }>(url, {
        timeout: 10_000,
      }),
    );
    return res.data;
  }

  async predictRevenue(body: Record<string, unknown>, userId: string | null) {
    const url = `${this.mlBase()}/predict/revenue`;
    const res = await firstValueFrom(
      this.http.post<Record<string, unknown>>(url, body, { timeout: 120_000 }),
    );
    const mlData = res.data;
    await this.saveRecord('revenue', body, mlData, userId);
    return this.mergeOpenRouterNarrative('revenue', mlData, body);
  }

  async predictStockout(body: Record<string, unknown>, userId: string | null) {
    const url = `${this.mlBase()}/predict/stockout-risk`;
    const res = await firstValueFrom(
      this.http.post<Record<string, unknown>>(url, body, { timeout: 120_000 }),
    );
    const mlData = res.data;
    await this.saveRecord('stockout_risk', body, mlData, userId);
    return this.mergeOpenRouterNarrative('stockout_risk', mlData, body);
  }

  /**
   * Añade `narrative` / `narrativeError` al JSON que ve el SPA (sin tocar lo guardado en BD).
   * Así no hace falta POST /predictions/explain (evita 404 si el API no se reinició).
   */
  private async mergeOpenRouterNarrative(
    kind: 'revenue' | 'stockout_risk',
    mlData: Record<string, unknown>,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const exp = await this.explainPrediction({
      kind,
      result: mlData,
      context: {
        region: body['region'],
        sku_id: body['sku_id'] ?? body['sku'],
      },
    });
    if (exp.explanation) {
      return { ...mlData, narrative: exp.explanation };
    }
    if (exp.skippedReason) {
      return { ...mlData, narrativeError: exp.skippedReason };
    }
    if (exp.error) {
      return { ...mlData, narrativeError: exp.error };
    }
    return mlData;
  }

  async explainPrediction(dto: ExplainPredictionDto): Promise<ExplainPredictionResponse> {
    const apiKey = this.config.get<string>('openRouter.apiKey')?.trim();
    if (!apiKey) {
      return {
        explanation: null,
        skippedReason: 'OPEN_ROUTER_API_KEY is not set in the API environment.',
      };
    }

    const model = this.config.get<string>('openRouter.model')?.trim() || 'openai/gpt-4o-mini';
    const referer = this.config.get<string>('openRouter.httpReferer')?.trim();

    const system = [
      'Eres un analista de retail y cadena de suministro.',
      'Interpretas salidas JSON de modelos ML (pronóstico de demanda/ingresos y riesgo de quiebre de stock).',
      'Responde SIEMPRE en español, en 3–6 frases claras para un usuario de negocio.',
      'Indica si el resultado es favorable, neutro o requiere atención, según el JSON.',
      'Propón 1–3 acciones concretas (compras, reposición, revisión de stock, alertas) cuando aplique.',
      'Si el campo del modelo indica stub o heurística, advierte menor fiabilidad.',
      'Si confidence es null u omitido, menciona que no hay intervalo de confianza en la respuesta.',
      'No inventes cifras ni contexto que no aparezcan en los datos. No incluyas markdown ni títulos.',
    ].join(' ');

    const userPayload = {
      tipo: dto.kind === 'revenue' ? 'pronóstico_revenue' : 'riesgo_stockout',
      resultado_modelo: dto.result,
      contexto: dto.context ?? {},
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (referer) {
      headers.Referer = referer;
    }
    headers['X-Title'] = 'NovaRetail Predictions';

    try {
      const res = await firstValueFrom(
        this.http.post<OpenRouterChatResponse>(
          OPENROUTER_URL,
          {
            model,
            temperature: 0.35,
            max_tokens: 600,
            messages: [
              { role: 'system', content: system },
              {
                role: 'user',
                content: JSON.stringify(userPayload, null, 2),
              },
            ],
          },
          { headers, timeout: 45_000 },
        ),
      );

      const data = res.data;
      if (data.error?.message) {
        this.log.warn(`OpenRouter error: ${data.error.message}`);
        return { explanation: null, error: data.error.message };
      }

      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { explanation: null, error: 'Empty response from language model.' };
      }

      return { explanation: text };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`OpenRouter request failed: ${msg}`);
      return { explanation: null, error: msg };
    }
  }

  private async saveRecord(
    kind: PredictionKind,
    requestPayload: Record<string, unknown>,
    responsePayload: Record<string, unknown>,
    userId: string | null,
  ) {
    const row = this.records.create({
      kind,
      requestPayload,
      responsePayload,
      userId,
    });
    await this.records.save(row);
  }
}
