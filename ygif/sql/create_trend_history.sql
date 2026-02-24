-- trend_history 테이블 생성
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS trend_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    line_id TEXT NOT NULL,
    search_keyword TEXT NOT NULL,
    current_value INTEGER NOT NULL DEFAULT 0,
    average_value INTEGER NOT NULL DEFAULT 0,
    trend_direction TEXT NOT NULL DEFAULT 'stable',
    trend_slope REAL NOT NULL DEFAULT 0,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(line_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_trend_history_line_id ON trend_history(line_id);
CREATE INDEX IF NOT EXISTS idx_trend_history_date ON trend_history(recorded_date);

-- 구 캐시 정리 (classifier 변경으로 인한 구 lineId 데이터 제거)
-- 필요 시 아래 쿼리 실행
-- DELETE FROM trend_cache WHERE fetched_at < NOW() - INTERVAL '1 day';
