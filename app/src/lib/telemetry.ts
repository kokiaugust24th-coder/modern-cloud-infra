import { trace, type Tracer } from '@opentelemetry/api'

// OpenTelemetry 準拠の計装エントリポイント。
// フェーズ0ではエクスポータ未設定(ノーオペトレーサー)。フェーズ1以降は
// OTLP エクスポータを差し替えるだけで送信先(CloudWatch 等)を変更できる。
let tracer: Tracer

export function initTelemetry(): void {
  tracer = trace.getTracer('app-frontend')
}

export function getTracer(): Tracer {
  return tracer
}
